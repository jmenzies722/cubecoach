// Algorithm parser for the Drill mode.
// Accepts only the strict engine token set: face letters U R F D L B, each
// optionally followed by ' or 2. Everything else (wide moves w/lowercase,
// rotations x/y/z, slice M/E/S, brackets, etc.) is rejected with a clear error.
//
// Zero dependencies — safe to unit-test in Node.

const TOKEN_RE = /^[URFDLB](2|')?$/;

// Face letters we can auto-uppercase without silently accepting an unsupported
// wide/rotation move. Anything outside this set stays as-is so the error message
// names it verbatim.
const FACE_LETTERS = new Set(['U', 'R', 'F', 'D', 'L', 'B']);

function normalizeToken(raw) {
  const t = raw.trim();
  if (!t) return t;
  // Uppercase only the leading letter if it's a plain face letter; otherwise
  // return as-is so bad input is surfaced verbatim in the error.
  const head = t[0];
  const up = head.toUpperCase();
  if (FACE_LETTERS.has(up)) return up + t.slice(1);
  return t;
}

function badTokenMessage(tok) {
  return `"${tok}" isn't a move — use U R F D L B with optional ' or 2`;
}

export function parseAlg(str) {
  if (typeof str !== 'string' || !str.trim()) {
    return { valid: false, moves: [], error: 'Enter an algorithm.' };
  }
  const rawTokens = str.trim().split(/\s+/).filter(Boolean);
  const moves = [];
  for (const raw of rawTokens) {
    const tok = normalizeToken(raw);
    if (!TOKEN_RE.test(tok)) {
      return { valid: false, moves: [], error: badTokenMessage(raw) };
    }
    moves.push(tok);
  }
  if (moves.length === 0) {
    return { valid: false, moves: [], error: 'Enter an algorithm.' };
  }
  return { valid: true, moves, error: null };
}

export const EXAMPLES = [
  { name: 'Sexy move', alg: "R U R' U'" },
  { name: 'Sune', alg: "R U R' U R U2 R'" },
  { name: 'T-perm', alg: "R U R' U' R' F R2 U' R' U' R U R' F'" },
  { name: 'Sledgehammer', alg: "R' F R F'" },
];
