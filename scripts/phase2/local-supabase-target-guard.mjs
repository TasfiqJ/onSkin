const EXPLICIT_LOCAL_COMMANDS = new Set([
  'db diff',
  'db lint',
  'db reset',
  'gen types',
  'migration list',
  'test db',
]);
const ALLOWED_COMMAND_KEYS = new Set([...EXPLICIT_LOCAL_COMMANDS, 'start', 'stop']);
const FORBIDDEN_TARGET_FLAGS = new Set([
  '--access-token',
  '--db-url',
  '--from',
  '--linked',
  '--password',
  '--project-id',
  '--project-ref',
  '--to',
]);

function hasFlag(args, flag) {
  return args.some((value) => value === flag || value.startsWith(`${flag}=`));
}

export function assertLocalOnlyInvocation(label, args) {
  const commandKey = ['start', 'stop'].includes(args[0]) ? args[0] : args.slice(0, 2).join(' ');
  if (!ALLOWED_COMMAND_KEYS.has(commandKey)) {
    throw new Error(`${label} attempted a command outside the local-only allowlist.`);
  }
  if ([...FORBIDDEN_TARGET_FLAGS].some((flag) => hasFlag(args, flag))) {
    throw new Error(`${label} attempted to use a remote-capable target flag.`);
  }
  if (hasFlag(args, '--workdir')) {
    throw new Error(`${label} attempted to replace the sandbox workdir.`);
  }
  if (EXPLICIT_LOCAL_COMMANDS.has(commandKey) && !args.includes('--local')) {
    throw new Error(`${label} must pass the explicit --local target guard.`);
  }
}
