import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEPENDENCY_AUDIT_NOT_RUN_WARNING,
  DEPENDENCY_AUDIT_OFFLINE_WARNING,
  DEPENDENCY_AUDIT_SIGNOFF_WARNING,
  dependencyAuditEvidenceWarnings,
  resolveDependencyAuditProvenance,
} from './dependency-sbom-contract.mjs';

test('only a completed registry audit plus exact-RC signoff is warning-free', () => {
  const provenance = resolveDependencyAuditProvenance({
    requested: true,
    offline: false,
    completed: true,
  });
  assert.deepEqual(provenance, {
    requested: true,
    mode: 'registry',
    completed: true,
  });
  assert.deepEqual(dependencyAuditEvidenceWarnings({ provenance, signedOff: true }), []);
  assert.deepEqual(dependencyAuditEvidenceWarnings({ provenance, signedOff: false }), [
    DEPENDENCY_AUDIT_SIGNOFF_WARNING,
  ]);
});

test('offline audit results remain warning-bearing even with a claimed signoff', () => {
  const provenance = resolveDependencyAuditProvenance({
    requested: true,
    offline: true,
    completed: true,
  });
  assert.deepEqual(dependencyAuditEvidenceWarnings({ provenance, signedOff: true }), [
    DEPENDENCY_AUDIT_OFFLINE_WARNING,
    DEPENDENCY_AUDIT_SIGNOFF_WARNING,
  ]);
});

test('missing and incomplete audits cannot inherit release signoff', () => {
  const missing = resolveDependencyAuditProvenance({
    requested: false,
    offline: false,
    completed: false,
  });
  assert.deepEqual(dependencyAuditEvidenceWarnings({ provenance: missing, signedOff: true }), [
    DEPENDENCY_AUDIT_NOT_RUN_WARNING,
    DEPENDENCY_AUDIT_SIGNOFF_WARNING,
  ]);

  const incomplete = resolveDependencyAuditProvenance({
    requested: true,
    offline: false,
    completed: false,
  });
  assert.deepEqual(dependencyAuditEvidenceWarnings({ provenance: incomplete, signedOff: true }), [
    DEPENDENCY_AUDIT_SIGNOFF_WARNING,
  ]);
});

test('provenance rejects contradictory or non-boolean state', () => {
  assert.throws(
    () => resolveDependencyAuditProvenance({ requested: false, offline: true, completed: false }),
    /unrequested dependency audit/u,
  );
  assert.throws(
    () => resolveDependencyAuditProvenance({ requested: true, offline: false, completed: 1 }),
    /completed must be boolean/u,
  );
});
