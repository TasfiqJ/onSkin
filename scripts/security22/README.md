# Current public technical candidate

Run `python -B scripts/security22/test_security22.py` before collecting output.
Run `python -B scripts/security22/run.py` from a clean full checkout after
normal `npm ci`. Required public base/main refs must exist. Exit 1 is expected
while required findings or qualified custody remain unresolved; exit 2 means
an incomplete/refused execution. Component PASS has its own exact denominator.

The runner executes real npm/OSV and installed-source checks, mandatory native
patch checks and retained tooling regressions. It binds HEAD/tree, explicit
public refs and reachable Git metadata, every committed path/mode/object/size,
public working bytes, tool executables/npm tree/config/program digests, and
actual process exits. It repeats inventories after execution. It never infers
a scan from a wrapper step or accepts a supplied clean result. `verify
--receipt FILE` re-executes current checks and requires exact deterministic
evidence equality. It still cannot grant acceptance.

Use `--output-dir NEW_DIRECTORY_OUTSIDE_CHECKOUT` to publish each completed,
stable component separately with exact source/tool bindings and a hashed index.
The directory must be new, with regular parents; writes never overwrite files.

Archive handling is in memory, with no extraction: regular-member/name/mode
checks, parent aliases, bounded depth/count/expanded bytes/ratio, and explicit
unsupported/custody dispositions. Files over bounds refuse content coverage.
Committed binaries are inventoried and byte-bound, not described as text scans.
Historical M1-03 artifacts are metadata-only: their contents are not opened.
Full historical secret/static scans and original findings need qualified
custody and remain BLOCKED/NOT_RUN. This is deliberately incomplete coverage,
never a zero-findings result.

Ignored installed dependency roots have a separate full installed inventory;
other ignored content is explicitly incomplete. Staged, untracked, hidden-index,
link/reparse, changed or inaccessible source refuses. Subprocesses use bounded
streams/deadlines and process-tree containment (Windows gated job object;
POSIX owned process group). Diagnostics use an allowlist; raw output, exception
text, snippets, paths and secret-derived fingerprints are never public output.

The additive PR workflow leaves all original Security jobs unchanged and red
where they remain red. It has read-only repository access and no secrets,
production access or acceptance authority. Unit/synthetic controls are labeled
separately from real check executions. See docs/security/security22/ for causes,
repairs, validation and unresolved blockers.
