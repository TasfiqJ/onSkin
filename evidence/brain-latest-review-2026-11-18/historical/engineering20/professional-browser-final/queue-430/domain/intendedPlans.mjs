import { accessDenial, ProfessionalAccessError } from './authority.mjs';
import { canonical, recordHash } from './grants.mjs';
const uuid = (value) => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(value);
const text = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max && !/[\p{Cf}\p{Cs}\u0000-\u001f\u007f-\u009f]/u.test(value);
function steps(items) {
    if (!Array.isArray(items) || items.length > 50 || new Set(items.map(item => item.productId)).size !== items.length ||
        items.some(item => !item || Object.keys(item).sort().join(',') !== 'name,productId' || !text(item.productId, 128) || !text(item.name, 200)))
        throw new Error('INTENDED_PLAN_INVALID');
    return Object.freeze(items.map(item => Object.freeze({ productId: item.productId, name: item.name })));
}
/** Shared strict projection reader for authorship and pre-visit exports. */
export async function validateClientPlanSource(source, ownerId, workspaceId, grantId, grantVersion) {
    if (!source || Object.keys(source).sort().join(',') !== 'contentHash,grantId,grantVersion,ownerId,products,workspaceId' ||
        source.ownerId !== ownerId || source.workspaceId !== workspaceId || source.grantId !== grantId || source.grantVersion !== grantVersion)
        throw new Error('INTENDED_PLAN_SOURCE');
    const projection = { ownerId: source.ownerId, workspaceId: source.workspaceId, grantId: source.grantId,
        grantVersion: source.grantVersion, products: steps(source.products) };
    const contentHash = source.contentHash;
    if (contentHash !== await recordHash(projection))
        throw new Error('INTENDED_PLAN_SOURCE');
    return Object.freeze({ ...projection, contentHash });
}
function writeRequest(authority) {
    return { action: 'client_plan_issue_respond_export', workspaceId: authority.session.workspaceId,
        ownerId: authority.grant?.ownerId ?? null, grantVersion: authority.grant?.version ?? null,
        grantEpoch: authority.grant?.epoch ?? null, purpose: 'routine_review', fields: ['intended_plans'], operation: 'write' };
}
/** Immutable practitioner intent, to be executed inside the final authorized
 * repository transaction. It never receives a personal-record writer. */
export async function issueIntendedPlan(history, authority, command, now, source) {
    authority = structuredClone(authority);
    command = structuredClone(command);
    source = structuredClone(source);
    const originalHistory = canonical(history);
    const denied = accessDenial(authority, writeRequest(authority), now);
    if (denied)
        throw new ProfessionalAccessError(denied);
    if (!uuid(command.id) || history.length > 100 || (history.length && history.some(plan => plan.ownerId !== authority.grant.ownerId || plan.workspaceId !== authority.grant.workspaceId)))
        throw new Error('INTENDED_PLAN_INVALID');
    const am = steps(command.am);
    const pm = steps(command.pm);
    const commandId = command.id;
    const expectedParentHash = command.expectedParentHash;
    const readDenied = accessDenial(authority, { ...writeRequest(authority), fields: ['products'], operation: 'read' }, now);
    if (readDenied)
        throw new ProfessionalAccessError(readDenied);
    const projection = await validateClientPlanSource(source, authority.grant.ownerId, authority.grant.workspaceId, authority.grant.id, authority.grant.version);
    const sourceProjectionHash = projection.contentHash;
    if ([...am, ...pm].some(step => !projection.products.some(product => product.productId === step.productId && product.name === step.name)))
        throw new Error('INTENDED_PLAN_SOURCE');
    await decodeIntendedPlans(history, authority.grant.ownerId, authority.grant.workspaceId, now);
    if (canonical(history) !== originalHistory)
        throw new Error('INTENDED_PLAN_CONFLICT');
    if (!am.length && !pm.length)
        throw new Error('INTENDED_PLAN_INVALID');
    const existing = history.find(plan => plan.id === commandId);
    if (existing) {
        if (existing !== history.at(-1) || existing.parentHash !== expectedParentHash || canonical([existing.am, existing.pm]) !== canonical([am, pm]) ||
            existing.actorId !== authority.session.subjectId || existing.grantId !== authority.grant.id || existing.grantEpoch !== authority.grant.epoch ||
            existing.grantVersion !== authority.grant.version || existing.healthEpoch !== authority.grant.healthEpoch ||
            existing.sourceProjectionHash !== sourceProjectionHash)
            throw new Error('INTENDED_PLAN_CONFLICT');
        return history;
    }
    const parent = history.at(-1);
    if (history.length >= 100)
        throw new Error('INTENDED_PLAN_INVALID');
    if ((parent?.contentHash ?? null) !== expectedParentHash)
        throw new Error('INTENDED_PLAN_CONFLICT');
    const body = { schemaVersion: 1, id: commandId, sequence: history.length + 1,
        ownerId: authority.grant.ownerId, workspaceId: authority.grant.workspaceId,
        grantId: authority.grant.id, grantVersion: authority.grant.version, grantEpoch: authority.grant.epoch, healthEpoch: authority.grant.healthEpoch,
        createdAt: now, actorId: authority.session.subjectId, source: 'practitioner-intended',
        parentId: parent?.id ?? null, parentHash: parent?.contentHash ?? null, sourceProjectionHash, am, pm };
    const plan = Object.freeze({ ...body, contentHash: await recordHash(body) });
    if (canonical(history) !== originalHistory)
        throw new Error('INTENDED_PLAN_CONFLICT');
    return Object.freeze([...history, plan]);
}
/** Owner receipt has no apply capability. Retained received history belongs to
 * the owner even after grant expiry/revocation/practice cancellation. */
