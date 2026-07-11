// Maps the 54-facelet string onto a 3D cube of 26 cubelets.
// The mapping is derived to be consistent with the engine's URFDLB facelet
// model (verified: shared stickers of a corner/edge land on the same cubelet).

// Face colors. Scheme: D=white (the "white cross" we solve first), U=yellow.
export const COLORS = {
  U: '#FFD11A', // yellow (last layer / top)
  D: '#F7F7F7', // white  (first layer / bottom)
  F: '#12B76A', // green
  B: '#2E6BE6', // blue
  R: '#E4463B', // red
  L: '#F08417', // orange
};

// For each face, map facelet grid index (r*3+c, 0..8) -> [x,y,z] cubelet coord
// (each of x,y,z in {-1,0,1}) plus the outward face normal.
function faceMapping(face, toCoord, normal) {
  const out = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      out.push({ pos: toCoord(r, c), normal });
    }
  }
  return out;
}

// Derivation (see notes): each face's (r,c) -> world coord.
const FACE_LAYOUT = {
  U: faceMapping('U', (r, c) => [c - 1, 1, r - 1], [0, 1, 0]),
  R: faceMapping('R', (r, c) => [1, 1 - r, 1 - c], [1, 0, 0]),
  F: faceMapping('F', (r, c) => [c - 1, 1 - r, 1], [0, 0, 1]),
  D: faceMapping('D', (r, c) => [c - 1, -1, 1 - r], [0, -1, 0]),
  L: faceMapping('L', (r, c) => [-1, 1 - r, c - 1], [-1, 0, 0]),
  B: faceMapping('B', (r, c) => [1 - c, 1 - r, -1], [0, 0, -1]),
};

const FACE_ORDER = ['U', 'R', 'F', 'D', 'L', 'B'];

// Flat table: FACELETS[i] = { pos:[x,y,z], normal:[nx,ny,nz], face } for i in 0..53
export const FACELETS = [];
FACE_ORDER.forEach((face) => {
  FACE_LAYOUT[face].forEach((cell) => {
    FACELETS.push({ ...cell, face });
  });
});

// Unique cubelet positions (26 of them — no hidden center).
export const CUBELETS = [];
{
  const seen = new Set();
  for (let x = -1; x <= 1; x++)
    for (let y = -1; y <= 1; y++)
      for (let z = -1; z <= 1; z++) {
        if (x === 0 && y === 0 && z === 0) continue;
        CUBELETS.push([x, y, z]);
        seen.add([x, y, z].join(','));
      }
}

// Given a facelet string, return the sticker color for each (cubeletPos, normal).
// Returns a map keyed by "x,y,z" -> array of { normal, color }.
// `colors` maps a facelet letter -> hex. Defaults to the canonical scheme, but the
// paint flow passes a custom map so a cube entered in any orientation renders in the
// player's own colours during the solve.
export function stickersFor(state, colors = COLORS) {
  const byCubelet = new Map();
  for (let i = 0; i < 54; i++) {
    const { pos, normal, face } = FACELETS[i];
    const key = pos.join(',');
    if (!byCubelet.has(key)) byCubelet.set(key, []);
    const letter = state[i];
    byCubelet.get(key).push({ normal, color: colors[letter] || '#111', letter, face, index: i });
  }
  return byCubelet;
}

// Move -> rotation axis, which cubelets it turns, and the clockwise angle sign.
// A layer is selected by the coordinate on `axisIndex` equal to `layer`.
export const MOVE_GEOMETRY = {
  U: { axis: [0, 1, 0], axisIndex: 1, layer: 1, dir: -1 },
  D: { axis: [0, 1, 0], axisIndex: 1, layer: -1, dir: 1 },
  R: { axis: [1, 0, 0], axisIndex: 0, layer: 1, dir: -1 },
  L: { axis: [1, 0, 0], axisIndex: 0, layer: -1, dir: 1 },
  F: { axis: [0, 0, 1], axisIndex: 2, layer: 1, dir: -1 },
  B: { axis: [0, 0, 1], axisIndex: 2, layer: -1, dir: 1 },
};

// Parse a move token -> { face, geom, turns } where turns is 1, 2, or -1 (prime).
export function parseMove(token) {
  const face = token[0];
  const geom = MOVE_GEOMETRY[face];
  let turns = 1;
  if (token.endsWith('2')) turns = 2;
  else if (token.endsWith("'")) turns = -1;
  return { face, geom, turns };
}
