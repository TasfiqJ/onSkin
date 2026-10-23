"""Adverse cases use memory or temporary Git objects, never altered source files."""
import copy
import json
import os
import pathlib
import subprocess
import tempfile
import unittest
from unittest.mock import patch

import verify_scope as scope

ROOT=pathlib.Path(os.environ['VP01_TEST_REPO'])
CHECKPOINT=pathlib.Path(__file__).resolve().parent

def blob(revision,path):
    return subprocess.check_output(['git','-C',str(ROOT),'show',revision+':'+path])

class ExactScopeTests(unittest.TestCase):
    def setUp(self):
        self.overrides={}
        self.original=lambda p:blob(scope.BASE,p)
        self.read=lambda p:self.overrides[p] if p in self.overrides else (ROOT/p).read_bytes()
        self.pins=lambda p:(ROOT/p).read_bytes()
        self.report=json.loads((CHECKPOINT/'completion-report.json').read_bytes())
        self.provenance=json.loads((CHECKPOINT/'evidence/npm-regeneration-provenance.json').read_bytes())

    def changed(self,path,mutate):
        obj=json.loads(self.read(path));mutate(obj)
        self.overrides[path]=(json.dumps(obj,indent=2)+'\n').encode()

    def test_01_true_source_and_provenance_and_report(self):
        scope.verify_source(self.read,self.original,self.pins)
        scope.verify_npm_provenance(self.provenance)
        scope.verify_report(self.report)

    def test_02_mutated_second_manifest(self):
        self.changed('apps/catalog-operator-console/package.json',lambda o:o['devDependencies'].__setitem__('vitest','^4.1.11'))
        with self.assertRaisesRegex(ValueError,'MANIFEST_SCOPE'):
            scope.verify_source(self.read,self.original,self.pins)

    def test_03_unintended_direct_package(self):
        self.changed('apps/mobile/package.json',lambda o:o['dependencies'].__setitem__('unissued-package','1.0.0'))
        with self.assertRaisesRegex(ValueError,'MANIFEST_SCOPE'):
            scope.verify_source(self.read,self.original,self.pins)

    def test_04_forged_target_lock_integrity(self):
        self.changed('package-lock.json',lambda o:o['packages']['node_modules/@vitest/mocker'].__setitem__('integrity','sha512-FORGED'))
        with self.assertRaisesRegex(ValueError,'TARGET_INTEGRITY'):
            scope.verify_source(self.read,self.original,self.pins)

    def test_05_extra_transitive_package(self):
        self.changed('package-lock.json',lambda o:o['packages'].__setitem__('node_modules/unissued-package',{'version':'1.0.0'}))
        with self.assertRaisesRegex(ValueError,'PACKAGE_SET_DRIFT'):
            scope.verify_source(self.read,self.original,self.pins)

    def test_06_tampered_transitive_sri(self):
        self.changed('package-lock.json',lambda o:o['packages']['node_modules/chai'].__setitem__('integrity','sha512-FORGED'))
        with self.assertRaisesRegex(ValueError,'REVIEWED_NPM_LOCK_BYTES'):
            scope.verify_source(self.read,self.original,self.pins)

    def test_07_foreign_npm_version_and_tarball(self):
        for field,value,code in [('npm_version','11.17.0','FOREIGN_NPM_VERSION'),('tarball_url','https://foreign.invalid/npm.tgz','FOREIGN_NPM_TARBALL'),('tarball_sha256','0'*64,'FOREIGN_NPM_TARBALL_BYTES')]:
            with self.subTest(field=field):
                receipt=copy.deepcopy(self.provenance);receipt[field]=value
                with self.assertRaisesRegex(ValueError,code): scope.verify_npm_provenance(receipt)

    def test_08_missing_mapped_source_pin(self):
        def missing(path): raise FileNotFoundError(path)
        with self.assertRaisesRegex(ValueError,'MISSING_INSTALLED_PIN'):
            scope.verify_source(self.read,self.original,missing)

    def test_09_fake_installed_source_pin(self):
        with self.assertRaisesRegex(ValueError,'FAKE_INSTALLED_PIN'):
            scope.verify_source(self.read,self.original,lambda p:b'forged installed bytes')

    def test_10_forged_native_archive_approval(self):
        self.changed('docs/phase-9/ios-sdk-package-mapping.json',lambda o:o['mappings'][0].__setitem__('archiveRequired',False))
        with self.assertRaisesRegex(ValueError,'MAPPING_SCOPE_OR_FORGED_APPROVAL'):
            scope.verify_source(self.read,self.original,self.pins)

    def test_11_expired_security_waiver(self):
        self.report['boundaries']['original_security_expiry_utc']='2026-12-31T00:00:00Z'
        with self.assertRaisesRegex(ValueError,'EXPIRED_SECURITY_WAIVER'): scope.verify_report(self.report)

    def test_12_forged_protected_security_go(self):
        self.report['boundaries']['protected_source_go']=True
        with self.assertRaisesRegex(ValueError,'FORGED_GO'): scope.verify_report(self.report)

    def test_13_forged_osv_exception(self):
        self.report['boundaries']['osv_exception']={'accepted':True}
        with self.assertRaisesRegex(ValueError,'BOUNDARY_SCHEMA_OR_WAIVER'): scope.verify_report(self.report)

    def test_14_unauthorized_intermediate_commit_reverted_at_endpoint(self):
        before_head=subprocess.check_output(['git','-C',str(ROOT),'rev-parse','HEAD'])
        original_policy=(ROOT/'docs/phase-9/security-advisory-exceptions.json').read_bytes()
        with tempfile.TemporaryDirectory(prefix='vp01-intermediate-objects-') as folder:
            temp=pathlib.Path(folder);(temp/'objects').mkdir()
            objects=subprocess.check_output(['git','-C',str(ROOT),'rev-parse','--git-path','objects']).decode().strip()
            source_objects=(ROOT/objects).resolve()
            env=os.environ.copy();env.update(GIT_INDEX_FILE=str(temp/'index'),GIT_OBJECT_DIRECTORY=str(temp/'objects'),GIT_ALTERNATE_OBJECT_DIRECTORIES=str(source_objects),GIT_AUTHOR_NAME='Disposable scope test',GIT_AUTHOR_EMAIL='scope-test@example.invalid',GIT_COMMITTER_NAME='Disposable scope test',GIT_COMMITTER_EMAIL='scope-test@example.invalid')
            def git(*args,data=None):
                return subprocess.check_output(['git','-C',str(ROOT),*args],input=data,env=env).decode().strip()
            git('read-tree',scope.SOURCE)
            forged=git('hash-object','-w','--stdin',data=b'{"forged_expired_waiver":true}\n')
            git('update-index','--cacheinfo','100644,'+forged+',docs/phase-9/security-advisory-exceptions.json')
            badtree=git('write-tree')
            bad=git('commit-tree',badtree,'-p',scope.SOURCE,data=b'Synthetic unauthorized protected edit\n')
            reverted=git('commit-tree',scope.SOURCE_TREE,'-p',bad,data=b'Synthetic reversion hides endpoint delta\n')
            self.assertEqual(git('rev-parse',reverted+'^{tree}'),scope.SOURCE_TREE)
            with patch.dict(os.environ,env,clear=True):
                with self.assertRaisesRegex(ValueError,'UNAUTHORIZED_EXISTING_PATH'):
                    scope.verify(ROOT,head=reverted,check_worktree=False)
        self.assertEqual(subprocess.check_output(['git','-C',str(ROOT),'rev-parse','HEAD']),before_head)
        self.assertEqual((ROOT/'docs/phase-9/security-advisory-exceptions.json').read_bytes(),original_policy)

if __name__=='__main__': unittest.main(verbosity=2)
