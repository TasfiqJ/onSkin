"""Archive names/modes/collisions are checked without extracting any files."""
import importlib.util
import io
from pathlib import Path
import tempfile
import zipfile

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('checkpoint_archive',HERE/'verify_checkpoint.py')
check=importlib.util.module_from_spec(spec);spec.loader.exec_module(check)


def make(rows):
    output=io.BytesIO()
    with zipfile.ZipFile(output,'w') as archive:
        for name,mode in rows:
            info=zipfile.ZipInfo(name);info.create_system=3;info.external_attr=mode<<16
            archive.writestr(info,b'controlled fixture')
    return output.getvalue()


def main():
    with tempfile.TemporaryDirectory(prefix='onskin-evidence-archive-') as temporary:
        check.HERE=Path(temporary)
        path=check.HERE/'raw-evidence.zip'
        for rows in [
            [('../escape',0o100644)],[('/absolute',0o100644)],[('C:drive',0o100644)],
            [('folder/file',0o100644)],[('link',0o120777)],[('executable',0o100755)],
            [('Case.json',0o100644),('case.json',0o100644)],
            [('\uff58.json',0o100644)],
        ]:
            path.write_bytes(make(rows));check.archived_logs=None
            try: check.archive_logs()
            except ValueError: pass
            else: raise AssertionError(rows)
        path.write_bytes(make([('valid.json',0o100644)]));check.archived_logs=None
        assert check.archive_logs()=={'valid.json':b'controlled fixture'}
        (check.HERE/'logs').mkdir()
        try: check.regular(check.HERE/'logs/valid.json')
        except ValueError as error: assert 'ARCHIVE_LOGS_SHADOW' in str(error)
        else: raise AssertionError('physical shadow accepted')
    print('PASS: eight unsafe ZIP controls and a physical shadow reject; authentic regular entry preserved; no extraction.')


if __name__=='__main__':main()
