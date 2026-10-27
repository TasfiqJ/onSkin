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


def diagnostic(error):
    # Never serialize exception messages, paths, output, snippets or their fingerprints.
    return 'REFUSED' if isinstance(error, Refusal) else 'EXECUTION_INCOMPLETE'