export async function appendPlanReceipt(receipts, owner, plan, command, now) {
    owner = structuredClone(owner);
    plan = structuredClone(plan);
    command = structuredClone(command);
    const originalReceipts = canonical(receipts);
    if (!owner.current || !owner.adult || owner.deletionPending || owner.ownerId !== plan.ownerId ||
        !uuid(command.id) || command.confirmed !== true || command.expectedPlanHash !== plan.contentHash ||
        !['received', 'acknowledged', 'declined'].includes(command.kind) || !Number.isFinite(now) || now < 0 || now > 8.64e15 || receipts.length > 1000)
        throw new Error('INTENDED_RECEIPT_REFUSED');
    const captured = Object.freeze({ ...command });
    // A received historical plan is independently hash-validated; no current
    // practice role or grant is manufactured to read or acknowledge that copy.
    await validateIntendedPlan(plan, now);
    await decodePlanReceipts(receipts, owner.ownerId, now);
    if (canonical(receipts) !== originalReceipts)
        throw new Error('INTENDED_RECEIPT_CONFLICT');
    if (receipts.some(receipt => receipt.planId === plan.id &&
        (receipt.planHash !== plan.contentHash || receipt.recordedAt < plan.createdAt)))
        throw new Error('INTENDED_RECEIPT_REFUSED');
    const existing = receipts.find(receipt => receipt.id === captured.id);
    if (existing) {
        if (existing.planId !== plan.id || existing.planHash !== plan.contentHash || existing.actorId !== owner.actorId || existing.kind !== captured.kind)
            throw new Error('INTENDED_RECEIPT_CONFLICT');
        return receipts;
    }
    if (receipts.length >= 1000)
        throw new Error('INTENDED_RECEIPT_REFUSED');
    if (captured.kind !== 'received' && !receipts.some(receipt => receipt.ownerId === owner.ownerId && receipt.planId === plan.id && receipt.planHash === plan.contentHash && receipt.kind === 'received'))
        throw new Error('INTENDED_RECEIPT_NOT_RECEIVED');
    const body = { schemaVersion: 1, id: captured.id, planId: plan.id, planHash: plan.contentHash,
        ownerId: owner.ownerId, actorId: owner.actorId, recordedAt: now, source: 'owner-explicit-receipt', kind: captured.kind };
    const receipt = Object.freeze({ ...body, contentHash: await recordHash(body) });
    if (canonical(receipts) !== originalReceipts)
        throw new Error('INTENDED_RECEIPT_CONFLICT');
    return Object.freeze([...receipts, receipt]);
}
export async function validatePlanReceipt(receipt, latestTime = 8.64e15) {
    if (!receipt || Object.keys(receipt).sort().join(',') !== 'actorId,contentHash,id,kind,ownerId,planHash,planId,recordedAt,schemaVersion,source' ||
        receipt.schemaVersion !== 1 || receipt.source !== 'owner-explicit-receipt' || !uuid(receipt.id) ||
        !uuid(receipt.planId) || !/^[a-f0-9]{64}$/u.test(receipt.planHash) || !text(receipt.actorId, 128) || !text(receipt.ownerId, 128) ||
        !['received', 'acknowledged', 'declined'].includes(receipt.kind) || !Number.isFinite(latestTime) || latestTime < 0 ||
        !Number.isFinite(receipt.recordedAt) || receipt.recordedAt < 0 || receipt.recordedAt > Math.min(latestTime, 8.64e15))
        throw new Error('INTENDED_RECEIPT_REFUSED');
    const { contentHash, ...body } = receipt;
    if (contentHash !== await recordHash(body))
        throw new Error('INTENDED_RECEIPT_REFUSED');
}
/** One strict reader for retained owner responses. Append order is provenance:
 * a later receipt cannot retroactively establish that an earlier response had
 * received the plan. Equal transaction timestamps remain valid. */
