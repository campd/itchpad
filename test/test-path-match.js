const match = require("path-match");

function pathMatch(search, path) {
  let re = match.pathMatchExpression(search);
  return re.test(path);
}

exports["test simple match"] = function(assert) {
  assert.ok(match.quickMatch("a", "abc"), "Beginning of line quickMatches");
  assert.ok(pathMatch("a", "abc"), "First character beginning of line pathMatches");
  assert.ok(pathMatch("a", "path/abc"), "First character word boundary patchMatches");
  function matchPath(search, path, name) {
    assert.ok(pathMatch(search, path), name);
  }
  function dontMatchPath(search, path, name) {
    assert.ok(!pathMatch(search, path), name);
  }

  matchPath("abc", "abc", "Exact match");
  matchPath("abc", "a/b/c", "Characters spread across path");
  matchPath("abc", "ab/c", "Characters grouped 1");
  matchPath("abc", "ab/bc", "Characters grouped 2");
  matchPath("ac", "/bin/activate", "Activate should match");
  matchPath("a/b", "a/b/c", "Explicit separator match");


  dontMatchPath("ab", "ba", "Out of order");
  dontMatchPath("b", "abc", "Word boundary");
  dontMatchPath("a/b", "ab", "Unmet explicit separator match.")
}

require("sdk/test").run(exports);
