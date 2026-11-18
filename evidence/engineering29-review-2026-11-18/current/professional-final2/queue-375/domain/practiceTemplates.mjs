import { canonical, recordHash } from './grants.mjs';
// Reusable practice-authored roles only: no owner IDs, bottle IDs, client notes,
// formula text or import-from-client capability enters this aggregate.
export const TEMPLATE_ROLES = ['cleanser', 'moisturizer', 'sun_protection', 'other'];
export const templateId = (v) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(v);
export const templateHash = (v) => typeof v === 'string' && /^[a-f0-9]{64}$/u.test(v);
const fail = () => { throw new Error('TEMPLATE_INVALID'); };
export const templateConflict = () => { throw new Error('TEMPLATE_CONFLICT'); };
const identifier = (v) => typeof v === 'string' && /^[A-Za-z0-9][A-Za-z0-9:_-]{0,127}$/u.test(v);
export function templateTitle(value) {
    return typeof value === 'string' && value.trim() === value && value.length > 0 && value.length <= 80 && !/[\p{Cf}\p{Cs}\u0000-\u001f\u007f-\u009f]/u.test(value);
}
export function templateRoles(value) {
    return Array.isArray(value) && value.length <= 20 && value.every(role => TEMPLATE_ROLES.includes(role));
}
export function decodeTemplateCommand(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        return fail();
    const c = value;
    const expected = c.kind === 'retire' ? 'confirmed,expectedHeadHash,id,kind,templateId' : 'am,confirmed,expectedHeadHash,id,kind,pm,templateId,title';
    if (Object.keys(c).sort().join(',') !== expected || !templateId(c.id) || !templateId(c.templateId) || c.confirmed !== true ||
        (c.expectedHeadHash !== null && !templateHash(c.expectedHeadHash)) || !['revise', 'retire'].includes(c.kind))
        return fail();
    if (c.kind === 'revise' && (!templateTitle(c.title) || !templateRoles(c.am) || !templateRoles(c.pm) || !c.am.length && !c.pm.length))
        return fail();
    return structuredClone(c);
}
export async function decodePracticeTemplates(value, workspaceId, now = 8.64e15) {
    const copied = structuredClone(value);
    if (!identifier(workspaceId) || !Array.isArray(copied) || copied.length > 600 || !Number.isFinite(now) || now < 0)
        return fail();
    const result = [], heads = new Map(), ids = new Set();
    for (const t of copied) {
        if (!t || Object.keys(t).sort().join(',') !== 'actorId,am,contentHash,createdAt,id,parentHash,pm,revision,schemaVersion,status,templateId,title,workspaceId' ||
            t.schemaVersion !== 1 || !templateId(t.id) || !templateId(t.templateId) || ids.has(t.id) || t.workspaceId !== workspaceId ||
            !identifier(t.actorId) || !templateTitle(t.title) || !templateRoles(t.am) || !templateRoles(t.pm) || !t.am.length && !t.pm.length ||
            !['active', 'retired'].includes(t.status) || !Number.isSafeInteger(t.revision) || t.revision < 1 || t.revision > (t.status === 'retired' ? 101 : 100) ||
            !Number.isSafeInteger(t.createdAt) || t.createdAt < (result.at(-1)?.createdAt ?? 0) || t.createdAt > Math.min(now, 8.64e15))
            return fail();
        const parent = heads.get(t.templateId);
        if (t.revision !== (parent?.revision ?? 0) + 1 || t.parentHash !== (parent?.contentHash ?? null) || parent?.status === 'retired' ||
            t.status === 'retired' && (!parent || canonical([t.title, t.am, t.pm]) !== canonical([parent.title, parent.am, parent.pm])))
            return fail();
        const { contentHash, ...body } = t;
        if (!templateHash(contentHash) || contentHash !== await recordHash(body))
            return fail();
        const record = Object.freeze({ ...t, am: Object.freeze([...t.am]), pm: Object.freeze([...t.pm]) });
        result.push(record);
        ids.add(t.id);
        heads.set(t.templateId, record);
    }
    if (heads.size > 100 || result.filter(t => t.status === 'active').length > 500)
        return fail();
    return Object.freeze(result);
}
export async function changePracticeTemplate(value, workspaceId, actorId, input, now) {
    const command = decodeTemplateCommand(input);
    const history = await decodePracticeTemplates(value, workspaceId, now);
    if (!identifier(actorId))
        return fail();
    const existing = history.find(t => t.id === command.id);
    if (existing) {
        if (existing.templateId !== command.templateId || existing.actorId !== actorId || existing.parentHash !== command.expectedHeadHash ||
            existing.status !== (command.kind === 'retire' ? 'retired' : 'active') || command.kind === 'revise' &&
            canonical([existing.title, existing.am, existing.pm]) !== canonical([command.title, command.am, command.pm]))
            return templateConflict();
        return history; // Exact historical retry certifies this revision only, never currentness.
    }
    const parent = history.filter(t => t.templateId === command.templateId).at(-1);
    if ((parent?.contentHash ?? null) !== command.expectedHeadHash || parent?.status === 'retired')
        return templateConflict();
    // Reserve one terminal retirement per template even at the authoring ceiling.
    if (command.kind === 'retire' && !parent || command.kind === 'revise' &&
        (history.filter(t => t.status === 'active').length >= 500 || (parent?.revision ?? 0) >= 100) ||
        !parent && new Set(history.map(t => t.templateId)).size >= 100)
        return fail();
    const content = command.kind === 'revise' ? command : parent;
    const body = { schemaVersion: 1, id: command.id, templateId: command.templateId, workspaceId,
        revision: (parent?.revision ?? 0) + 1, actorId, createdAt: now, parentHash: parent?.contentHash ?? null,
        status: command.kind === 'retire' ? 'retired' : 'active', title: content.title, am: content.am, pm: content.pm };
    return decodePracticeTemplates([...history, { ...body, contentHash: await recordHash(body) }], workspaceId, now);
}
