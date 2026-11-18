import { accessDenial, ProfessionalAccessError } from './authority.mjs';
import { canonical, recordHash } from './grants.mjs';
import { validatePlanReceipt } from './intendedPlans.mjs';
export const MATERIAL_EVENTS = ['product_started', 'product_stopped', 'product_substituted', 'concern_reported',
    'plan_declined', 'clarification_requested', 'scheduled_confirmation_difference', 'formula_correction_affects_plan'];
const closed = (state) => ['resolved', 'declined_referred', 'relationship_closed'].includes(state);
const fail = () => { throw new Error('RECONCILIATION_REFUSED'); };
const uuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(value);
const safe = (value) => typeof value === 'string' && value.trim().length > 0 && value.length <= 2000 && !/[\p{Cf}\p{Cs}\u0000-\u001f\u007f-\u009f]/u.test(value);
function admitted(a, now) {
    const denial = accessDenial(a, { action: 'task_health_details', workspaceId: a.session.workspaceId, ownerId: a.grant?.ownerId ?? null,
        grantVersion: a.grant?.version ?? null, grantEpoch: a.grant?.epoch ?? null, fields: ['exceptions'], purpose: 'routine_review', operation: 'read' }, now);
    if (denial)
        throw new ProfessionalAccessError(denial);
    if (a.billing !== 'write_allowed')
        throw new ProfessionalAccessError('billing');
}
function sameScope(row, a) {
    return row.workspaceId === a.grant?.workspaceId && row.ownerId === a.grant?.ownerId && row.grantVersion === a.grant?.version;
}
function latest(log) {
    const cases = new Map();
    for (const row of log)
        cases.set(row.caseId, row);
    return [...cases.values()];
}
async function append(log, body) {
    if (log.length >= 5000)
        return fail();
    const next = Object.freeze([...log, Object.freeze({ ...body, contentHash: await recordHash(body) })]);
    if (new TextEncoder().encode(JSON.stringify(next)).length > 1_048_576)
        return fail();
    return next;
}
/** Explicit material owner records only. Passing a completion/silence as a kind
 * refuses; no automatic priority, urgency, adherence or outcome is inferred. */
