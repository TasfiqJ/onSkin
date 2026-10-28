import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import {
  CANONICAL_POSTGRES24 as PIN,
  assertCanonicalPostgres24,
  isCanonicalPostgresMirrorQuota24,
  isCanonicalPostgresQuota24,
  prepareCanonicalPostgresMirror24,
  verifyCanonicalPostgres24,
} from './canonical-postgres-mirror24.mjs';

// Actual ordered native RootFS lists from independently SHA-verified official OCI configs.
const ROOTFS24 = {
  "amd64": [
    "sha256:470b66ea5123c93b0d5606e4213bf9e47d3d426b640d32472e4ac213186c4bb6",
    "sha256:b6e2197f00e50b9665aae081e67acfe3dbd051eb9413672e1ff5ea700ae90f3c",
    "sha256:c09a9b5ed386bc42732dc2319fac35557355f4533a150364d3bd21c3ad84868b",
    "sha256:017110817c979e807d7688b3c8ab03b93c55f569e0e9f27ede3c1557930df8f6",
    "sha256:e43afc0ac409e5309e738b8ccb5235280a9f9e26aad1466ebe87da19f6a088ee",
    "sha256:f07f8bb27edf04c5e12eddc45e67bbab0e87363b30d3094e26fed7595a53dc07",
    "sha256:5f70bf18a086007016e948b04aed3b82103a36bea41755b6cddfaf10ace3c6ef",
    "sha256:59a5b99caa78eb10d4dceb284a477afa8a228a0dffcdbd501e04b45996538568",
    "sha256:76e0be0679713dfa336ea75971a796597672b778b5be12cd202eed42b0017819",
    "sha256:01ca161b2ec425663ae0d70602349b1949ab6263e8e70793dca683f0b0f5e295",
    "sha256:de98cb8f18b6cddd830785467ef23d95516aa5814964d655389c9a5278d84dfe",
    "sha256:6b3da943a4e1a50526e9b71c79d9e133a769a5978df20b1fbe4562100dfe5fc3",
    "sha256:80dcbcc53a159e898d6a4bb9bc54698594252187700d9c0b11fedb564c520634",
    "sha256:eeeb2d6d39c6ed7ff70698337ba74186c2ccb4c2ae662af326fe1373f31dda76",
    "sha256:c9c64e98535e8ef5aa081357f544d8d5423d3fe69e1a096d5f5a0564034b3df0",
    "sha256:9672a7c428b30ec3d7be3fd8483fc896812d388bf1fa3b5c9e0a790571b6160c",
    "sha256:cf87b5ca278bcfe3017c52d440cf9edbfdf5d1b5fd35c40d35e1b39e0adf680d",
    "sha256:1825789ccc02d85672acecfc529c11681e7b34f984dc2281bc060ca1221df4cf",
    "sha256:210b54e83b987f69b08a0a20a378defdebad76ce9a957138707ebc41a04225f1",
    "sha256:81e4e1e6e1f0216084c011e94b5519ae7dcaead67ce087c41bd7945f90399903",
    "sha256:5867abf149c3a0fc0f7983bf5190ed0df7b4330e55ed5049b619ea4d202f166a",
    "sha256:8d0e9479208d95f93d997231f0e1248e4e1518511e4eff88577d152766053392",
    "sha256:fae81ca8fe347e3140807e2ad6f1bd0d8e8d3e1ec3e99be20fdd8939ebbc196d",
    "sha256:4363e80fb34dca58b984527c3cb4cffb3227f0f4ce89942cf029ef4227d2524a",
    "sha256:fa2804a68d1996ffd1e8436d88295cbb451ea6ae54c7ea86cbebb5c2153b5925",
    "sha256:5f70bf18a086007016e948b04aed3b82103a36bea41755b6cddfaf10ace3c6ef",
    "sha256:ad4966883352af465a463efb4e84ba885f2a129125f59dec23b6ed1d22742d23",
    "sha256:14709c88ae4efe600a3e9c2f25eb69703753d10defb814f1b90f532178449199",
    "sha256:9b5d8e33d5112c19e0cd7ce15fa1a8b2f4b89ca34cbf78a4601bbd685b169df4",
    "sha256:e5117cf3d9c760680437f5c021e93fa1d1e9284b3e196b6b60ac3adb3081e4d0",
    "sha256:4f54d8fcb3113cb5886032cdc0953063e52ee2e33e7e100d9dc1d7f111451aec",
    "sha256:07dbb7b679fd9bc1380d93b4108dcb756a8e879388212d53fe9f9da15a2c8ec9",
    "sha256:b3d816aaf629f11779ba9a06a85222dfa36869b67ac1b4d6333824f013a63d46",
    "sha256:5b245808289fb815ffe29b485718b82c4e7f2c8bb62b931b90a7c259c10e8ac9",
    "sha256:df89175d16d6760950a6f9b2bcf9bdb52d31705a54bd3e3040239026730e43d7",
    "sha256:3bddee82065377077a0db441a4b438944bfd12d1bf07fdc07f0b71d82639aa89",
    "sha256:15def40a742f977ce5c5e2b810ed447782a7fc4374f92c5c1654de26a57f15c0",
    "sha256:513f39d1199f48c7dab8f2793dbd2167bc844d12c56a5010b05fb09bde960c48",
    "sha256:cf639c6756e65f72a70f51ef8d54f332b6cd7ef86ef12d92eadb6eb71728c4f7",
    "sha256:58d2b0a305a6542fa941b88eb164f042f0c911457e6c0baa49b3887bb7a45ca7",
    "sha256:67578439feffdb72ea5c21fb80fa60c610c09bfa42acc64c3911731f4ec1b927",
    "sha256:6d0d62bc18b28a0c386dadd496769bb23e8863bfb306bfc6bd2b477f076f1551",
    "sha256:5f70bf18a086007016e948b04aed3b82103a36bea41755b6cddfaf10ace3c6ef",
    "sha256:4af4705cfafe1f8a0cfa0ad81ffacfb6e818cf6c47f2a2b165f752de1578dee3",
    "sha256:3fd50a5636a7fe1de5bf2d4d7bf80aeba30832a1d8c445b0493282b75eeef3b6",
    "sha256:495fb7234f0d873b04cb41a79cec9dcf11976a1d4f3fefe0075f438bba80420a",
    "sha256:952b7103722428bd5e776160c91a58a86a2996484f2da051c4a74eecd21aa18f",
    "sha256:66543f367770f2208ed558d7a8141f4cd3aadf5faccc4f81863ada34050550dc"
  ],
  "arm64": [
    "sha256:37250a17e932419f4b54e624c819baf38c0025e7f9c4ba0e15af15f14a3d74c3",
    "sha256:0830d82a9b33234cf918eee2715bfbda107e52094541c564ff1ec0cd2839b808",
    "sha256:11fd1bf76af1938bf3b2c48d8f6ea1fd95033f210f7cfaf9beacde803936bcdd",
    "sha256:da9b8aea05afa4f835a4fe67ed87d8d0c3423a69dfb0c605ed0f0a681b1cbb8d",
    "sha256:43475f19b4e7aa281033972a47a3fc224a35d0473dc33b1243fd87b877969f95",
    "sha256:eecb2066d5804aa1b30161b39c4084a54417cec43d33cac3a76adc1c7d466cc3",
    "sha256:5f70bf18a086007016e948b04aed3b82103a36bea41755b6cddfaf10ace3c6ef",
    "sha256:a365602b08be2d706bd3e9911b6a27d8fd70dfa126e05b55957cce9040540ce6",
    "sha256:b88241a8066e92ef8bfdf3ad1fd46fa7c08fb0e3fcb74ea4c0643e2860a7c0c9",
    "sha256:4d0c24671cf6bd39e9b0753d7908e6ae33459f196c2ae0aa1263f3f1b0bfead0",
    "sha256:6a657c643a0d6dfba748cdfabcc5dd9dbde450c999521540479eade5d462cab5",
    "sha256:e52cb4a2c80a57fc9fa7049b8711fd5ecac0b21ac1917e28f05a21a7d3376869",
    "sha256:65063a15ce804c6b4c0ac1532c55d57b7507b837bc77ba5f064c92fbf7308a1b",
    "sha256:e9d0a1b787ad820f678da91bc1e7be8f7d11e44144b68ed8fe04f4a617180ed7",
    "sha256:cb541ebeba03c146ec2e23cf9dba408753d2a16a823dfed02fa8de53a9eaae83",
    "sha256:4c9757d84350f6d7c72981dff4b779afa265c4daf02287d99d6cc41dd0b6c55b",
    "sha256:83252314f31bbaa8d9def5432ac40f0278b45c85168a55b0ecc1f9126bf9a875",
    "sha256:72b8c7158ec9092de5dd01b091dce76b0577b953aa2343e287e443e8faef37c4",
    "sha256:a50cb82dfa32689f11e4eea52bdd324abdb8186036ad563e37ad4dfbad3530b8",
    "sha256:d2e563d30c6c25a2fd7fc637167743a287bc4463f9a53cf03be2e08fb9da1dc3",
    "sha256:28c2a01b752d699bcc246eb4164770c6b7719145dd6ec50946a374034bbceb54",
    "sha256:f01b0d587fdaa59b21a18235b22773197b26e27ef681f7d1a42e35e9005ecbd3",
    "sha256:fa614852b25f3e34974cc891cc7c5c902bec1471c0bd2e6a5133c7b58237e95d",
    "sha256:18e004042c57f880210b6de3db47dfc5debf1632699bcada52d27d31f8e8bc26",
    "sha256:3d0a620d517e515adaa581edfe19b0a4c13c62fb0914805046a48ef46eb08708",
    "sha256:5f70bf18a086007016e948b04aed3b82103a36bea41755b6cddfaf10ace3c6ef",
    "sha256:c3785cade5450a6d104f805f50d12f1f14f87abf8e034b1a44179ad7c7244553",
    "sha256:b76a352aa3c636b72cf9522f25e74d0828213e3c465e44927db0ce5652a46b97",
    "sha256:efdce57ae608a8e84df99ccfc173e3ed238d58d6774f3dddc75324c19fdeb3e2",
    "sha256:c042ff59ae60d70e254be94221c7e477d68d96e2f2812057297b3c858ebb96f8",
    "sha256:3bc8561cddcfc7e04da11064169596e02aa3a48f2dea0e89e7ad6149dc284537",
    "sha256:3d1e5b73108204407e2806a7762d459c882b78a58abbda510ba5841990488c4c",
    "sha256:48e2b68ce916945c766fbb78b21632e107cf53a6f02b828181f477919bc46909",
    "sha256:25d6a64e6c2e7d5458b92dd067430fef34d16d28f6356fb5bfd01daa50a930ac",
    "sha256:d65550b34bb6b5e7f7f88e1c0ff7b5d6d987c61e85b902779d425d4dc3438d2f",
    "sha256:300b6f91fc5962c6e6d3c7eb04828d18bd9632c0f3ffb1720ea5736206dadb5e",
    "sha256:781d4a58227b62e09ad5557af7ead6daaf4d466840a29c1d53e63cd38ab65761",
    "sha256:6ec7d3b981660d17d2cf87c80191147b570dd77410a39ec697d6cea6a7d237d2",
    "sha256:17be065c7b090ab7fe60bda1af89d0ad2e278bd126de5d89bea797c4abcfed67",
    "sha256:dd7800a444838a0c608231c8f4e906292544df144b2f7808c3e10560431ab5c5",
    "sha256:dd2a9d0adb76b5011361f81b6ac3e1200ade2b68f64dad3fe4a8eb0d4e991f6c",
    "sha256:3dccf3afa9abb6722eea4cb462709e085a75899e44d8d0e50d69778554da9bbf",
    "sha256:5f70bf18a086007016e948b04aed3b82103a36bea41755b6cddfaf10ace3c6ef",
    "sha256:9b5bf93b61368458b376166608344994628ca0b978442ab90ae1dd624933b4f6",
    "sha256:48004b1a1b92793f7d6e8ba614f382d04b53763b37bdb4b79865be2c61f3a28e",
    "sha256:91d4de578c235f4c66e259265b4e9cfab45c923f911700d53d2885175f990018",
    "sha256:03e47a56a259844cfc2c430dffe25d8e035a5ba03663d44df29955102fb9c778",
    "sha256:920977e8aea11f99578462a5c0c205b1c4f90a7f19f92adc283bd384ec67278b"
  ]
};

