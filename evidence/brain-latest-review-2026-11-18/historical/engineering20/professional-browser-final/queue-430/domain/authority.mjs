/** Universal domain rules. Inputs MUST come from the authenticated server's
 * current transaction; JSON/client flags never establish these authorities. */
export const ROLE_ACTIONS = {
    personal_read_write_export_delete: ['consumer_owner'],
    workspace_membership_role_assign: ['workspace_owner'],
    workspace_billing_manage: ['workspace_owner', 'billing_admin'],
    workspace_owner_transfer: ['workspace_owner'],
    template_author_issue: ['assigned_practitioner'],
    client_projection_read: ['assigned_practitioner'],
    client_plan_issue_respond_export: ['assigned_practitioner'],
    task_assign: ['workspace_owner', 'assigned_practitioner'],
    task_alias_status: ['workspace_owner', 'restricted_assistant', 'assigned_practitioner'],
    task_reassignment_request: ['restricted_assistant', 'assigned_practitioner'],
    task_health_details: ['assigned_practitioner'],
    content_free_support_metadata: ['software_support'],
};
export const GRANT_FIELDS = ['products', 'formulas', 'actual_routine', 'use_events', 'exceptions', 'intended_plans'];
export const GRANT_PURPOSES = ['routine_review', 'pre_visit'];
const contentActions = new Set(['client_projection_read', 'client_plan_issue_respond_export', 'task_health_details']);
function uniqueAllowed(values, allowed) {
    return Array.isArray(values) && new Set(values).size === values.length && values.every(value => allowed.includes(value));
}
function time(value, now) { return Number.isFinite(value) && value >= 0 && value <= now; }
function id(value) { return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9:_-]{0,127}$/u.test(value); }
export function validGrant(grant) {
    return !!grant && Object.keys(grant).sort().join(',') === 'consentReceiptId,epoch,expiresAt,fields,healthEpoch,id,ownerId,permissions,purposes,status,version,workspaceId' &&
        id(grant.id) && id(grant.ownerId) && id(grant.workspaceId) && id(grant.consentReceiptId) &&
        Number.isSafeInteger(grant.version) && grant.version > 0 && Number.isSafeInteger(grant.epoch) && grant.epoch > 0 &&
        Number.isFinite(grant.expiresAt) && grant.expiresAt > 0 && ['active', 'revoked'].includes(grant.status) &&
        Number.isSafeInteger(grant.healthEpoch) && grant.healthEpoch > 0 &&
        uniqueAllowed(grant.fields, GRANT_FIELDS) && grant.fields.length > 0 &&
        uniqueAllowed(grant.purposes, GRANT_PURPOSES) && grant.purposes.length > 0 &&
        Array.isArray(grant.permissions) && grant.permissions.includes('read') &&
        uniqueAllowed(grant.permissions, ['read', 'plan_write', 'export']);
}
/** Denial is content-free. Admin ownership, catalog roles and Plus never confer
 * access to client text. Unknown action/field/purpose denies by default. */