export async function enqueueMaterial(log, authority, event, newCaseId, now) {
    authority = structuredClone(authority);
    event = Object.freeze({ ...event });
    admitted(authority, now);
    const retained = canonical(log);
    await decodeReconciliation(log, authority.grant.ownerId, authority.grant.workspaceId);
    if (canonical(log) !== retained)
        return fail();
    if (!uuid(event.id) || !uuid(newCaseId) || !Number.isSafeInteger(event.version) || event.version < 1 ||
        event.ownerId !== authority.grant.ownerId || event.workspaceId !== authority.grant.workspaceId || event.grantVersion !== authority.grant.version ||
        !/^[a-f0-9]{64}$/u.test(event.planHash) || !MATERIAL_EVENTS.includes(event.kind) || !safe(event.detail) ||
        Object.keys(event).sort().join(',') !== 'contentHash,detail,grantVersion,id,kind,ownerId,planHash,version,workspaceId')
        return fail();
    const captured = Object.freeze({ ...event });
    const { contentHash, ...payload } = captured;
    if (contentHash !== await recordHash(payload))
        return fail();
    for (const row of log)
        for (const prior of row.events)
            if (prior.ownerId === captured.ownerId && prior.id === captured.id && prior.version === captured.version) {
                if (canonical(prior) !== canonical(captured))
                    return fail();
                return log;
            }
    const category = captured.kind === 'concern_reported' ? 'concern' : captured.kind === 'clarification_requested' ? 'clarification' : 'change';
    const related = latest(log).filter(row => sameScope(row, authority) && row.planHash === captured.planHash && row.category === category);
    const candidate = related.at(-1);
    const group = candidate && !closed(candidate.state) && now >= candidate.groupAnchorAt && now - candidate.groupAnchorAt < 24 * 3600000;
    const reopen = candidate && candidate.closedAt !== null && now >= candidate.closedAt && now - candidate.closedAt <= 7 * 86400000;
    const previous = group || reopen ? candidate : undefined;
    if (!previous && log.some(row => row.caseId === newCaseId))
        return fail();
    const body = { schemaVersion: 1, caseId: previous?.caseId ?? newCaseId, revision: (previous?.revision ?? 0) + 1,
        workspaceId: captured.workspaceId, ownerId: captured.ownerId, grantVersion: captured.grantVersion, planHash: captured.planHash, category,
        state: previous && group ? previous.state === 'awaiting_client_ack' ? 'in_review' : previous.state : 'new', createdAt: previous?.createdAt ?? now,
        groupAnchorAt: group ? previous.groupAnchorAt : now, recordedAt: now,
        source: 'professional-reconciliation', actorId: authority.session.subjectId,
        events: Object.freeze([...(previous?.events ?? []), captured]), reason: previous ? reopen ? 'New material event reopens prior case; earlier decision retained.' : 'Material event grouped within fixed 24-hour window.' : 'Explicit material owner event received.',
        communication: null, acknowledgementHash: null, nonAcknowledgementReason: null, changedPlanHash: group ? previous.changedPlanHash : null, closedAt: null,
        previousCaseId: previous ? previous.previousCaseId : candidate?.caseId ?? null, previousHash: previous?.contentHash ?? null };
    return append(log, body);
}
const transitions = {
    new: ['assigned', 'in_review', 'awaiting_information', 'relationship_closed'],
    assigned: ['in_review', 'awaiting_information', 'relationship_closed'],
    awaiting_information: ['in_review', 'relationship_closed'],
    in_review: ['awaiting_information', 'awaiting_client_ack', 'resolved', 'declined_referred', 'relationship_closed'],
    awaiting_client_ack: ['in_review', 'resolved', 'declined_referred', 'relationship_closed'],
    resolved: [], declined_referred: [], relationship_closed: [],
};
export { transitions as QUEUE_TRANSITIONS };
export async function transitionCase(log, authority, request, now) {
    request = Object.freeze({ ...request, acknowledgement: request.acknowledgement ? Object.freeze({ ...request.acknowledgement }) : null });
    if (Object.keys(request).sort().join(',') !== 'acknowledgement,caseId,changedPlanHash,communication,expectedHash,next,nonAcknowledgementReason,reason' ||
        (request.communication !== null && !safe(request.communication)) ||
        (request.changedPlanHash !== null && !/^[a-f0-9]{64}$/u.test(request.changedPlanHash)) ||
        (request.nonAcknowledgementReason !== null && !safe(request.nonAcknowledgementReason)))
        return fail();
    authority = structuredClone(authority);
    admitted(authority, now);
    const retained = canonical(log);
    await decodeReconciliation(log, authority.grant.ownerId, authority.grant.workspaceId);
    if (canonical(log) !== retained)
        return fail();
    const current = latest(log).find(row => row.caseId === request.caseId);
    if (!current || !sameScope(current, authority) || !safe(request.reason))
        return fail();
    const changedPlanHash = request.changedPlanHash ?? current.changedPlanHash;
    // Only a persisted owner receipt loaded by the server can satisfy closure;
    // a supplied matching plan hash is never an acknowledgement by itself.
    const receipt = request.acknowledgement;
    let acknowledged = false;
    if (receipt) {
        await validatePlanReceipt(receipt, now);
        acknowledged = receipt.kind === 'acknowledged' && receipt.ownerId === current.ownerId && receipt.planHash === changedPlanHash;
        if (!acknowledged)
            return fail();
    }
    if (current.previousHash === request.expectedHash && current.actorId === authority.session.subjectId &&
        current.state === request.next && current.reason === request.reason && current.communication === request.communication &&
        current.changedPlanHash === changedPlanHash && current.acknowledgementHash === (receipt?.contentHash ?? null) &&
        current.nonAcknowledgementReason === request.nonAcknowledgementReason)
        return log;
    if (current.contentHash !== request.expectedHash || !transitions[current.state].includes(request.next))
        return fail();
    if (closed(request.next) && (!safe(request.communication) ||
        (changedPlanHash !== null && (!/^[a-f0-9]{64}$/u.test(changedPlanHash) ||
            (!acknowledged && !safe(request.nonAcknowledgementReason))))))
        return fail();
    const body = { ...current, revision: current.revision + 1, previousHash: current.contentHash, state: request.next,
        actorId: authority.session.subjectId, recordedAt: now, reason: request.reason, communication: request.communication,
        acknowledgementHash: receipt?.contentHash ?? null, changedPlanHash,
        nonAcknowledgementReason: request.nonAcknowledgementReason,
        closedAt: closed(request.next) ? now : null };
    const { contentHash: _previous, ...payload } = body;
    return append(log, payload);
}
/** Storage readers must validate the whole retained chain, not just a mutable
 * latest-case pointer. No corrupt/future record is treated as an empty queue. */