const source = await readFile(new URL('./local-supabase-reset.mjs', import.meta.url), 'utf8');
const workflow = await readFile(new URL('../../.github/workflows/quality.yml', import.meta.url), 'utf8');
const refusal = error => /^H01_CANONICAL_POSTGRES24: exact pinned image proof required\.$/u.test(error.message);

function quota(overrides = {}, diagnostic = 'Error response from daemon: error from registry: Data limit exceeded') {
  return new Error('H01_SQL_PROBE_FAILED: exit-nonzero. public registry quota', { cause: {
    reason: 'exit-nonzero', originReason: 'exit-nonzero',
    containment: 'posix-process-group-empty', diagnostic, ...overrides,
  } });
}

function mirrorQuota(overrides = {}, diagnostic = '0123456789ab: Download complete\nerror from registry: retry-after: 1.042664ms, allowed: 44000/minute') {
  return quota(overrides, diagnostic);
}

function fixture(architecture = 'amd64') {
  const calls = [];
  const image = {
    Id: PIN.platforms[architecture].config, Os: 'linux', Architecture: architecture,
    RepoDigests: [PIN.mirror], RepoTags: [PIN.canonical],
    RootFS: { Type: 'layers', Layers: [...ROOTFS24[architecture]] },
  };
  const state = { pull: { stdout: `Digest: ${PIN.index}\n`, stderr: '' },
    first: JSON.stringify([image]), final: JSON.stringify([image]) };
  const runDocker = async args => {
    calls.push(args);
    if (args[0] === 'pull') return state.pull;
    if (args[1] === 'tag') return { stdout: '', stderr: '' };
    return { stdout: args[2] === PIN.mirror ? state.first : state.final, stderr: '' };
  };
  return { calls, image, state, runDocker, architecture };
}