export function accessDenial(authority, request, now) {
    if (!request || !Object.hasOwn(ROLE_ACTIONS, request.action) || !Number.isFinite(now) || now < 0 ||
        !uniqueAllowed(request.fields, GRANT_FIELDS) || !['read', 'write', 'export'].includes(request.operation))
        return 'invalid_request';
    if ((['client_projection_read', 'task_health_details', 'task_alias_status', 'content_free_support_metadata'].includes(request.action) && request.operation !== 'read') ||
        (['template_author_issue', 'workspace_membership_role_assign', 'workspace_owner_transfer', 'task_assign', 'task_reassignment_request'].includes(request.action) && request.operation !== 'write'))
        return 'invalid_request';
    const s = authority?.session;
    if (!s || !id(s.subjectId) || s.revoked || !s.adult || !Number.isSafeInteger(s.epoch) || s.epoch < 1 ||
        !time(s.startedAt, now) || !time(s.lastActivityAt, now) || s.lastActivityAt < s.startedAt ||
        now - s.startedAt >= 8 * 60 * 60_000 || now - s.lastActivityAt >= 15 * 60_000)
        return 'session';
    if (request.action === 'personal_read_write_export_delete') {
        return id(s.ownerId) && s.ownerId === request.ownerId && request.workspaceId === null &&
            request.fields.length === 0 && request.purpose === null ? null : 'role';
    }
    const membership = authority.membership;
    if (!membership || !membership.active || membership.subjectId !== s.subjectId ||
        membership.workspaceId !== request.workspaceId || s.workspaceId !== request.workspaceId ||
        !Number.isSafeInteger(membership.revision) || membership.revision < 1 || s.aal !== 2 || !s.totp)
        return 'membership';
    const allowed = ROLE_ACTIONS[request.action];
    if (!membership.roles.some(role => allowed.includes(role)))
        return 'role';
    const sensitive = request.operation === 'export' || ['workspace_membership_role_assign', 'workspace_billing_manage', 'workspace_owner_transfer'].includes(request.action);
    if (sensitive && (s.stepUpAt === null || !time(s.stepUpAt, now) || s.stepUpAt < s.startedAt || now - s.stepUpAt >= 5 * 60_000))
        return 'step_up';
    if (!contentActions.has(request.action)) {
        // Alias/workflow metadata is a distinct projection. Fields cannot smuggle
        // ingredients, notes or images into an assistant/admin response.
        if (request.fields.length || request.purpose !== null)
            return 'invalid_request';
        if (request.action === 'template_author_issue' && !currentLicence(authority, now))
            return 'licence';
        if (request.action === 'template_author_issue' && authority.billing !== 'write_allowed')
            return 'billing';
        return null;
    }
    const assignment = authority.assignment;
    if (!assignment?.active || assignment.subjectId !== s.subjectId || assignment.workspaceId !== request.workspaceId || assignment.ownerId !== request.ownerId)
        return 'assignment';
    if (!currentLicence(authority, now))
        return 'licence';
    const grant = authority.grant;
    if (!grant || !validGrant(grant) || grant.status !== 'active' || grant.workspaceId !== request.workspaceId ||
        grant.ownerId !== request.ownerId || grant.version !== request.grantVersion || grant.epoch !== request.grantEpoch ||
        grant.expiresAt <= now || !request.fields.length || request.purpose === null || !grant.purposes.includes(request.purpose) ||
        request.fields.some(field => !grant.fields.includes(field)) || !grant.permissions.includes('read') ||
        (request.operation === 'export' && !grant.permissions.includes('export')) ||
        (request.operation === 'write' && !grant.permissions.includes('plan_write')))
        return 'grant';
    if (request.operation === 'write' && (request.action !== 'client_plan_issue_respond_export' || request.fields.some(field => field !== 'intended_plans')))
        return 'role';
    const health = authority.health;
    if (!health?.active || health.deletionPending || health.ownerId !== grant.ownerId || health.epoch !== grant.healthEpoch || health.consentReceiptId !== grant.consentReceiptId)
        return 'health';
    if (request.operation === 'write' && authority.billing !== 'write_allowed')
        return 'billing';
    return null;
}
function currentLicence(authority, now) {
    const licence = authority.licence;
    return !!licence && licence.subjectId === authority.session.subjectId && licence.jurisdiction === 'CA' &&
        time(licence.verifiedAt, now) && Number.isFinite(licence.expiresAt) && licence.expiresAt > now && now - licence.verifiedAt < 365 * 24 * 60 * 60_000;
}
export class ProfessionalAccessError extends Error {
    reason;
    constructor(reason) {
        super(`PROFESSIONAL_ACCESS_${reason.toUpperCase()}`);
        this.reason = reason;
    }
}
function authorityRevision(authority) {
    return JSON.stringify([authority.session.subjectId, authority.session.epoch, authority.session.ownerId, authority.session.workspaceId, authority.session.startedAt,
        authority.membership, authority.assignment, authority.licence, authority.grant, authority.health, authority.billing]);
}
/** Request-time admission and final server-time admission. Only the final
 * transaction's projection may be serialized, never an earlier private read. */
export async function publishProfessional(repository, token, request, now, project) {
    if (!repository)
        throw new ProfessionalAccessError('unavailable');
    // Copy immediately; external mutation cannot broaden the admitted request.
    const captured = Object.freeze({ ...request, fields: Object.freeze([...request.fields]) });
    const initial = await repository.readAuthority(token, captured);
    const denial = accessDenial(initial, captured, now());
    if (denial)
        throw new ProfessionalAccessError(denial);
    const revision = authorityRevision(initial);
    return repository.publishWithCurrentAuthority(token, captured, (current, serverNow) => {
        const denied = accessDenial(current, captured, serverNow);
        if (denied)
            throw new ProfessionalAccessError(denied);
        if (authorityRevision(current) !== revision)
            throw new ProfessionalAccessError('changed');
        return project(current);
    });
}
