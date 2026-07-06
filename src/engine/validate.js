// Validate whether a 54-facelet string is a real, solvable cube state.
// Checks: sticker counts, fixed centres, piece completeness, and the three
// solvability invariants (permutation parity, corner-twist sum, edge-flip sum).
import { FACES } from './cube.js';

const cornerFacelet = [
  [8, 9, 20], [6, 18, 38], [0, 36, 47], [2, 45, 11],
  [29, 26, 15], [27, 44, 24], [33, 53, 42], [35, 17, 51],
];
const edgeFacelet = [
  [5, 10], [7, 19], [3, 37], [1, 46], [32, 16], [28, 25],
  [30, 43], [34, 52], [23, 12], [21, 41], [50, 39], [48, 14],
];
const centerFacelet = [4, 13, 22, 31, 40, 49]; // U R F D L B

const faceOf = (idx) => FACES[Math.floor(idx / 9)];
// solved colour sets for each cubie (as sorted strings) + primary colours
const cornerColors = cornerFacelet.map((c) => c.map(faceOf));
const edgeColors = edgeFacelet.map((e) => e.map(faceOf));
const key = (arr) => arr.slice().sort().join('');
const cornerKey = cornerColors.map(key);
const edgeKey = edgeColors.map(key);

// primary colour of an edge cubie: the U/D colour if present, else the F/B colour
function edgePrimary(colors) {
  if (colors.includes('U')) return 'U';
  if (colors.includes('D')) return 'D';
  if (colors.includes('F')) return 'F';
  return 'B';
}

function permSign(perm) {
  let sign = 1;
  const seen = new Array(perm.length).fill(false);
  for (let i = 0; i < perm.length; i++) {
    if (seen[i]) continue;
    let len = 0, j = i;
    while (!seen[j]) { seen[j] = true; j = perm[j]; len++; }
    if (len % 2 === 0) sign = -sign;
  }
  return sign;
}

export function validateCube(state) {
  if (typeof state !== 'string' || state.length !== 54) {
    return { valid: false, reason: 'A cube needs exactly 54 stickers.' };
  }
  // 1) counts
  const counts = {};
  for (const ch of state) counts[ch] = (counts[ch] || 0) + 1;
  for (const f of FACES) {
    if (counts[f] !== 9) return { valid: false, reason: `You have ${counts[f] || 0} ${f} stickers — every colour needs exactly 9.` };
  }
  // 2) centres fixed
  for (let i = 0; i < 6; i++) {
    if (state[centerFacelet[i]] !== FACES[i]) return { valid: false, reason: 'Centre colours can\'t move — reset and keep them fixed.' };
  }

  // 3) corners
  const cp = new Array(8), co = new Array(8);
  for (let i = 0; i < 8; i++) {
    const cols = cornerFacelet[i].map((idx) => state[idx]);
    const j = cornerKey.indexOf(key(cols));
    if (j < 0) return { valid: false, reason: 'A corner has an impossible colour combination.' };
    cp[i] = j;
    // orientation: index of the U/D-coloured sticker
    const twist = cols.findIndex((c) => c === 'U' || c === 'D');
    if (twist < 0) return { valid: false, reason: 'A corner is missing its white/yellow sticker.' };
    co[i] = twist;
  }
  // 4) edges
  const ep = new Array(12), eo = new Array(12);
  for (let i = 0; i < 12; i++) {
    const cols = edgeFacelet[i].map((idx) => state[idx]);
    const j = edgeKey.indexOf(key(cols));
    if (j < 0) return { valid: false, reason: 'An edge has an impossible colour combination.' };
    ep[i] = j;
    const primary = edgePrimary(cols);
    eo[i] = cols[0] === primary ? 0 : 1;
  }

  // 5) each piece used exactly once
  if (new Set(cp).size !== 8) return { valid: false, reason: 'A corner piece is duplicated or missing.' };
  if (new Set(ep).size !== 12) return { valid: false, reason: 'An edge piece is duplicated or missing.' };

  // 6) invariants
  if (co.reduce((a, b) => a + b, 0) % 3 !== 0) return { valid: false, reason: 'A single corner is twisted — that state can\'t exist.' };
  if (eo.reduce((a, b) => a + b, 0) % 2 !== 0) return { valid: false, reason: 'A single edge is flipped — that state can\'t exist.' };
  if (permSign(cp) !== permSign(ep)) return { valid: false, reason: 'Two pieces are swapped — that state can\'t exist on a real cube.' };

  return { valid: true, reason: null };
}