function indexFixture(architecture = 'amd64') {
  const f = fixture(architecture);
  f.image.Id = PIN.index;
  f.image.Descriptor = { digest: PIN.index, size: 1609, mediaType: 'application/vnd.oci.image.index.v1+json' };
  f.state.first = f.state.final = JSON.stringify([f.image]);
  return f;
}

test('quota classification is exact and cannot broaden cancellation, timeout or disclosure failures', () => {
  for (const diagnostic of [
    'Error response from daemon: error from registry: Data limit exceeded',
    'Error response from daemon: error from registry: toomanyrequests: Rate exceeded',
    'Error response from daemon: error from registry: 429 Too Many Requests\n',
  ]) assert.equal(isCanonicalPostgresQuota24(quota({}, diagnostic)), true);
  for (const error of [
    new Error('Data limit exceeded'), {}, null,
    quota({ reason: 'timeout' }), quota({ originReason: 'cancelled' }),
    quota({ containment: 'unconfirmed' }), quota({ diagnostic: null }),
    quota({}, 'unauthorized: access denied'), quota({}, 'network unavailable'),
    quota({}, 'Error response from daemon: error from registry: Data limit exceeded\nSENSITIVE_SENTINEL'),
    quota({}, 'SENSITIVE_SENTINEL Data limit exceeded'),
    { message: 'different operation', cause: quota().cause },
  ]) assert.equal(isCanonicalPostgresQuota24(error), false);
});