export async function decodePlanReceipts(value, ownerId, latestTime = 8.64e15) {
    value = structuredClone(value);
    if (!Array.isArray(value) || value.length > 1000)
        throw new Error('INTENDED_RECEIPT_REFUSED');
    const result = [];
    const ids = new Set();
    const received = new Set();
    const plans = new Map();
    for (const receipt of value) {
        await validatePlanReceipt(receipt, latestTime);
        if (receipt.ownerId !== ownerId || ids.has(receipt.id) || receipt.recordedAt < (result.at(-1)?.recordedAt ?? 0) ||
            (plans.has(receipt.planId) && plans.get(receipt.planId) !== receipt.planHash) ||
            (receipt.kind !== 'received' && !received.has(canonical([receipt.planId, receipt.planHash]))))
            throw new Error('INTENDED_RECEIPT_REFUSED');
        ids.add(receipt.id);
        plans.set(receipt.planId, receipt.planHash);
        if (receipt.kind === 'received')
            received.add(canonical([receipt.planId, receipt.planHash]));
        result.push(Object.freeze({ ...receipt }));
    }
    return Object.freeze(result);
}
export async function validateIntendedPlan(plan, latestTime = 8.64e15) {
    if (!plan || Object.keys(plan).sort().join(',') !== 'actorId,am,contentHash,createdAt,grantEpoch,grantId,grantVersion,healthEpoch,id,ownerId,parentHash,parentId,pm,schemaVersion,sequence,source,sourceProjectionHash,workspaceId' ||
        plan.schemaVersion !== 1 || plan.source !== 'practitioner-intended' || !uuid(plan.id) ||
        !text(plan.ownerId, 128) || !text(plan.workspaceId, 128) || !text(plan.actorId, 128) || !text(plan.grantId, 128) ||
        ![plan.sequence, plan.grantVersion, plan.grantEpoch, plan.healthEpoch].every(value => Number.isSafeInteger(value) && value > 0) ||
        !Number.isFinite(latestTime) || latestTime < 0 || !Number.isFinite(plan.createdAt) || plan.createdAt < 0 ||
        plan.createdAt > Math.min(latestTime, 8.64e15) || !/^[a-f0-9]{64}$/u.test(plan.sourceProjectionHash) ||
        (plan.parentId !== null && !uuid(plan.parentId)) || (plan.parentHash !== null && !/^[a-f0-9]{64}$/u.test(plan.parentHash)))
        throw new Error('INTENDED_PLAN_INVALID');
    const am = steps(plan.am);
    const pm = steps(plan.pm);
    if (!am.length && !pm.length)
        throw new Error('INTENDED_PLAN_INVALID');
    const { contentHash, ...body } = plan;
    if (contentHash !== await recordHash(body))
        throw new Error('INTENDED_PLAN_INVALID');
}
export async function decodeIntendedPlans(value, ownerId, workspaceId, latestTime = 8.64e15) {
    value = structuredClone(value);
    if (!Array.isArray(value) || value.length > 100)
        throw new Error('INTENDED_PLAN_INVALID');
    const result = [];
    const ids = new Set();
    for (const plan of value) {
        await validateIntendedPlan(plan, latestTime);
        const previous = result.at(-1);
        if (plan.ownerId !== ownerId || plan.workspaceId !== workspaceId || plan.sequence !== result.length + 1 || ids.has(plan.id) ||
            plan.parentId !== (previous?.id ?? null) || plan.parentHash !== (previous?.contentHash ?? null) ||
            (previous && plan.createdAt < previous.createdAt))
            throw new Error('INTENDED_PLAN_INVALID');
        result.push(Object.freeze({ ...plan, am: steps(plan.am), pm: steps(plan.pm) }));
        ids.add(plan.id);
    }
    return Object.freeze(result);
}
/** Exact product identity/phase facts only. Missing actual evidence stays
 * unavailable; names cannot establish matching products or a formula. */
export function compareIntendedActual(intended, actual) {
    const limitation = 'Recorded sequences only. Receipt is not apply intent; differences do not establish use, noncompliance, improvement or formula equivalence.';
    if (!actual)
        return Object.freeze({ status: 'unavailable', phases: Object.freeze([]), limitation });
    const phases = ['am', 'pm'].map(phase => {
        const wanted = steps(intended[phase]).map(step => step.productId);
        const current = steps(actual[phase]).map(step => step.productId);
        return Object.freeze({ phase, intendedOnly: Object.freeze(wanted.filter(id => !current.includes(id))),
            actualOnly: Object.freeze(current.filter(id => !wanted.includes(id))),
            orderDiffers: canonical(wanted.filter(id => current.includes(id))) !== canonical(current.filter(id => wanted.includes(id))) });
    });
    return Object.freeze({ status: 'compared', phases: Object.freeze(phases), limitation });
}
