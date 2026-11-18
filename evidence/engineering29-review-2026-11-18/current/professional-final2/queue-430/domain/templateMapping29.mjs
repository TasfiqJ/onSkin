import { templateId, templateHash, TEMPLATE_ROLES } from './practiceTemplates.mjs';
const fail = (reason = 'INVALID') => { throw new Error(`TEMPLATE_MAPPING_${reason}`); };
const productId = (v) => typeof v === 'string' && !!v.trim() && v.length <= 128 && !/[\p{Cf}\p{Cs}\u0000-\u001f\u007f-\u009f]/u.test(v);
function keys(v, expected) {
    if (!v || typeof v !== 'object' || Array.isArray(v) || Object.keys(v).sort().join(',') !== expected)
        fail();
}
export function decodeTemplateMapping(value) {
    const v = structuredClone(value);
    keys(v, 'am,pm,revisionHash,revisionId');
    if (!templateId(v.revisionId) || !templateHash(v.revisionHash))
        return fail();
    for (const phase of ['am', 'pm']) {
        const rows = v[phase];
        if (!Array.isArray(rows) || rows.length > 20)
            return fail();
        for (const row of rows) {
            keys(row, row?.kind === 'product' ? 'kind,productId' : 'kind');
            if (!['product', 'omit', 'unresolved', 'unshelved'].includes(row.kind) || row.kind === 'product' && !productId(row.productId))
                return fail();
        }
    }
    return v;
}
/** A hash/shape is integrity, never ownership or professional authority. Call
 * only with decoded practice history and the current trusted product source.
 * Unresolved/unshelved roles have no product identity and cannot be issued. */
export function mapTemplateRevision(history, input, products) {
    const mapping = decodeTemplateMapping(input);
    const selected = history.find(t => t.id === mapping.revisionId && t.contentHash === mapping.revisionHash && t.status === 'active');
    if (!selected || history.filter(t => t.templateId === selected.templateId).at(-1)?.status !== 'active')
        return fail('CHANGED');
    if (!Array.isArray(products) || new Set(products.map(p => p.productId)).size !== products.length)
        return fail();
    const am = [], pm = [];
    const origin = { am: [], pm: [] };
    for (const phase of ['am', 'pm']) {
        if (mapping[phase].length !== selected[phase].length)
            return fail();
        const result = phase === 'am' ? am : pm;
        for (const [index, choice] of mapping[phase].entries()) {
            if (choice.kind === 'unresolved' || choice.kind === 'unshelved')
                return fail('UNRESOLVED');
            const product = choice.kind === 'product' ? products.find(p => p.productId === choice.productId) : null;
            if (choice.kind === 'product' && (!product || result.some(p => p.productId === product.productId)))
                return fail('CHANGED');
            if (product)
                result.push({ ...product });
            origin[phase].push({ role: selected[phase][index], productId: product?.productId ?? null });
        }
    }
    if (!am.length && !pm.length)
        return fail('UNRESOLVED');
    const templateOrigin = { templateId: selected.templateId, revisionId: selected.id,
        revisionHash: selected.contentHash, revision: selected.revision, ...origin };
    return { am, pm, templateOrigin: validateTemplateOrigin(templateOrigin, { am, pm }) };
}
/** Retained provenance is checked without rereading a retired practice. It
 * records the exact original selection; it confers no new access or safety. */
export function validateTemplateOrigin(value, sequence) {
    const v = structuredClone(value);
    keys(v, 'am,pm,revision,revisionHash,revisionId,templateId');
    if (!templateId(v.templateId) || !templateId(v.revisionId) || !templateHash(v.revisionHash) ||
        !Number.isSafeInteger(v.revision) || v.revision < 1 || v.revision > 100)
        return fail();
    let total = 0;
    for (const phase of ['am', 'pm']) {
        const rows = v[phase];
        if (!Array.isArray(rows) || rows.length > 20)
            return fail();
        const ids = [];
        for (const row of rows) {
            keys(row, 'productId,role');
            if (!TEMPLATE_ROLES.includes(row.role) || row.productId !== null && !productId(row.productId))
                return fail();
            if (row.productId !== null)
                ids.push(row.productId);
        }
        if (new Set(ids).size !== ids.length || JSON.stringify(ids) !== JSON.stringify(sequence[phase].map(p => p.productId)))
            return fail();
        total += ids.length;
    }
    if (!total)
        return fail();
    return Object.freeze({ ...v, am: Object.freeze(v.am.map(r => Object.freeze(r))),
        pm: Object.freeze(v.pm.map(r => Object.freeze(r))) });
}
export function templateOriginLines(plan) {
    return plan.templateOrigin ? [`Started from practice template revision ${plan.templateOrigin.revision} (${plan.templateOrigin.revisionId}).`,
        ...['am', 'pm'].map(phase => `${phase === 'am' ? 'Morning' : 'Evening'} template roles: ${plan.templateOrigin[phase].map((r, i) => `${i + 1}. ${r.role.replaceAll('_', ' ')} (${r.productId === null ? 'explicitly omitted' : 'mapped to recorded product'})`).join('; ') || 'No roles'}.`)] : [];
}