test('immutable official image proof supports both exact native platforms without a tag-based pull', async t => {
  for (const architecture of ['amd64', 'arm64']) await t.test(architecture, async () => {
    const f = fixture(architecture);
    const identity = await prepareCanonicalPostgresMirror24(f);
    assert.deepEqual(identity, { id: f.image.Id, digest: PIN.index, architecture });
    assert.ok(Object.isFrozen(identity));
    assert.deepEqual(f.calls, [
      ['pull', '--platform', `linux/${architecture}`, PIN.mirror],
      ['image', 'inspect', PIN.mirror],
      ['image', 'tag', f.image.Id, PIN.canonical],
      ['image', 'inspect', PIN.canonical],
    ]);
    assert.doesNotThrow(() => assertCanonicalPostgres24(identity));
  });
});

test('containerd index identity additionally binds descriptor and every ordered native RootFS layer', async t => {
  for (const architecture of ['amd64', 'arm64']) await t.test(architecture, async () => {
    const f = indexFixture(architecture);
    const result = await prepareCanonicalPostgresMirror24(f);
    assert.deepEqual(result, { id: PIN.index, digest: PIN.index, architecture });
    assert.deepEqual(f.calls[2], ['image', 'tag', PIN.index, PIN.canonical]);
    assert.throws(() => assertCanonicalPostgres24(result), refusal);
    assert.doesNotThrow(() => assertCanonicalPostgres24(result, f.image));
  });
});

test('an index hash alone never admits absent, forged, cross-platform or incomplete native source proof', async t => {
  for (const [name, mutate] of [
    ['missing descriptor', row => { delete row.Descriptor; }],
    ['wrong descriptor digest', row => { row.Descriptor.digest = PIN.platforms.amd64.manifest; }],
    ['wrong descriptor media type', row => { row.Descriptor.mediaType = 'application/vnd.oci.image.manifest.v1+json'; }],
    ['wrong descriptor size', row => { row.Descriptor.size++; }],
    ['missing rootfs', row => { delete row.RootFS; }],
    ['wrong rootfs type', row => { row.RootFS.Type = 'unknown'; }],
    ['missing layer', row => { row.RootFS.Layers.pop(); }],
    ['extra layer', row => { row.RootFS.Layers.push(row.RootFS.Layers[0]); }],
    ['reordered native layers', row => { [row.RootFS.Layers[0], row.RootFS.Layers[1]] = [row.RootFS.Layers[1], row.RootFS.Layers[0]]; }],
    ['modified native layer', row => { row.RootFS.Layers[0] = `sha256:${'a'.repeat(64)}`; }],
    ['other native rootfs', row => { row.RootFS.Layers = [...ROOTFS24.arm64]; }],
    ['malformed native layer', row => { row.RootFS.Layers[0] = 'SENSITIVE_SENTINEL'; }],
    ['wrong architecture', row => { row.Architecture = 'arm64'; }],
    ['swapped id', row => { row.Id = PIN.platforms.arm64.config; }],
  ]) await t.test(name, async () => {
    const f = indexFixture(); mutate(f.image); f.state.first = JSON.stringify([f.image]);
    await assert.rejects(prepareCanonicalPostgresMirror24(f), refusal);
    assert.ok(!f.calls.some(args => args[1] === 'tag'));
  });
});

