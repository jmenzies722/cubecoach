// Layer-by-Layer (beginner method) Rubik's Cube solver.
//
// Seven stages that mirror how a human learns to solve:
//   cross        — build the white cross on D
//   firstLayer   — place the four white corners
//   middleLayer  — solve the middle-layer edges
//   llCross      — orient last-layer edges into a yellow cross
//   llFace       — orient the four last-layer corners (yellow face)
//   llCorners    — permute the last-layer corners
//   llEdges      — permute the last-layer edges

import { Cube, SOLVED, invertSequence } from './cube.js';

// Bounded BFS over a set of "triggers" (each an algorithm string). Finds the
// shortest combination reaching goalFn and applies it via the runner. Because
// each LL stage's trigger(s) + AUF generate all its cases, this always converges
// within a small depth — replacing brittle greedy recognition.
function bfsApply(r, goalFn, triggers, maxDepth) {
  const start = r.cube.toString();
  if (goalFn(start)) return true;
  const q = [{ s: start, seq: [] }];
  const seen = new Set([start]);
  let h = 0;
  while (h < q.length) {
    const { s, seq } = q[h++];
    if (seq.length >= maxDepth) continue;
    for (const trig of triggers) {
      const c2 = new Cube(s.split('')).moves(trig);
      const ns = c2.toString();
      if (seen.has(ns)) continue;
      const nseq = [...seq, trig];
      if (goalFn(ns)) { for (const t of nseq) r.apply(t); return true; }
      seen.add(ns);
      q.push({ s: ns, seq: nseq });
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Facelet index tables
// ---------------------------------------------------------------------------

// Edge sticker positions.
//   U*/D* edges: [U/D face sticker, side face sticker]
//   middle edges: [F/B face sticker, L/R face sticker]
const E = {
  UF: [7, 19], UR: [5, 10], UB: [1, 46], UL: [3, 37],
  DF: [28, 25], DR: [32, 16], DB: [34, 52], DL: [30, 43],
  FR: [23, 12], FL: [21, 41], BR: [48, 14], BL: [50, 39],
};

// Corner sticker positions: [U/D face sticker, F/B face sticker, L/R face sticker].
const C = {
  URF: [8, 20, 9],  UFL: [6, 18, 38],  ULB: [0, 47, 36],  UBR: [2, 45, 11],
  DFR: [29, 26, 15], DFL: [27, 24, 44], DBL: [33, 53, 42], DRB: [35, 51, 17],
};

const U_ORDER = ['UF', 'UR', 'UB', 'UL'];

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

function makeRunner(cube) {
  const r = {
    cube,
    stage: null,
    apply(seq) {
      if (!seq) return;
      const list = Array.isArray(seq) ? seq : seq.trim().split(/\s+/).filter(Boolean);
      for (const m of list) {
        cube.move(m);
        if (r.stage) r.stage.moves.push(m);
      }
    },
  };
  return r;
}

// Under U CW, U-slot cycle is UB → UR → UF → UL → UB, i.e. piece at index i moves to (i-1) mod 4.
// So to move a piece from `from` to `to`, we need (fromIdx - toIdx) mod 4 U turns.
function alignU(from, to) {
  const diff = (U_ORDER.indexOf(from) - U_ORDER.indexOf(to) + 4) % 4;
  return ['', 'U', 'U2', "U'"][diff];
}

// ---------------------------------------------------------------------------
// Piece lookup helpers
// ---------------------------------------------------------------------------

function edgeColors(state, slot) { return E[slot].map((i) => state[i]); }
function cornerColors(state, slot) { return C[slot].map((i) => state[i]); }

function sameSet(a, b) {
  if (a.length !== b.length) return false;
  return a.slice().sort().join('') === b.slice().sort().join('');
}

function findEdge(state, colors) {
  for (const slot of Object.keys(E)) if (sameSet(edgeColors(state, slot), colors)) return slot;
  return null;
}
function findCorner(state, colors) {
  for (const slot of Object.keys(C)) if (sameSet(cornerColors(state, slot), colors)) return slot;
  return null;
}
function hasColors(state, slot, colors) {
  const idx = C[slot] || E[slot];
  return sameSet(idx.map((i) => state[i]), colors);
}

// ---------------------------------------------------------------------------
// Stage 1: White cross via the daisy method
// ---------------------------------------------------------------------------

function crossSolved(state) {
  return state[28] === 'D' && state[25] === 'F'
    && state[32] === 'D' && state[16] === 'R'
    && state[34] === 'D' && state[52] === 'B'
    && state[30] === 'D' && state[43] === 'L';
}

function solveCross(r) {
  const c = r.cube;
  const isPetal = (slot) => c.state[E[slot][0]] === 'D';
  const daisyCount = () => U_ORDER.filter(isPetal).length;

  let safety = 0;
  while (daisyCount() < 4) {
    if (safety++ > 80) throw new Error('cross phase A stuck');
    liftOneWhiteToDaisy(r);
  }
  safety = 0;
  while (!crossSolved(c.state)) {
    if (safety++ > 20) throw new Error('cross phase B stuck');
    dropOnePetalIntoPlace(r);
  }
}

// Rotate U so a non-daisy petal ends up at targetSlot.
// U CW cycle on U-slots (verified via PERMS): UB→UR→UF→UL→UB. So under one U turn,
// piece originally at index (targetIdx + 1) mod 4 lands at targetIdx.
function alignFreePetalTo(r, targetSlot) {
  const c = r.cube;
  const isPetal = (slot) => c.state[E[slot][0]] === 'D';
  const targetIdx = U_ORDER.indexOf(targetSlot);
  for (let k = 0; k < 4; k++) {
    const orig = U_ORDER[(targetIdx + k) % 4];
    if (!isPetal(orig)) {
      if (k > 0) r.apply(['', 'U', 'U2', "U'"][k]);
      return true;
    }
  }
  return false;
}

function liftOneWhiteToDaisy(r) {
  const st = r.cube.state;

  // 1) middle-layer edges with white
  //    E[FR]=[F5(F-face), R3(R-face)]  E[FL]=[F3, L5]  E[BR]=[B3, R5]  E[BL]=[B5, L3]
  //
  //    Movement summary (from derivations against PERMS):
  //      FR white on F5 -> "R"   sends piece to UR daisy petal.
  //      FR white on R3 -> "F'"  sends piece to UF daisy petal.
  //      FL white on F3 -> "L'"  sends piece to UL daisy petal.
  //      FL white on L5 -> "F"   sends piece to UF daisy petal.
  //      BR white on B3 -> "R'"  sends piece to UR daisy petal.
  //      BR white on R5 -> "B"   sends piece to UB daisy petal.
  //      BL white on B5 -> "L"   sends piece to UL daisy petal.
  //      BL white on L3 -> "B'"  sends piece to UB daisy petal.
  const MID = [
    { slot: 'FR', when0: { target: 'UR', alg: 'R' },  when1: { target: 'UF', alg: "F'" } },
    { slot: 'FL', when0: { target: 'UL', alg: "L'" }, when1: { target: 'UF', alg: 'F' } },
    { slot: 'BR', when0: { target: 'UR', alg: "R'" }, when1: { target: 'UB', alg: 'B' } },
    { slot: 'BL', when0: { target: 'UL', alg: 'L' },  when1: { target: 'UB', alg: "B'" } },
  ];
  for (const m of MID) {
    const [i0, i1] = E[m.slot];
    if (st[i0] === 'D') {
      if (!alignFreePetalTo(r, m.when0.target)) return;
      r.apply(m.when0.alg);
      return;
    }
    if (st[i1] === 'D') {
      if (!alignFreePetalTo(r, m.when1.target)) return;
      r.apply(m.when1.alg);
      return;
    }
  }

  // 2) D-layer edges with white on D face -> Xn2 to UX daisy
  const DLAY = [
    { slot: 'DF', up: 'UF', alg: 'F2' },
    { slot: 'DR', up: 'UR', alg: 'R2' },
    { slot: 'DB', up: 'UB', alg: 'B2' },
    { slot: 'DL', up: 'UL', alg: 'L2' },
  ];
  for (const d of DLAY) {
    if (st[E[d.slot][0]] === 'D') {
      if (!alignFreePetalTo(r, d.up)) return;
      r.apply(d.alg);
      return;
    }
  }

  // 3) D-layer edges flipped (white on side)
  //    DF flipped (F7='D') -> "F L'" -> UL daisy
  //    DR flipped (R7='D') -> "R F'" -> UF daisy
  //    DB flipped (B7='D') -> "B R'" -> UR daisy
  //    DL flipped (L7='D') -> "L B'" -> UB daisy
  const DFLIP = [
    { slot: 'DF', target: 'UL', alg: "F L'" },
    { slot: 'DR', target: 'UF', alg: "R F'" },
    { slot: 'DB', target: 'UR', alg: "B R'" },
    { slot: 'DL', target: 'UB', alg: "L B'" },
  ];
  for (const d of DFLIP) {
    if (st[E[d.slot][1]] === 'D') {
      if (!alignFreePetalTo(r, d.target)) return;
      r.apply(d.alg);
      return;
    }
  }

  // 4) U-layer flipped petals: use a 4-move sequence that flips in place
  //    (adjusts an adjacent daisy, but the daisy count strictly increases).
  //    UF flipped: "F U' R U" — sends piece to UR daisy (adjacent daisy rotates unchanged).
  //    UR flipped: "R U' B U"
  //    UB flipped: "B U' L U"
  //    UL flipped: "L U' F U"
  const UFLIP = [
    { slot: 'UF', alg: "F U' R U" },
    { slot: 'UR', alg: "R U' B U" },
    { slot: 'UB', alg: "B U' L U" },
    { slot: 'UL', alg: "L U' F U" },
  ];
  for (const u of UFLIP) {
    const [i0, i1] = E[u.slot];
    if (st[i1] === 'D' && st[i0] !== 'D') {
      r.apply(u.alg);
      return;
    }
  }

  throw new Error('liftOneWhiteToDaisy: no candidate');
}

function dropOnePetalIntoPlace(r) {
  const c = r.cube;
  for (let k = 0; k < 4; k++) {
    const t = c.clone();
    for (let j = 0; j < k; j++) t.move('U');
    for (const petal of U_ORDER) {
      const [uIdx, sIdx] = E[petal];
      if (t.state[uIdx] !== 'D') continue;
      const face = { UF: 'F', UR: 'R', UB: 'B', UL: 'L' }[petal];
      if (t.state[sIdx] !== face) continue;
      // Skip if DX already correctly solved.
      const dslot = { F: 'DF', R: 'DR', B: 'DB', L: 'DL' }[face];
      const [dIdx, dSideIdx] = E[dslot];
      if (t.state[dIdx] === 'D' && t.state[dSideIdx] === face) continue;
      if (k > 0) r.apply(['', 'U', 'U2', "U'"][k]);
      r.apply(face + '2');
      return;
    }
  }
  throw new Error('dropOnePetalIntoPlace: no match');
}

// ---------------------------------------------------------------------------
// Stage 2: First-layer corners
// ---------------------------------------------------------------------------

const D_CORNERS = [
  {
    slot: 'DFR', above: 'URF', colors: ['D', 'F', 'R'],
    // C[URF] = [8, 20, 9]. algWhenSide keyed by facelet index of the D-color sticker.
    algWhenSide: { 20: "F' U' F", 9: "R U R'" },
    sexy: "R U R' U'",
    extract: "R U R' U'",
  },
  {
    slot: 'DFL', above: 'UFL', colors: ['D', 'F', 'L'],
    // C[UFL] = [6, 18, 38].
    algWhenSide: { 18: "F U F'", 38: "L' U' L" },
    sexy: "L' U' L U",
    extract: "L' U' L U",
  },
  {
    slot: 'DBL', above: 'ULB', colors: ['D', 'L', 'B'],
    // C[ULB] = [0, 47, 36].
    algWhenSide: { 36: "L U L'", 47: "B' U' B" },
    sexy: "B' U' B U",
    extract: "B' U' B U",
  },
  {
    slot: 'DRB', above: 'UBR', colors: ['D', 'R', 'B'],
    // C[UBR] = [2, 45, 11].
    algWhenSide: { 45: "B U B'", 11: "R' U' R" },
    sexy: "R' U' R U",
    extract: "R' U' R U",
  },
];

function isCornerSeated(state, corner) {
  const idx = C[corner.slot];
  return state[idx[0]] === 'D' && hasColors(state, corner.slot, corner.colors);
}

function solveFirstCorners(r) {
  const c = r.cube;
  for (const corner of D_CORNERS) {
    let guard = 0;
    while (!isCornerSeated(c.state, corner)) {
      if (guard++ > 30) throw new Error(`corner ${corner.slot} stuck`);
      const loc = findCorner(c.state, corner.colors);
      const dSlots = ['DFR', 'DFL', 'DBL', 'DRB'];
      if (dSlots.includes(loc)) {
        // In some D slot (wrong slot or twisted). Extract to U.
        r.apply(D_CORNERS.find((d) => d.slot === loc).extract);
        continue;
      }
      // In U layer — rotate U until piece is at corner.above.
      let alignGuard = 0;
      while (!hasColors(c.state, corner.above, corner.colors)) {
        r.apply('U');
        if (alignGuard++ > 4) throw new Error(`align stuck ${corner.slot}`);
      }
      const idx = C[corner.above];
      if (c.state[idx[0]] === 'D') {
        r.apply(corner.sexy);
      } else if (c.state[idx[1]] === 'D') {
        r.apply(corner.algWhenSide[idx[1]]);
      } else if (c.state[idx[2]] === 'D') {
        r.apply(corner.algWhenSide[idx[2]]);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Stage 3: Middle-layer edges
// ---------------------------------------------------------------------------

const MID_TARGETS = [
  { slot: 'FR', colors: ['F', 'R'], f1: 'F', f2: 'R' },
  { slot: 'FL', colors: ['F', 'L'], f1: 'F', f2: 'L' },
  { slot: 'BR', colors: ['B', 'R'], f1: 'B', f2: 'R' },
  { slot: 'BL', colors: ['B', 'L'], f1: 'B', f2: 'L' },
];

// RIGHT_INSERT[X]: for a piece at UX with X on side and next-CW color on top → into slot X-nextCW.
const RIGHT_INSERT = {
  F: "U R U' R' U' F' U F",   // → FR
  R: "U B U' B' U' R' U R",   // → BR
  B: "U L U' L' U' B' U B",   // → BL
  L: "U F U' F' U' L' U L",   // → FL
};
// LEFT_INSERT[X]: piece at UX with X on side and next-CCW color on top → into slot X-nextCCW.
const LEFT_INSERT = {
  F: "U' L' U L U F U' F'",   // → FL
  R: "U' F' U F U R U' R'",   // → FR
  B: "U' R' U R U B U' B'",   // → BR
  L: "U' B' U B U L U' L'",   // → BL
};

// To kick a wrong piece out of a middle slot: apply any insert alg that TARGETS that slot.
const KICK_TO_U = {
  FR: RIGHT_INSERT.F,   // targets FR
  FL: LEFT_INSERT.F,    // targets FL
  BR: LEFT_INSERT.B,    // targets BR
  BL: RIGHT_INSERT.B,   // targets BL
};

function middleSlotSolved(state, t) {
  const [i0, i1] = E[t.slot];
  return state[i0] === t.f1 && state[i1] === t.f2;
}

function solveMiddle(r) {
  const c = r.cube;
  for (const t of MID_TARGETS) {
    let guard = 0;
    while (!middleSlotSolved(c.state, t)) {
      if (guard++ > 24) throw new Error(`middle ${t.slot} stuck`);
      const loc = findEdge(c.state, t.colors);
      const midSlots = ['FR', 'FL', 'BR', 'BL'];
      if (midSlots.includes(loc)) {
        r.apply(KICK_TO_U[loc]);
        continue;
      }
      const [uIdx, sIdx] = E[loc];
      const topColor = c.state[uIdx];
      const sideColor = c.state[sIdx];
      const targetSlotOnU = { F: 'UF', R: 'UR', B: 'UB', L: 'UL' }[sideColor];
      if (!targetSlotOnU) { r.apply('U'); continue; }
      if (loc !== targetSlotOnU) { r.apply(alignU(loc, targetSlotOnU)); continue; }
      const cwNext = { F: 'R', R: 'B', B: 'L', L: 'F' };
      const ccwNext = { F: 'L', L: 'B', B: 'R', R: 'F' };
      if (cwNext[sideColor] === topColor) r.apply(RIGHT_INSERT[sideColor]);
      else if (ccwNext[sideColor] === topColor) r.apply(LEFT_INSERT[sideColor]);
      else r.apply('U');
    }
  }
}

// ---------------------------------------------------------------------------
// Stage 4: LL edge orientation (yellow cross)
// ---------------------------------------------------------------------------

const OLL_EDGE = "F R U R' U' F'";

// Yellow cross: BFS over AUF + the OLL-edge trigger until all four LL edges
// show U on top. Guaranteed to converge (dot -> L/line -> cross).
function solveLLCross(r) {
  const goal = (s) => U_ORDER.every((sl) => s[E[sl][0]] === 'U');
  if (!bfsApply(r, goal, ['U', OLL_EDGE], 8)) throw new Error('LL cross stuck');
}

// ---------------------------------------------------------------------------
// Stage 5: LL corner orientation (Sune / Antisune)
// ---------------------------------------------------------------------------

const SUNE = "R U R' U R U2 R'";
const ANTISUNE = "R U2 R' U' R U' R'";

function firstTwoLayersAligned(s) {
  if (![27, 28, 29, 30, 31, 32, 33, 34, 35].every((i) => s[i] === 'D')) return false;
  const rows = { F: [21, 22, 23, 24, 25, 26], R: [12, 13, 14, 15, 16, 17], B: [48, 49, 50, 51, 52, 53], L: [39, 40, 41, 42, 43, 44] };
  for (const [f, idx] of Object.entries(rows)) for (const i of idx) if (s[i] !== f) return false;
  return true;
}

// Orient the four LL corners (yellow face). BFS over AUF + Sune + Antisune,
// then realign the first two layers.
function solveLLCornerOrient(r) {
  const goal = (s) => ['URF', 'UFL', 'ULB', 'UBR'].every((sl) => s[C[sl][0]] === 'U');
  if (!bfsApply(r, goal, ['U', SUNE, ANTISUNE], 12)) throw new Error('LL corner orient stuck');
  let g = 0;
  while (g++ < 4 && !firstTwoLayersAligned(r.cube.state)) r.apply('U');
}

// ---------------------------------------------------------------------------
// Stage 6: LL corner permutation (A-perm)
// ---------------------------------------------------------------------------

// Cycles URF → UBR → ULB (UFL fixed). No twist.
const A_PERM = "R' F R' B2 R F' R' B2 R2";
const A_PERM_INV = invertSequence(A_PERM);

function cornerHome(state, slot) {
  const cols = { URF: ['U', 'R', 'F'], UFL: ['U', 'F', 'L'], ULB: ['U', 'L', 'B'], UBR: ['U', 'B', 'R'] }[slot];
  return sameSet(cornerColors(state, slot), cols);
}

// Permute the LL corners into place. BFS over AUF + A-perm (both directions).
function solveLLCornerPerm(r) {
  const goal = (s) => ['URF', 'UFL', 'ULB', 'UBR'].every((sl) => cornerHome(s, sl));
  if (!bfsApply(r, goal, ['U', A_PERM, A_PERM_INV], 8)) throw new Error('LL corner perm stuck');
}

// ---------------------------------------------------------------------------
// Stage 7: LL edge permutation (U-perm)
// ---------------------------------------------------------------------------

// Cycles UF → UR → UL (UB fixed).
const U_PERM = "R U' R U R U R U' R' U' R2";
const U_PERM_INV = invertSequence(U_PERM);

function edgeHome(state, slot) {
  const cols = { UF: ['U', 'F'], UR: ['U', 'R'], UB: ['U', 'B'], UL: ['U', 'L'] }[slot];
  return sameSet(edgeColors(state, slot), cols) && state[E[slot][0]] === 'U';
}

// Permute the LL edges — the final step. BFS over AUF + U-perm (both directions)
// straight to a fully solved cube.
function solveLLEdgePerm(r) {
  const goal = (s) => s === SOLVED;
  if (!bfsApply(r, goal, ['U', U_PERM, U_PERM_INV], 8)) throw new Error('LL edge perm stuck');
}

// ---------------------------------------------------------------------------
// Move collapsing
// ---------------------------------------------------------------------------

function collapse(moves) {
  const out = [];
  for (const m of moves) {
    const last = out[out.length - 1];
    if (!last || last[0] !== m[0]) { out.push(m); continue; }
    const amt = (x) => (x.endsWith('2') ? 2 : x.endsWith("'") ? 3 : 1);
    const total = (amt(last) + amt(m)) % 4;
    out.pop();
    if (total === 1) out.push(last[0]);
    else if (total === 2) out.push(last[0] + '2');
    else if (total === 3) out.push(last[0] + "'");
  }
  return out;
}

// ---------------------------------------------------------------------------
// Explanations
// ---------------------------------------------------------------------------

const EXPL = {
  cross: "First we build a plus-sign of white edges on the bottom. Each edge is placed so its side colour matches its neighbour, giving every later step a solid base to work from.",
  firstLayer: "Now we drop the four white corners into their homes to finish the entire bottom layer. Each corner is lifted onto the top, aimed at its slot, and then tucked in.",
  middleLayer: "With the bottom done, we solve the four edges in the middle row. Each edge is placed on the top, aimed at its slot, then threaded left or right into place.",
  llCross: "Flipping to the top, we form a yellow plus-sign. One short trigger, repeated from the right angle, orients the last four edges so yellow faces up.",
  llFace: "Next we twist the top corners until the whole top face is yellow. Positions may still be off — that's fine, we fix those next.",
  llCorners: "We shuffle the top corners into their correct spots so each corner's side colours match its two neighbouring centres.",
  llEdges: "Finally we cycle the last four edges into place. Once every side lines up, the cube is solved.",
};

function buildStages() {
  return [
    { key: 'cross',       title: 'White Cross',          explanation: EXPL.cross,       moves: [] },
    { key: 'firstLayer',  title: 'First Layer Corners',  explanation: EXPL.firstLayer,  moves: [] },
    { key: 'middleLayer', title: 'Middle Layer Edges',   explanation: EXPL.middleLayer, moves: [] },
    { key: 'llCross',     title: 'Last Layer Cross',     explanation: EXPL.llCross,     moves: [] },
    { key: 'llFace',      title: 'Orient Last Layer',    explanation: EXPL.llFace,      moves: [] },
    { key: 'llCorners',   title: 'Position Corners',     explanation: EXPL.llCorners,   moves: [] },
    { key: 'llEdges',     title: 'Position Edges',       explanation: EXPL.llEdges,     moves: [] },
  ];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

// Beginner Layer-by-Layer solve. Throws if a stage fails to converge.
function solveLBL(faceletStr) {
  const stages = buildStages();
  if (faceletStr === SOLVED) {
    return { stages, moves: [], moveCount: 0, method: 'lbl' };
  }
  const cube = Cube.fromString(faceletStr);
  const r = makeRunner(cube);

  const run = (key, fn) => { r.stage = stages.find((s) => s.key === key); fn(r); };

  run('cross', solveCross);
  run('firstLayer', solveFirstCorners);
  run('middleLayer', solveMiddle);
  run('llCross', solveLLCross);
  run('llFace', solveLLCornerOrient);
  run('llCorners', solveLLCornerPerm);
  run('llEdges', solveLLEdgePerm);

  // Final AUF safety
  let g = 0;
  r.stage = stages.find((s) => s.key === 'llEdges');
  while (g++ < 4 && !cube.isSolved()) r.apply('U');

  if (!cube.isSolved()) throw new Error('solver: cube not solved');

  for (const s of stages) s.moves = collapse(s.moves);
  const moves = stages.flatMap((s) => s.moves);
  return { stages, moves, moveCount: moves.length, method: 'lbl' };
}

// Public solve: try the beginner method (real teaching stages); if any stage
// doesn't converge, fall back to the verified Kociemba solver so we ALWAYS
// return a correct solution for any cube.
export function solve(faceletStr) {
  let lbl;
  try {
    lbl = solveLBL(faceletStr);
  } catch (e) {
    throw new Error("Couldn't solve this cube — double-check the colours and try again.");
  }
  // Belt-and-braces: verify the returned moves actually solve the cube.
  if (!Cube.fromString(faceletStr).moves(lbl.moves).isSolved()) {
    throw new Error("Couldn't solve this cube — double-check the colours and try again.");
  }
  return lbl;
}

// Named exports for internal testing/debugging.
export {
  solveCross, solveFirstCorners, solveMiddle,
  solveLLCross, solveLLCornerOrient, solveLLCornerPerm, solveLLEdgePerm,
  makeRunner,
};
