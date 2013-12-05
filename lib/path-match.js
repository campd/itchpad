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

/**
 * A slower check that makes sure search terms can be found on word
 * boundaries.
 */

const BOUNDARY_RE = /\W/;

function charTest(ch) {
  if (BOUNDARY_RE.test(ch)) {
    return "(?:(\\" + ch + ")|(.*)(\\" + ch + "))";
  } else {
    return "(?:(" + ch + ")|(.*)\\b(" + ch + "))";
  }
}

exports.pathMatchExpression = function(search) {
  let ch = search[0];
  let ch = BOUNDARY_RE.test(ch) ? "\\" + ch : ch;
  let expr = "(.*)(?:(^" + ch + ")|(.*)\\b(" + ch + "))";
  for (let i = 1; i < search.length; i++) {
    expr += charTest(search[i]);
  }
  expr += "(.*)";
  return new RegExp(expr);
}

exports.annotate = function(re, path) {
  // The regular expression is constructed such that each character in the
  // search has three matches:
  // First will match for an immediate match
  // Second will match any interstitial path
  // Third will match if second matches.

  let matches = re.exec(path);
  if (!matches) {
    return null;
  }

  let open = null;
  let fragments = [];

  // 0 unused by exec, 3 matches expected per char, leading and trailing text
  if (matches.length % 3 != 0) {
    throw new Error("Unexpected match length!");
  }

  if (matches[1]) {
    fragments.push({ fragment: matches[1], matched: false });
  }

  for (let i = 2; i < matches.length - 1; i += 3) {
    let immediate = matches[i];
    let interstitial = matches[i + 1];
    let newWord = matches[i + 2];

    if (immediate) {
      if (!open) {
        open = { fragment: immediate, matched: true };
        fragments.push(open);
      } else {
        open.fragment += immediate;
      }
    } else {
      if (interstitial) {
        fragments.push({ fragment: interstitial, matched: false });
      }

      open = { fragment: newWord, matched: true };
      fragments.push(open);
    }
  }

  // ... and one trailing match for remaining stuff.
  let last = matches[matches.length - 1];
  if (last) {
    fragments.push({ fragment: last, matched: false });
  }

  return fragments;
}

exports.score = function(re, path) {
  let annotated = exports.annotate(re, path);
  if (!annotated) {
    return 0;
  }

  let score = 0;
  for (let item of annotated) {
    if (item.matched && item.fragment.length > score) {
      score = item.fragment.length;
    }
  }

  // Among items with the same score, prefer matches later
  // in the string.
  score = (score << 16) + (annotated[0].matched ? 0 : annotated[0].fragment.length & 0xffff);

  return score;
}
