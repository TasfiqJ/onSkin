import assert from 'node:assert/strict';
import { createHash, constants, generateKeyPairSync, privateEncrypt, sign, verify } from 'node:crypto';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const braces = require('braces');
const forge = require('node-forge');
const rejectsDepth = error => error instanceof SyntaxError && error.message === 'BRACES_NESTING_DEPTH_LIMIT';

test('braces preserves ordinary parse, compile, expansion and escaping behavior', () => {
  assert.equal(braces.compile('{a,b}'), '(a|b)');
  assert.deepEqual(braces.expand('src/{a,b}/{1..3}'), [
    'src/a/1', 'src/a/2', 'src/a/3', 'src/b/1', 'src/b/2', 'src/b/3',
  ]);
  assert.equal(braces.stringify(braces.parse('src/{a,b}')), 'src/{a,b}');
  assert.deepEqual(braces.expand('\\{a,b}'), ['{a,b}']);
});

test('braces rejects deeply nested strings before recursive traversal, regardless of caller options', () => {
  for (const pair of [['{', '}'], ['(', ')']]) {
    const pattern = pair[0].repeat(4_500) + 'a,b' + pair[1].repeat(4_500);
    for (const method of ['parse', 'compile', 'expand', 'stringify']) {
      assert.throws(() => braces[method](pattern, { maxDepth: Infinity }), rejectsDepth, method);
    }
  }
  assert.doesNotThrow(() => braces.compile('{'.repeat(256) + 'a,b' + '}'.repeat(256)));
  assert.throws(() => braces.compile('{'.repeat(257) + 'a,b' + '}'.repeat(257)), rejectsDepth);
});

test('braces direct AST APIs cannot bypass the fixed recursion bound', () => {
  for (const method of ['compile', 'expand', 'stringify']) {
    const root = { type: 'root', nodes: [] };
    let current = root;
    for (let index = 0; index < 15_000; index += 1) {
      const child = { type: 'root', nodes: [], parent: current };
      current.nodes.push(child); current = child;
    }
    current.nodes.push({ type: 'text', value: 'a' });
    assert.throws(() => braces[method](root), rejectsDepth, method);
  }
});

const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
const publicPem = keys.publicKey.export({ type: 'spki', format: 'pem' });
const forgeKey = forge.pki.publicKeyFromPem(publicPem);
const message = Buffer.from('local noncredential DigestInfo regression fixture');
const digest = createHash('sha256').update(message).digest();

function digestInfoSignature({ extra = 0, nullParameter = true, hashAlgorithm = 'sha256' } = {}) {
  const asn1 = forge.asn1;
  const algorithm = [asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OID, false,
    asn1.oidToDer(forge.pki.oids[hashAlgorithm]).getBytes())];
  if (nullParameter) algorithm.push(asn1.create(asn1.Class.UNIVERSAL, asn1.Type.NULL, false, ''));
  for (let index = 0; index < extra; index += 1) {
    algorithm.push(asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OCTETSTRING, false, 'unconsumed'));
  }
  const info = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
    asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, algorithm),
    asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OCTETSTRING, false, createHash(hashAlgorithm).update(message).digest().toString('binary')),
  ]);
  return privateEncrypt({ key: keys.privateKey, padding: constants.RSA_PKCS1_PADDING },
    Buffer.from(asn1.toDer(info).getBytes(), 'binary'));
}

test('node-forge rejects extra nested DigestAlgorithm elements that native verification rejects', () => {
  for (const extra of [1, 2]) {
    for (const nullParameter of [true, false]) {
      const signature = digestInfoSignature({ extra, nullParameter });
      assert.equal(verify('sha256', message, keys.publicKey, signature), false);
      assert.throws(() => forgeKey.verify(digest.toString('binary'), signature.toString('binary')), /DigestInfo/);
    }
  }
});

test('node-forge still accepts reviewed ordinary signatures and unaffected PSS signatures', () => {
  for (const nullParameter of [true, false]) {
    const signature = digestInfoSignature({ nullParameter });
    assert.equal(forgeKey.verify(digest.toString('binary'), signature.toString('binary')), true);
  }
  const signature = sign('sha256', message, {
    key: keys.privateKey, padding: constants.RSA_PKCS1_PSS_PADDING, saltLength: 32,
  });
  const pss = forge.pss.create({ md: forge.md.sha256.create(), mgf: forge.mgf.mgf1.create(forge.md.sha256.create()), saltLength: 32 });
  assert.equal(forgeKey.verify(digest.toString('binary'), signature.toString('binary'), pss), true);
});

test('node-forge ASN.1 capture never inherits prototype parameter markers', () => {
  assert.equal(Object.hasOwn(Object.prototype, 'parameters'), false);
  for (const descriptor of [
    { value: 'untrusted marker', writable: true, configurable: true },
    { value: 'untrusted marker', writable: false, configurable: true },
    { get() { throw new Error('INHERITED_PARAMETER_GETTER_MUST_NOT_RUN'); }, configurable: true },
  ]) {
    try {
      Object.defineProperty(Object.prototype, 'parameters', descriptor);
      for (const nullParameter of [false, true]) {
        for (const extra of [1, 2]) {
          const signature = digestInfoSignature({ extra, nullParameter });
          assert.equal(verify('sha256', message, keys.publicKey, signature), false);
          assert.throws(() => forgeKey.verify(digest.toString('binary'), signature.toString('binary')), /DigestInfo/);
        }
        const valid = digestInfoSignature({ nullParameter });
        assert.equal(forgeKey.verify(digest.toString('binary'), valid.toString('binary')), true);
      }
      const md5Digest = createHash('md5').update(message).digest('binary');
      const missingNull = digestInfoSignature({ hashAlgorithm: 'md5', nullParameter: false });
      assert.throws(() => forgeKey.verify(md5Digest, missingNull.toString('binary')), /Missing algorithm identifier NULL parameters/);
      const validMd5 = digestInfoSignature({ hashAlgorithm: 'md5' });
      assert.equal(forgeKey.verify(md5Digest, validMd5.toString('binary')), true);
    } finally { delete Object.prototype.parameters; }
    assert.equal(Object.hasOwn(Object.prototype, 'parameters'), false);
  }
});