test('modern ECR success gets an additional read-only native image proof without changing SQL target IDs', async t => {
  for (const architecture of ['amd64', 'arm64']) await t.test(architecture, async () => {
    const f = indexFixture(architecture); const calls = [];
    f.image.RepoDigests = [`public.ecr.aws/supabase/postgres@${PIN.index}`];
    const identity = Object.freeze({ id: PIN.index, digest: PIN.index, architecture });
    await verifyCanonicalPostgres24({ identity, runDocker: async args => { calls.push(args); return { stdout: JSON.stringify([f.image]) }; } });
    assert.deepEqual(calls, [['image', 'inspect', PIN.canonical]]);
    assert.equal(identity.id, PIN.index);
  });
});

test('ECR native proof rejects readback replacement, foreign names, malformed output and late cancellation', async () => {
  const f = indexFixture();
  const identity = { id: PIN.index, digest: PIN.index, architecture: 'amd64' };
  for (const raw of ['SENSITIVE_SENTINEL', '{}', '[]', JSON.stringify([f.image, f.image]),
    JSON.stringify([f.image]),
    JSON.stringify([{ ...f.image, RepoDigests: [`public.ecr.aws/supabase/postgres@${PIN.index}`], RepoTags: ['foreign.invalid/postgres'] }]),
    JSON.stringify([{ ...f.image, RepoDigests: [`public.ecr.aws/supabase/postgres@${PIN.index}`], RootFS: { Type: 'layers', Layers: [...ROOTFS24.arm64] } }])]) {
    await assert.rejects(verifyCanonicalPostgres24({ identity, runDocker: async () => ({ stdout: raw }) }), refusal);
  }
  const controller = new AbortController(); let commands = 0;
  await assert.rejects(verifyCanonicalPostgres24({ identity, signal: controller.signal,
    runDocker: async () => { commands++; controller.abort(); return { stdout: JSON.stringify([f.image]) }; } }), { name: 'AbortError' });
  assert.equal(commands, 1);
});

test('frozen pins have no caller-controlled architecture, registry, digest or mutable witness', async () => {
  assert.ok(Object.isFrozen(PIN) && Object.isFrozen(PIN.platforms));
  for (const key of ['amd64', 'arm64']) assert.ok(Object.isFrozen(PIN.platforms[key]));
  assert.throws(() => { PIN.platforms.amd64.config = 'changed'; }, TypeError);
  for (const architecture of ['__proto__', 'constructor', 'toString', 'x64', 'unknown', undefined]) {
    let calls = 0;
    await assert.rejects(prepareCanonicalPostgresMirror24({ architecture, runDocker: async () => { calls++; } }), refusal);
    assert.equal(calls, 0);
    assert.throws(() => assertCanonicalPostgres24({ architecture, digest: PIN.index }), refusal);
  }
  for (const identity of [null, {}, { architecture: 'amd64', id: PIN.platforms.arm64.config, digest: PIN.index },
    { architecture: 'amd64', id: PIN.platforms.amd64.config, digest: `sha256:${'a'.repeat(64)}` }]) {
    assert.throws(() => assertCanonicalPostgres24(identity), refusal);
  }
});

test('missing, duplicate, stale and foreign pull digests fail before inspect or retag', async t => {
  for (const stdout of ['', 'Digest: SENSITIVE_SENTINEL\n', `Digest: sha256:${'a'.repeat(64)}\n`,
    `Digest: ${PIN.index}\nDigest: ${PIN.index}\n`]) await t.test(JSON.stringify(stdout).slice(0, 35), async () => {
    const f = fixture(); f.state.pull = { stdout, stderr: '' };
    await assert.rejects(prepareCanonicalPostgresMirror24(f), refusal);
    assert.equal(f.calls.length, 1);
  });
});

