import { customProGrantAllowed } from './customProGrantAdmission.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test('custom Pro grant admits only explicit development loopback projects', () => {
  for (const url of ['http://127.0.0.1:54321', 'http://localhost:54321/', 'http://[::1]:54321/']) {
    assert(customProGrantAllowed('development', url), `${url} should be admitted.`);
  }
});

Deno.test('custom Pro grant denies every hosted project even when mislabeled development', () => {
  for (const url of [
    'https://project.supabase.co',
    'https://staging-project.supabase.co/',
    'https://api.example.com:443/',
    'http://project.supabase.co:54321/',
  ]) {
    assert(!customProGrantAllowed('development', url), `${url} must be denied.`);
  }
});

Deno.test('custom Pro grant denies non-development and ambiguous local URLs', () => {
  for (const environment of ['staging', 'production'] as const) {
    assert(
      !customProGrantAllowed(environment, 'http://127.0.0.1:54321/'),
      `${environment} must be denied even on loopback.`,
    );
  }
  for (const url of [
    undefined,
    '',
    'not-a-url',
    'https://127.0.0.1:54321/',
    'http://127.0.0.1/',
    'http://0.0.0.0:54321/',
    'http://user:secret@127.0.0.1:54321/',
    'http://127.0.0.1:54321/rest/v1',
    'http://127.0.0.1:54321/?override=1',
  ]) {
    assert(!customProGrantAllowed('development', url), `${url ?? '<missing>'} must be denied.`);
  }
});

Deno.test(
  'subscription-grants checks local admission before authentication and grant authority',
  async () => {
    const source = await Deno.readTextFile(new URL('./index.ts', import.meta.url));
    const boundary = source.indexOf('if (!customProGrantAllowed(appEnvironment, supabaseUrl))');
    const authentication = source.indexOf('const token = bearerToken(req)');
    const grant = source.indexOf("supabase.rpc('grant_app_granted_reverse_trial'");
    assert(boundary >= 0, 'the server-side custom-grant boundary is missing.');
    assert(authentication > boundary, 'authentication must not precede the disabled-path refusal.');
    assert(
      grant > authentication,
      'the grant RPC must remain downstream of admission and authentication.',
    );
  },
);
