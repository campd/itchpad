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
  matchPath("a/b", "a/b/c", "Explicit separator match");
  matchPath("/a", "/a", "Leading separator");
  matchPath("a/", "a/", "Trailing separator");
  matchPath("b", "a/b/c", "Center match");

  dontMatchPath("ab", "ba", "Out of order");
  dontMatchPath("b", "abc", "Word boundary");
  dontMatchPath("a/b", "ab", "Unmet explicit separator match.");
}

exports["test annotate"] = function(assert) {
  function annotate(search, path, expected, name) {
    let re = match.pathMatchExpression(search);
    let annotated = match.annotate(re, path);

    let value = "";
    for (let frag of annotated) {
      if (frag.matched) {
        value += "<" + frag.fragment + ">";
      } else {
        value += frag.fragment;
      }
    }

    assert.equal(expected, value, name);
  }

  annotate("abc", "abc", "<abc>", "Exact match");
  annotate("abc", "a/b/c", "<a>/<b>/<c>", "Characters spread across path");
  annotate("abc", "ab/c", "<ab>/<c>", "Characters grouped 1");
  annotate("abc", "ab/bc", "<a>b/<bc>", "Characters grouped 2");
  annotate("a/b", "a/b/c", "<a/b>/c", "Explicit separator match");
  annotate("/a", "/a", "</a>", "Leading separator");
  annotate("b", "a/b/c", "a/<b>/c", "Center match");
  annotate("a", "a/b/a", "a/b/<a>", "Prefer later matches.");
  annotate("itchpad.js", "itchpad/lib/itchpad.js", "itchpad/lib/<itchpad.js>", "Prefer later matches, real example.");
}

exports["test score"] = function(assert) {
  function  expandScore(longestMatch, charsIn) {
    return (longestMatch << 16) + (charsIn & 0xffff);
  }

  function score(search, path, expected, name) {
    let re = match.pathMatchExpression(search);
    let value = match.score(re, path);
    assert.equal(expected, value, name);
  }

  score("q", "abc", 0, "No match");
  score("abc", "abc", expandScore(3, 0), "Exact match");
  score("abc", "a/b/c", expandScore(1, 0), "Characters spread across path");
  score("abc", "ab/c", expandScore(2, 0), "Characters grouped 1");
  score("abc", "ab/bc", expandScore(2, 0), "Characters grouped 2");
  score("a/b", "a/b/c", expandScore(3, 0), "Explicit separator match");
  score("b", "a/b/c", expandScore(1, 2), "Center match");
  score("a", "a/a/a", expandScore(1, 4), "Match last");
}

require("sdk/test").run(exports);