test('malformed, foreign, wrong-platform and changed mirror sources cannot acquire the canonical name', async t => {
  const controls = [
    ['malformed', () => 'SENSITIVE_SENTINEL'], ['object', () => '{}'], ['missing', () => '[]'],
    ['duplicate', row => JSON.stringify([row, row])],
    ['wrong config', row => JSON.stringify([{ ...row, Id: `sha256:${'b'.repeat(64)}` }])],
    ['wrong OS', row => JSON.stringify([{ ...row, Os: 'windows' }])],
    ['wrong platform', row => JSON.stringify([{ ...row, Architecture: 'arm64' }])],
    ['foreign registry', row => JSON.stringify([{ ...row, RepoDigests: [`foreign.invalid/postgres@${PIN.index}`] }])],
    ['stale digest', row => JSON.stringify([{ ...row, RepoDigests: ['ghcr.io/supabase/postgres@sha256:' + 'b'.repeat(64)] }])],
    ['missing digest list', row => JSON.stringify([{ ...row, RepoDigests: null }])],
  ];
  for (const [name, mutate] of controls) await t.test(name, async () => {
    const f = fixture(); f.state.first = mutate(f.image);
    await assert.rejects(prepareCanonicalPostgresMirror24(f), refusal);
    assert.equal(f.calls.length, 2);
    assert.ok(!f.calls.some(args => args[1] === 'tag'));
  });
});

test('canonical cache retag must survive exact readback before any identity is returned', async t => {
  for (const [name, mutate] of [
    ['swapped id', row => ({ ...row, Id: PIN.platforms.arm64.config })],
    ['swapped name', row => ({ ...row, RepoTags: ['foreign.invalid/sensitive'] })],
    ['lost digest', row => ({ ...row, RepoDigests: [] })],
  ]) await t.test(name, async () => {
    const f = fixture(); f.state.final = JSON.stringify([mutate(f.image)]);
    await assert.rejects(prepareCanonicalPostgresMirror24(f), refusal);
    assert.equal(f.calls.length, 4);
  });
});

test('contained command failures are retained and never trigger an unpinned alternate pull', async () => {
  for (const operation of [1, 2, 3, 4]) {
    const f = fixture(); const original = f.runDocker;
    const error = new Error('test command failure');
    f.runDocker = async args => { if (f.calls.length + 1 === operation) throw error; return await original(args); };
    await assert.rejects(prepareCanonicalPostgresMirror24(f), value => value === error);
    assert.equal(f.calls.length, operation - 1);
  }
});

test('cancellation before or between every Docker command prevents further acquisition', async () => {
  for (const abortAfter of [0, 1, 2, 3, 4]) {
    const f = fixture(); const original = f.runDocker; const controller = new AbortController();
    if (abortAfter === 0) controller.abort();
    f.runDocker = async args => { const value = await original(args); if (f.calls.length === abortAfter) controller.abort(); return value; };
    await assert.rejects(prepareCanonicalPostgresMirror24({ ...f, signal: controller.signal }), { name: 'AbortError' });
    assert.equal(f.calls.length, abortAfter);
  }
});

test('only the observed structured contained mirror rate response allows bounded retries', () => {
  assert.equal(isCanonicalPostgresMirrorQuota24(mirrorQuota()), true);
  assert.equal(isCanonicalPostgresQuota24(mirrorQuota()), false);
  for (const error of [
    mirrorQuota({ containment: 'unconfirmed' }), mirrorQuota({ originReason: 'timeout' }),
    mirrorQuota({ reason: 'cancelled' }), new Error('retry-after: 1ms'),
    mirrorQuota({}, 'unauthorized: SENSITIVE_SENTINEL'),
    mirrorQuota({}, 'error from registry: retry-after: Infinitys, allowed: 44000/minute'),
    mirrorQuota({}, 'error from registry: retry-after: 1ms, allowed: 44000/minute\nSENSITIVE_SENTINEL'),
    mirrorQuota({}, 'error from registry: retry-after: 1ms, allowed: 0/minute'),
    mirrorQuota({}, 'SENSITIVE_SENTINEL'.repeat(5000)),
    mirrorQuota({}, 'SENSITIVE_SENTINEL\nerror from registry: retry-after: 1ms, allowed: 44000/minute'),
    mirrorQuota({}, 'unauthorized: access denied\nerror from registry: retry-after: 1ms, allowed: 44000/minute'),
    mirrorQuota({}, 'network unavailable\nerror from registry: retry-after: 1ms, allowed: 44000/minute'),
    mirrorQuota({}, 'foreign.invalid/postgres:latest: Pulling from supabase/postgres\nerror from registry: retry-after: 1ms, allowed: 44000/minute'),
    mirrorQuota({}, '0123456789ab: Download complete\n'.repeat(301) + 'error from registry: retry-after: 1ms, allowed: 44000/minute'),
  ]) assert.equal(isCanonicalPostgresMirrorQuota24(error), false);
  assert.equal(isCanonicalPostgresMirrorQuota24(mirrorQuota({},
    `${PIN.mirror}: Pulling from supabase/postgres\n0123456789ab: Pulling fs layer\n0123456789ab: Download complete\nerror from registry: retry-after: 1.042664ms, allowed: 44000/minute`)), true);
});

