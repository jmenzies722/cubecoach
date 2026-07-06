// Prove the 3D geometry is consistent with the verified engine:
// for every base move, physically rotating the SOURCE sticker (pos+normal) by
// the move's rotation must land exactly on the DESTINATION facelet's pos+normal.
import { FACELETS, MOVE_GEOMETRY } from '../src/engine/geometry.js';
import { PERMS } from '../src/engine/moves.generated.js';

// Rotate an integer vector 90*sign degrees about an axis (right-hand rule).
function rot(v, axisIndex, sign) {
  const [x, y, z] = v;
  if (axisIndex === 0) return sign > 0 ? [x, -z, y] : [x, z, -y]; // about x
  if (axisIndex === 1) return sign > 0 ? [z, y, -x] : [-z, y, x]; // about y
  return sign > 0 ? [-y, x, z] : [y, -x, z]; // about z
}
const eq = (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];

let bad = 0;
for (const [face, g] of Object.entries(MOVE_GEOMETRY)) {
  const perm = PERMS[face]; // clockwise base move
  for (let i = 0; i < 54; i++) {
    const src = FACELETS[perm[i]];
    const dst = FACELETS[i];
    // Only stickers in the turning layer move; others map to themselves.
    const inLayer = dst.pos[g.axisIndex] === g.layer;
    if (!inLayer) {
      if (perm[i] !== i) { bad++; console.log(`${face}: facelet ${i} moved but not in layer`); }
      continue;
    }
    const rp = rot(src.pos, g.axisIndex, g.dir);
    const rn = rot(src.normal, g.axisIndex, g.dir);
    if (!eq(rp, dst.pos) || !eq(rn, dst.normal)) {
      bad++;
      if (bad <= 8) console.log(`${face}: facelet ${i} mismatch  rotated(src)=${rp}/${rn} dst=${dst.pos}/${dst.normal}`);
    }
  }
}
if (bad) { console.log(`GEOMETRY MISMATCH: ${bad} facelets`); process.exit(1); }
else console.log('Geometry consistent with engine for all 6 base moves ✓');
