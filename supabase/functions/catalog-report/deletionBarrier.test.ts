function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function compact(value: string): string {
  return value.replace(/\s+/g, ' ');
}

Deno.test('catalog-report delegates OBF queueing to the deletion-aware RPC', async () => {
  const source = compact(await Deno.readTextFile(new URL('./index.ts', import.meta.url)));
  assert(
    source.includes("admin.rpc('enqueue_obf_contribution_for_correction', {"),
    'catalog-report must call the guarded OBF enqueue RPC.',
  );
  assert(
    source.includes('p_correction_id: correction.id'),
    'the guarded RPC must receive only the stored correction identity.',
  );
  assert(
    !source.includes("admin.from('obf_contribution_queue')"),
    'catalog-report must not mutate the contribution queue directly.',
  );
  const rpcArguments = source.match(
    /admin\.rpc\('enqueue_obf_contribution_for_correction', \{ ([^}]*) \}\)/,
  )?.[1];
  assert(
    rpcArguments === 'p_correction_id: correction.id,',
    'service queue ownership and payload must be derived inside the database.',
  );
});

Deno.test('catalog-report contains queue failures without exposing database details', async () => {
  const source = compact(await Deno.readTextFile(new URL('./index.ts', import.meta.url)));
  assert(
    source.includes("console.error('[catalog-report]', 'obf_contribution_enqueue_failed')"),
    'queue failures should use one stable log code.',
  );
  assert(!source.includes('console.error(enqueueError'), 'raw queue errors must not be logged.');
  assert(
    source.includes("return json({ result: 'reported', correction });"),
    'the correction-report response must remain successful when optional queueing is suppressed.',
  );
});
