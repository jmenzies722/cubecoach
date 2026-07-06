// Probe the exact permutation effect of candidate last-layer algorithms so the
// solver is built on verified pieces, not memory. Reports which facelets change.
import { Cube, SOLVED } from '../src/engine/cube.js';

// edge/corner facelet tables (URFDLB)
const edges = { UR:[5,10], UF:[7,19], UL:[3,37], UB:[1,46] };
const corners = { URF:[8,9,20], UFL:[6,18,38], ULB:[0,36,47], UBR:[2,45,11] };

function describe(alg) {
  const c = new Cube().moves(alg);
  const s = c.toString();
  const changed = [];
  for (let i = 0; i < 54; i++) if (s[i] !== SOLVED[i]) changed.push(i);
  // classify U-layer pieces
  const eStatus = Object.entries(edges).map(([k, [a, b]]) => {
    const up = s[a], side = s[b];
    return `${k}:${up}${side}`;
  });
  const cStatus = Object.entries(corners).map(([k, [a, b, d]]) => `${k}:${s[a]}${s[b]}${s[d]}`);
  // did anything below the U layer change? (facelets not touching U row)
  const nonU = changed.filter((i) => ![...Object.values(edges), ...Object.values(corners)].flat().includes(i));
  return { alg, changedCount: changed.length, eStatus, cStatus, disturbsBelowU: nonU.length > 0, nonU };
}

const candidates = [
  ['yellow-cross', "F R U R' U' F'"],
  ['sune', "R U R' U R U2 R'"],
  ['antisune', "R U2 R' U' R U' R'"],
  ['U-perm-a', "R U' R U R U R U' R' U' R2"],
  ['U-perm-b', "R2 U R U R' U' R' U' R' U R'"],
  ['edge-3cyc', "F2 U L R' F2 L' R U F2"],
  ['corner-3cyc', "U R U' L' U R' U' L"],
  ['corner-3cyc2', "R' F R' B2 R F' R' B2 R2"], // A-perm-ish
  ['RDRD-x2', "R' D' R D R' D' R D"],
];

for (const [name, alg] of candidates) {
  const d = describe(alg);
  console.log(`\n== ${name}: ${alg}`);
  console.log('  edges  :', d.eStatus.join('  '));
  console.log('  corners:', d.cStatus.join('  '));
  console.log('  belowU changed:', d.disturbsBelowU, d.disturbsBelowU ? d.nonU.join(',') : '');
}
console.log('\nSolved edges  :', Object.entries(edges).map(([k,[a,b]])=>`${k}:${SOLVED[a]}${SOLVED[b]}`).join('  '));
console.log('Solved corners:', Object.entries(corners).map(([k,[a,b,d]])=>`${k}:${SOLVED[a]}${SOLVED[b]}${SOLVED[d]}`).join('  '));