export async function decodeReconciliation(value, ownerId, workspaceId) {
    value = structuredClone(value);
    if (!Array.isArray(value) || value.length > 5000 || new TextEncoder().encode(JSON.stringify(value)).length > 1_048_576)
        return fail();
    const cases = new Map();
    const result = [];
    const eventHashes = new Map();
    const optionalHash = (value) => value === null || typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
    const optionalText = (value) => value === null || safe(value);
    for (const row of value) {
        if (!row || Object.keys(row).sort().join(',') !== 'acknowledgementHash,actorId,caseId,category,changedPlanHash,closedAt,communication,contentHash,createdAt,events,grantVersion,groupAnchorAt,nonAcknowledgementReason,ownerId,planHash,previousCaseId,previousHash,reason,recordedAt,revision,schemaVersion,source,state,workspaceId' ||
            row.schemaVersion !== 1 || row.source !== 'professional-reconciliation' || row.ownerId !== ownerId || row.workspaceId !== workspaceId ||
            !uuid(row.caseId) || !Number.isSafeInteger(row.grantVersion) || row.grantVersion < 1 || !/^[a-f0-9]{64}$/u.test(row.planHash) ||
            !['change', 'concern', 'clarification'].includes(row.category) || !Object.hasOwn(transitions, row.state) || !safe(row.reason) || !safe(row.actorId) ||
            ![row.createdAt, row.recordedAt, row.groupAnchorAt].every(time => Number.isSafeInteger(time) && time >= 0 && time <= 8_640_000_000_000_000) || row.createdAt > row.groupAnchorAt || row.groupAnchorAt > row.recordedAt ||
            !Array.isArray(row.events) || !row.events.length || row.events.length > 1000 ||
            !optionalHash(row.changedPlanHash) || !optionalHash(row.acknowledgementHash) ||
            !optionalText(row.communication) || !optionalText(row.nonAcknowledgementReason) ||
            (row.acknowledgementHash !== null && row.changedPlanHash === null) ||
            (closed(row.state) && row.changedPlanHash !== null && row.acknowledgementHash === null && !safe(row.nonAcknowledgementReason)) ||
            (closed(row.state) ? row.closedAt !== row.recordedAt || !safe(row.communication) : row.closedAt !== null))
            return fail();
        const previous = cases.get(row.caseId);
        if (row.revision !== (previous?.revision ?? 0) + 1 || row.previousHash !== (previous?.contentHash ?? null) ||
            (row.previousCaseId !== null && !cases.has(row.previousCaseId)) ||
            (previous && (row.grantVersion !== previous.grantVersion || row.planHash !== previous.planHash || row.category !== previous.category ||
                row.createdAt !== previous.createdAt || row.events.length < previous.events.length || canonical(row.events.slice(0, previous.events.length)) !== canonical(previous.events))))
            return fail();
        if (!previous) {
            if (row.state !== 'new' || row.events.length !== 1 || row.createdAt !== row.recordedAt || row.groupAnchorAt !== row.recordedAt ||
                row.communication !== null || row.changedPlanHash !== null || row.acknowledgementHash !== null || row.nonAcknowledgementReason !== null)
                return fail();
            const linked = row.previousCaseId === null ? null : cases.get(row.previousCaseId);
            if (linked && (linked.planHash !== row.planHash || linked.grantVersion !== row.grantVersion || linked.category !== row.category || linked.recordedAt > row.recordedAt))
                return fail();
        }
        else {
            if (row.recordedAt < previous.recordedAt || row.previousCaseId !== previous.previousCaseId)
                return fail();
            if (row.events.length === previous.events.length) {
                if (!transitions[previous.state].includes(row.state) || row.groupAnchorAt !== previous.groupAnchorAt ||
                    (previous.changedPlanHash !== null && row.changedPlanHash === null))
                    return fail();
            }
            else {
                const grouping = !closed(previous.state) && row.recordedAt - previous.groupAnchorAt < 24 * 3600000;
                const reopening = previous.closedAt !== null && row.recordedAt - previous.closedAt <= 7 * 86400000;
                if (row.events.length !== previous.events.length + 1 || (!grouping && !reopening) ||
                    row.state !== (grouping ? previous.state === 'awaiting_client_ack' ? 'in_review' : previous.state : 'new') ||
                    row.groupAnchorAt !== (grouping ? previous.groupAnchorAt : row.recordedAt) ||
                    row.changedPlanHash !== (grouping ? previous.changedPlanHash : null) || row.communication !== null ||
                    row.acknowledgementHash !== null || row.nonAcknowledgementReason !== null)
                    return fail();
            }
        }
        const { contentHash, ...body } = row;
        if (contentHash !== await recordHash(body))
            return fail();
        const events = [];
        const seen = new Set();
        for (const event of row.events) {
            if (!event || Object.keys(event).sort().join(',') !== 'contentHash,detail,grantVersion,id,kind,ownerId,planHash,version,workspaceId' ||
                !uuid(event.id) || !Number.isSafeInteger(event.version) || event.version < 1 || event.ownerId !== ownerId || event.workspaceId !== workspaceId ||
                event.grantVersion !== row.grantVersion || event.planHash !== row.planHash || !MATERIAL_EVENTS.includes(event.kind) || !safe(event.detail))
                return fail();
            const { contentHash: hash, ...payload } = event;
            if (hash !== await recordHash(payload))
                return fail();
            const identity = canonical([event.id, event.version]);
            const category = event.kind === 'concern_reported' ? 'concern' : event.kind === 'clarification_requested' ? 'clarification' : 'change';
            const retainedEvent = eventHashes.get(identity);
            if (category !== row.category || seen.has(identity) || (retainedEvent && (retainedEvent.hash !== hash || retainedEvent.caseId !== row.caseId)) ||
                (retainedEvent && !previous?.events.some(item => item.id === event.id && item.version === event.version)))
                return fail();
            seen.add(identity);
            eventHashes.set(identity, { hash, caseId: row.caseId });
            events.push(Object.freeze({ ...event }));
        }
        const retained = Object.freeze({ ...row, events: Object.freeze(events) });
        cases.set(row.caseId, retained);
        result.push(retained);
    }
    return Object.freeze(result);
}
