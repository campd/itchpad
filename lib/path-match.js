/**
 * A quick check that the characters in 'search' appear in 'path'.
 * Used for quick trimming of search space.
 */
exports.quickMatch = function(search, path) {
  let index = -1;
  for (let i = 0; i < search.length; i++) {
    index = path.indexOf(search[i], index + 1);
    if (index === -1) {
      break;
    }
  }
  return (index !== -1);
}

const BOUNDARY_CHARS = {
  '-': true,
  '_': true,
  ':': true,
  '/': true,
  '\\': true
};

/**
 * A slower check that makes sure search terms can be found on word
 * boundaries.
 */

const BOUNDARY_RE = /\W/;

function charTest(ch) {
  if (BOUNDARY_RE.test(ch)) {
    return "(?:.*\\" + ch + ")";
  } else {
    return "(?:" + ch + "|.*\\W" + ch + ")";
  }
}

exports.pathMatchExpression = function(search) {
  let ch = search[0];
  let ch = BOUNDARY_RE.test(ch) ? "\\" + ch : ch;
  let expr = "((?:^" + ch + ")|\\W" + ch + ")";
  for (let i = 1; i < search.length; i++) {
    expr += charTest(search[i]);
  }
  console.log("expression: " + expr);
  return new RegExp(expr);
}