test('transient GHCR throttling retries exactly the same immutable source with fixed delays', async () => {
  const f = fixture(); const original = f.runDocker; const waits = []; let attempts = 0;
  f.runDocker = async args => {
    if (args[0] === 'pull' && ++attempts < 3) { f.calls.push(args); throw mirrorQuota(); }
    return await original(args);
  };
  const result = await prepareCanonicalPostgresMirror24({ ...f, wait: async milliseconds => { waits.push(milliseconds); } });
  assert.equal(result.id, f.image.Id);
  assert.deepEqual(waits, [3000, 10000]);
  assert.equal(f.calls.filter(args => args[0] === 'pull').length, 3);
  assert.ok(f.calls.filter(args => args[0] === 'pull').every(args => args[3] === PIN.mirror));
});

test('persistent GHCR quota permits only the second official identical-index mirror after four attempts', async t => {
  for (const architecture of ['amd64', 'arm64']) {
  for (const repoDigest of [PIN.secondaryMirror, `supabase/postgres@${PIN.index}`]) await t.test(`${architecture}:${repoDigest}`, async () => {
    const f = fixture(architecture); const waits = []; const image = { ...f.image, RepoDigests: [repoDigest] };
    f.runDocker = async args => {
      f.calls.push(args);
      if (args[0] === 'pull' && args[3] === PIN.mirror) throw mirrorQuota();
      if (args[0] === 'pull') return f.state.pull;
      if (args[1] === 'tag') return { stdout: '', stderr: '' };
      return { stdout: JSON.stringify([image]), stderr: '' };
    };
    const result = await prepareCanonicalPostgresMirror24({ ...f, wait: async milliseconds => { waits.push(milliseconds); } });
    assert.deepEqual(result, { id: image.Id, digest: PIN.index, architecture });
    assert.deepEqual(waits, [3000, 10000, 30000]);
    assert.deepEqual(f.calls.slice(0, 4), Array.from({ length: 4 }, () => ['pull', '--platform', `linux/${architecture}`, PIN.mirror]));
    assert.deepEqual(f.calls[4], ['pull', '--platform', `linux/${architecture}`, PIN.secondaryMirror]);
    assert.deepEqual(f.calls[5], ['image', 'inspect', PIN.secondaryMirror]);
    assert.equal(f.calls.length, 8);
  });
  }
});

test('foreign, changed or malformed secondary image responses cannot use the canonical name', async () => {
  for (const change of [row => ({ ...row, Id: PIN.platforms.arm64.config }),
    row => ({ ...row, RepoDigests: [PIN.mirror] }), row => ({ ...row, Architecture: 'arm64' })]) {
    const f = fixture();
    f.runDocker = async args => {
      f.calls.push(args);
      if (args[0] === 'pull' && args[3] === PIN.mirror) throw mirrorQuota();
      if (args[0] === 'pull') return f.state.pull;
      return { stdout: JSON.stringify([change(f.image)]), stderr: '' };
    };
    await assert.rejects(prepareCanonicalPostgresMirror24({ ...f, wait: async () => {} }), refusal);
    assert.ok(!f.calls.some(args => args[1] === 'tag'));
  }
});

test('both quota-limited mirrors exhaust finite attempts and retain the actual last error', async () => {
  const f = fixture(); const waits = []; let last;
  f.runDocker = async args => { f.calls.push(args); last = mirrorQuota(); throw last; };
  await assert.rejects(prepareCanonicalPostgresMirror24({ ...f, wait: async milliseconds => { waits.push(milliseconds); } }), error => error === last);
  assert.equal(f.calls.length, 8);
  assert.deepEqual(waits, [3000, 10000, 30000, 3000, 10000, 30000]);
  assert.ok(f.calls.every(args => args[0] === 'pull'));
});

test('cancelling the real mirror backoff prevents another pull or registry transition', async () => {
  const f = fixture(); const controller = new AbortController();
  f.runDocker = async args => { f.calls.push(args); queueMicrotask(() => controller.abort()); throw mirrorQuota(); };
  await assert.rejects(prepareCanonicalPostgresMirror24({ ...f, signal: controller.signal }), { name: 'AbortError' });
  assert.equal(f.calls.length, 1);
});

