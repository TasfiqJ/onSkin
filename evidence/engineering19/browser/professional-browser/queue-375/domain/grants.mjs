import { validGrant } from './authority.mjs';
const fail = () => { throw new Error('PROFESSIONAL_GRANT_REFUSED'); };
export function canonical(value) {
    if (value === null || typeof value !== 'object')
        return JSON.stringify(value);
    if (Array.isArray(value))
        return `[${value.map(canonical).join(',')}]`;
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
}
export async function recordHash(value) {
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical(value)));
    return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}
function frozenGrant(grant) {
    return grant ? Object.freeze({ ...grant, fields: Object.freeze([...grant.fields]),
        purposes: Object.freeze([...grant.purposes]), permissions: Object.freeze([...grant.permissions]) }) : null;
}
export function emptyGrants(ownerId) {
    if (!/^[A-Za-z0-9][A-Za-z0-9:_-]{0,127}$/u.test(ownerId))
        return fail();
    return Object.freeze({ ownerId, revision: 0, epoch: 0, active: null, events: Object.freeze([]) });
}
/** Run in one serializable owner-row transaction. One pointer and append-only
 * receipts represent both revocation and acceptance; failure cannot create two
 * active grants. No credentials, invitation, Plus or staff flag can call this
 * on behalf of an owner. Revoke remains available after health withdrawal. */
export async function transitionGrant(state, authority, command, now) {
    if (!authority.current || !authority.adult || authority.deletionPending || authority.ownerId !== state.ownerId ||
        !authority.actorId || !Number.isFinite(now) || now < 0 || now > 8.64e15 || now < (state.events.at(-1)?.recordedAt ?? 0) || !command.confirmed ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(command.id) ||
        !Number.isSafeInteger(command.expectedRevision) || command.expectedRevision < 0 || !['accept', 'switch', 'revoke'].includes(command.kind))
        return fail();
    // Snapshot caller-owned objects before the asynchronous hash; exact retry is
    // compared to the original event, not reconstructed from current pointers.
    const captured = { ...command, grant: frozenGrant(command.grant) };
    const existing = state.events.find(event => event.id === captured.id);
    if (existing) {
        if (existing.sequence !== captured.expectedRevision + 1 || existing.actorId !== authority.actorId ||
            existing.kind !== captured.kind || existing.previousGrantId !== captured.previousGrantId || canonical(existing.grant) !== canonical(captured.grant))
            return fail();
        return state;
    }
    if (state.revision !== captured.expectedRevision || state.events.length !== state.revision || state.events.length >= 1000 ||
        captured.previousGrantId !== (state.active?.id ?? null))
        return fail();
    if ((captured.kind === 'accept' && state.active !== null) || (captured.kind !== 'accept' && state.active === null))
        return fail();
    const epoch = state.epoch + 1;
    if (captured.kind === 'revoke') {
        if (captured.grant !== null)
            return fail();
    }
    else {
        const grant = captured.grant;
        if (!grant || !validGrant(grant) || grant.ownerId !== state.ownerId || grant.status !== 'active' ||
            grant.epoch !== epoch || grant.healthEpoch !== authority.healthEpoch || grant.consentReceiptId !== authority.consentReceiptId ||
            grant.expiresAt <= now || grant.version !== state.revision + 1 || state.events.some(event => event.grant?.id === grant.id) ||
            (captured.kind === 'switch' && grant.workspaceId === state.active?.workspaceId))
            return fail();
    }
    const body = { schemaVersion: 1, id: captured.id, ownerId: state.ownerId, actorId: authority.actorId,
        recordedAt: now, source: 'owner-explicit-server', sequence: state.revision + 1,
        previousHash: state.events.at(-1)?.contentHash ?? null, kind: captured.kind,
        previousGrantId: captured.previousGrantId, grant: captured.grant };
    const event = Object.freeze({ ...body, contentHash: await recordHash(body) });
    return Object.freeze({ ownerId: state.ownerId, revision: event.sequence, epoch, active: captured.grant,
        events: Object.freeze([...state.events, event]) });
}
/** Strict persisted read: replay each receipt instead of trusting a mutable
 * active pointer, recorded hash, owner ID or a partially written switch. */
export async function decodeGrants(value, ownerId, latestTime = 8.64e15) {
    value = structuredClone(value);
    if (!value || typeof value !== 'object' || !Number.isFinite(latestTime) || latestTime < 0)
        return fail();
    const candidate = value;
    if (Object.keys(candidate).sort().join(',') !== 'active,epoch,events,ownerId,revision' || candidate.ownerId !== ownerId ||
        !Array.isArray(candidate.events) || candidate.events.length > 1000)
        return fail();
    let state = emptyGrants(ownerId);
    for (const event of candidate.events) {
        if (!event || Object.keys(event).sort().join(',') !== 'actorId,contentHash,grant,id,kind,ownerId,previousGrantId,previousHash,recordedAt,schemaVersion,sequence,source' || event.recordedAt > latestTime)
            return fail();
        state = await transitionGrant(state, { ownerId, actorId: event.actorId,
            healthEpoch: event.grant?.healthEpoch ?? 1, consentReceiptId: event.grant?.consentReceiptId ?? 'historical-revoke',
            current: true, adult: true, deletionPending: false }, { id: event.id, expectedRevision: state.revision,
            kind: event.kind, previousGrantId: event.previousGrantId, grant: event.grant, confirmed: true }, event.recordedAt);
        if (canonical(state.events.at(-1)) !== canonical(event))
            return fail();
    }
    if (canonical(state) !== canonical(candidate))
        return fail();
    return state;
}
