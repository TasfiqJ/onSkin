"""Public diagnostics are an allowlist, never redacted scanner text."""
import json


class Refusal(ValueError):
    pass


def require(ok, code):
    if not ok:
        raise Refusal(code)


def pairs(items):
    result = {}
    for key, value in items:
        require(key not in result, 'DUPLICATE_JSON_KEY')
        result[key] = value
    return result


def loads(raw):
    return json.loads(raw, object_pairs_hook=pairs,
                      parse_constant=lambda _: require(False, 'NONFINITE_JSON'))


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=True).encode()


PUBLIC_CODES = frozenset('''ARGUMENT_SCOPE DISCLOSURE_GATE_FAILED TOOLCHAIN_CONFIG PYTHON_VERSION
TOOL_UNAVAILABLE TOOL_VERSION NPM_IDENTITY NPM_VERSION NPM_TOOL_LINK NPM_TOOL_FILE
NPM_TOOL_BOUND NPM_TOOL_ENUMERATION NPM_EXPECTED_CONTENT NPM_MODEL_IDENTITY NPM_BIN_METADATA
NPM_BIN_TARGET NPM_BIN_SHIM NPM_TOOL_CHANGED NPM_TOOL_READ POLICY_SCHEMA GIT_INCOMPLETE
LINK_OR_REPARSE NONREGULAR_OR_OVERSIZED SPECIAL_MODE CHANGED_INPUT UNSAFE_PATH
PATH_ALIAS_OR_COLLISION DUPLICATE_PATH INPUT_CHANGED_DURING_EXECUTION SOURCE_DIRTY
TAP_INCOMPLETE HISTORICAL_RESULT_CHANGED STALE_OMITTED_OR_FABRICATED_RECEIPT
CHILD_CONTAINMENT_UNAVAILABLE CHILD_OUTPUT_BOUND CHILD_TIMEOUT CHILD_READER_FAILURE
EXECUTABLE_UNAVAILABLE OUTPUT_INSIDE_SOURCE OUTPUT_PARENT COMPONENT_NAME
DEPENDENCY_SCHEMA ACTUAL_EXIT_MISMATCH DEPENDENCY_SOURCE RECEIPT_CHANGED
PARTIAL_GATE_FAILED TOOLCHAIN_GATE_FAILED GIT_DIAGNOSTIC OUTPUT_LIMIT CHILD_STREAM_FAILURE
DIRTY_SOURCE INDEX_FLAGS ROOT_LINK_OR_REPARSE GIT_ROOT_MISMATCH GIT_REPLACEMENT_OR_GRAFT
SHALLOW_REPOSITORY BASE_TREE REF_IDENTITY BASE_REF_MOVED HISTORY_OBJECTS_INCOMPLETE
GIT_MODE WORKTREE_BLOB_MISMATCH WORKTREE_EXECUTABLE_MODE SOURCE_CHANGED
INPUT_GATE_FAILED OUTPUT_CHANGED OUTPUT_WRITE_INCOMPLETE PROGRESS_BOUND'''.split())


def diagnostic(error):
    # Equality against fixed tokens is the only exception-data publication path.
    if isinstance(error, KeyboardInterrupt):
        return 'EXECUTION_INTERRUPTED'
    if isinstance(error, PermissionError):
        return 'FILESYSTEM_PERMISSION_DENIED'
    if isinstance(error, FileNotFoundError):
        return 'REQUIRED_INPUT_MISSING'
    if isinstance(error, OSError):
        return 'FILESYSTEM_ACCESS_INCOMPLETE'
    if isinstance(error, Refusal):
        if len(error.args) == 1 and type(error.args[0]) is str and error.args[0] in PUBLIC_CODES:
            return error.args[0]
        return 'REFUSED'
    return 'EXECUTION_INCOMPLETE'