function dispatcher(context) {
  const start = source.indexOf('async function prepareCanonicalPostgresImage24(');
  const end = source.indexOf('\nfunction assertHistoryDatabaseTarget(', start);
  assert.ok(start > 0 && end > start);
  return runInNewContext(`${source.slice(start, end)}\nprepareCanonicalPostgresImage24;`, context);
}

test('current dispatch retains successful ECR acquisition, pins it, and does not invoke a mirror', async () => {
  let legacy = 0; let mirror = 0;
  const identity = { id: PIN.platforms.amd64.config, digest: PIN.index, architecture: 'amd64' };
  const context = { canonicalPostgresIdentity: identity, assertCanonicalPostgres24, verifyCanonicalPostgres24, isCanonicalPostgresQuota24,
    signalCleanup: { signal: undefined }, runHistoryDocker: async () => { throw new Error('classic proof needs no extra Docker call'); },
    prepareCanonicalPostgresImage: async () => { legacy++; },
    prepareCanonicalPostgresMirror24: async () => { mirror++; } };
  await dispatcher(context)();
  assert.equal(legacy, 1); assert.equal(mirror, 0);
  context.canonicalPostgresIdentity = { ...identity, digest: `sha256:${'e'.repeat(64)}` };
  await assert.rejects(dispatcher(context)(), refusal);
  assert.equal(mirror, 0);
});

test('only a contained canonical ECR quota failure can dispatch to the verified native mirror', async () => {
  let mirrors = 0;
  const f = fixture();
  const context = { process: { arch: 'x64' }, signalCleanup: { signal: undefined },
    canonicalPostgresIdentity: undefined, assertCanonicalPostgres24, verifyCanonicalPostgres24, isCanonicalPostgresQuota24,
    prepareCanonicalPostgresImage: async () => { throw quota(); }, runHistoryDocker: f.runDocker,
    prepareCanonicalPostgresMirror24: async options => { mirrors++; return await prepareCanonicalPostgresMirror24(options); },
    console: { log: () => {} } };
  await dispatcher(context)();
  assert.equal(mirrors, 1);
  assert.deepEqual(context.canonicalPostgresIdentity, { id: f.image.Id, digest: PIN.index, architecture: 'amd64' });
  for (const error of [new Error('429'), quota({ containment: 'unconfirmed' }), quota({ originReason: 'timeout' })]) {
    context.prepareCanonicalPostgresImage = async () => { throw error; };
    await assert.rejects(dispatcher(context)(), value => value === error);
  }
  assert.equal(mirrors, 1);
});

test('failed modern native readback cannot be mistaken for an acquisition quota fallback', async () => {
  let mirrors = 0; const error = quota();
  const context = { canonicalPostgresIdentity: { id: PIN.index, digest: PIN.index, architecture: 'amd64' },
    verifyCanonicalPostgres24, isCanonicalPostgresQuota24, signalCleanup: { signal: undefined },
    prepareCanonicalPostgresImage: async () => {}, runHistoryDocker: async () => { throw error; },
    prepareCanonicalPostgresMirror24: async () => { mirrors++; } };
  await assert.rejects(dispatcher(context)(), value => value === error);
  assert.equal(mirrors, 0);
});

test('real canonical path dispatches before startup and Quality executes the new bootstrap controls', () => {
  const body = source.slice(source.indexOf('let verificationFailure;'));
  assert.match(body, /await prepareCanonicalPostgresImage24\(\);\s*stackMayExist = true;\s*await runLocalCli\('start isolated credential-free stack'/u);
  assert.doesNotMatch(body, /await prepareCanonicalPostgresImage\(\)/u);
  assert.match(workflow, /run: node --test scripts\/phase2\/canonical-postgres-mirror24\.test\.mjs/u);
  assert.match(workflow, /run: npm run phase2:db-local-contract/u);
  assert.match(workflow, /run: npm run phase2:db-local-verify/u);
  assert.doesNotMatch(workflow, /continue-on-error/u);
  assert.match(source, /const publicDockerConfig = join\(sandboxRoot, '\.docker-public'\);\s*await mkdir\(publicDockerConfig\);\s*await writeFile\(join\(publicDockerConfig, 'config\.json'\), '\{"auths":\{\}\}\\n', \{ mode: 0o600 \}\);\s*childEnv\.DOCKER_CONFIG = publicDockerConfig;\s*delete childEnv\.DOCKER_AUTH_CONFIG;/u);
});
