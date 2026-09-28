const normalizeSql = (value) =>
  String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const splitArgs = (args) =>
  String(args ?? '')
    .split(',')
    .map((arg) => arg.trim())
    .filter(Boolean);

const normalizeArg = (arg) => {
  const withoutDefault = arg.replace(/\s+default\s+[\s\S]+$/i, '').trim();
  if (!withoutDefault) return '';
  const tokens = withoutDefault.split(/\s+/).filter(Boolean);
  if (/^(in|out|inout|variadic)$/i.test(tokens[0] ?? '')) tokens.shift();
  if (tokens.length <= 1) return normalizeSql(tokens.join(' '));
  return normalizeSql(tokens.slice(1).join(' '));
};

export const normalizeFunctionArgs = (args) => splitArgs(args).map(normalizeArg).join(', ');

export const publicFunctionKey = (name, args) =>
  `${String(name).toLowerCase()}(${normalizeFunctionArgs(args)})`;

function roleNames(value) {
  return String(value ?? '')
    .split(',')
    .map(normalizeSql)
    .filter(Boolean);
}

function collectEvents(sql) {
  const events = [];
  const collect = (pattern, kind, toEvent) => {
    for (const match of sql.matchAll(pattern)) {
      events.push({
        index: match.index ?? 0,
        kind,
        ...toEvent(match),
      });
    }
  };

  collect(
    /create\s+(or\s+replace\s+)?function\s+public\.([a-z0-9_]+)\s*\(([^)]*)\)([\s\S]*?)\$\$;/gi,
    'create',
    (match) => ({
      replace: Boolean(match[1]),
      name: match[2],
      args: match[3],
      definition: match[4],
      source: match[0],
    }),
  );
  collect(
    /drop\s+function\s+(?:if\s+exists\s+)?public\.([a-z0-9_]+)\s*\(([^)]*)\)\s*;/gi,
    'drop',
    (match) => ({ name: match[1], args: match[2] }),
  );
  collect(
    /alter\s+function\s+public\.([a-z0-9_]+)\s*\(([^)]*)\)\s+rename\s+to\s+([a-z0-9_]+)\s*;/gi,
    'rename',
    (match) => ({ name: match[1], args: match[2], nextName: match[3] }),
  );
  collect(
    /revoke\s+(?:all|execute)\s+on\s+function\s+public\.([a-z0-9_]+)\s*\(([^)]*)\)\s+from\s+([^;]+);/gi,
    'revoke',
    (match) => ({ name: match[1], args: match[2], roles: roleNames(match[3]) }),
  );
  collect(
    /grant\s+execute\s+on\s+function\s+public\.([a-z0-9_]+)\s*\(([^)]*)\)\s+to\s+([^;]+);/gi,
    'grant',
    (match) => ({ name: match[1], args: match[2], roles: roleNames(match[3]) }),
  );

  return events.sort((left, right) => left.index - right.index);
}

/**
 * Model the installed public function catalog and effective API-role ACLs in
 * migration order. PostgreSQL preserves a function ACL across CREATE OR
 * REPLACE and ALTER FUNCTION ... RENAME TO, while a genuinely new function
 * starts executable by PUBLIC. The lint must model those semantics or a
 * renamed implementation can retain a client grant outside the allowlist.
 */
export function publicFunctionCatalog(sqlSource) {
  const sql = String(sqlSource ?? '');
  const functions = new Map();
  const unresolvedPrivilegeEvents = [];
  const unresolvedRenameEvents = [];

  for (const event of collectEvents(sql)) {
    const key = publicFunctionKey(event.name, event.args);

    if (event.kind === 'create') {
      const existing = functions.get(key);
      const effectiveGrantRoles =
        event.replace && existing ? new Set(existing.effectiveGrantRoles) : new Set(['public']);
      functions.set(key, {
        name: event.name,
        args: event.args,
        normalizedArgs: normalizeFunctionArgs(event.args),
        source: event.source,
        definition: event.definition,
        index: event.index,
        effectiveGrantRoles,
        privilegeEventsAfterDefinition: [],
      });
      continue;
    }

    if (event.kind === 'drop') {
      functions.delete(key);
      continue;
    }

    if (event.kind === 'rename') {
      const existing = functions.get(key);
      if (!existing) {
        unresolvedRenameEvents.push(event);
        continue;
      }
      functions.delete(key);
      existing.name = event.nextName;
      functions.set(publicFunctionKey(event.nextName, event.args), existing);
      continue;
    }

    const existing = functions.get(key);
    if (!existing) {
      unresolvedPrivilegeEvents.push(event);
      continue;
    }
    existing.privilegeEventsAfterDefinition.push(event);
    for (const role of event.roles) {
      if (event.kind === 'grant') existing.effectiveGrantRoles.add(role);
      else existing.effectiveGrantRoles.delete(role);
    }
  }

  return { functions, unresolvedPrivilegeEvents, unresolvedRenameEvents };
}
