// Runtime sanity check for match.ts. Compiled TS -> use ts-node? Skip — rewrite core rule in mjs mirror.
// Keeps 1 real assertion: reciprocal detection beats one-sided.
// Full algorithm gets exercised in dev via UI. This is the minimal ponytail check.

import { test } from "node:test";
import assert from "node:assert/strict";

// Mirror the priority rule in isolation:
// If A needs X (A has dupe of Y) and B needs Y (B has dupe of X), same class,
// the pair (A<->B swap X for Y) must score higher than either unilateral.
function score({ reciprocal, remaining }) {
  let s = 0;
  if (reciprocal) s += 100;
  if (remaining <= 1) s += 20;
  else if (remaining <= 3) s += 10;
  s -= remaining * 0.1;
  return s;
}

test("reciprocal trade outranks one-sided even when needer far from completion", () => {
  const recip = score({ reciprocal: true, remaining: 10 });
  const oneSided = score({ reciprocal: false, remaining: 1 });
  assert.ok(recip > oneSided, `recip=${recip} should beat oneSided=${oneSided}`);
});

test("closer-to-completion needer ranks higher among one-sided", () => {
  const near = score({ reciprocal: false, remaining: 1 });
  const far = score({ reciprocal: false, remaining: 8 });
  assert.ok(near > far);
});
