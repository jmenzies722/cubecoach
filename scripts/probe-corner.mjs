// Discover correct white-corner insertion algorithms for ALL four first-layer
// pillars and each white orientation, by BFS. Prints a table to hardcode.
import { Cube } from '../src/engine/cube.js';

const crossSolved = { 28: 'D', 25: 'F', 32: 'D', 16: 'R', 34: 'D', 52: 'B', 30: 'D', 43: 'L', 31: 'D' };
const crossOK = (s) => Object.entries(crossSolved).every(([i, v]) => s[i] === v);
const at = (s, idx, colors) => idx.map((i) => s[i]).sort().join('') === [...colors].sort().join('');

const PILLARS = {
  DFR: { slot: [29, 26, 15], above: [8, 9, 20], colors: ['D', 'F', 'R'], down: 29 },
  DFL: { slot: [27, 44, 24], above: [6, 18, 38], colors: ['D', 'F', 'L'], down: 27 },
  DBL: { slot: [33, 53, 42], above: [0, 36, 47], colors: ['D', 'L', 'B'], down: 33 },
  DRB: { slot: [35, 17, 51], above: [2, 45, 11], colors: ['D', 'R', 'B'], down: 35 },
};
const gens = ['R', "R'", 'U', "U'", 'F', "F'", 'L', "L'", 'B', "B'"];

function findReps(p) {
  const reps = {};
  const q = [new Cube().toString()];
  const seen = new Set(q); let head = 0;
  const startSeqLen = new Map([[q[0], 0]]);
  while (head < q.length) {
    const s = q[head++];
    const dl = startSeqLen.get(s);
    if (at(s, p.above, p.colors) && crossOK(s)) {
      const dPos = p.above.find((i) => s[i] === 'D');
      if (dPos != null && reps[dPos] == null) reps[dPos] = s;
    }
    if (Object.keys(reps).length === 3 || dl >= 5) continue;
    for (const g of gens) {
      const ns = new Cube(s.split('')).move(g).toString();
      if (!seen.has(ns)) { seen.add(ns); startSeqLen.set(ns, dl + 1); q.push(ns); }
    }
  }
  return reps;
}
function findInsert(p, startState) {
  const q = [startState]; const seen = new Set(q); const len = new Map([[startState, 0]]);
  const seq = new Map([[startState, []]]); let head = 0;
  while (head < q.length) {
    const s = q[head++];
    if (at(s, p.slot, p.colors) && s[p.down] === 'D' && crossOK(s)) return seq.get(s);
    if (len.get(s) >= 7) continue;
    for (const g of gens) {
      const ns = new Cube(s.split('')).move(g).toString();
      if (!seen.has(ns)) { seen.add(ns); len.set(ns, len.get(s) + 1); seq.set(ns, [...seq.get(s), g]); q.push(ns); }
    }
  }
  return null;
}

for (const [name, p] of Object.entries(PILLARS)) {
  const reps = findReps(p);
  const out = [];
  for (const pos of p.above) {
    if (!reps[pos]) { out.push(`  [facelet ${pos}] no-rep`); continue; }
    const alg = findInsert(p, reps[pos]);
    const role = pos === p.above[0] ? 'UP' : (pos === p.above[1] ? 'sideA' : 'sideB');
    out.push(`  [D on facelet ${pos} = ${role}] -> ${alg ? alg.join(' ') : 'NONE'}`);
  }
  console.log(name + ' (above facelets ' + p.above.join(',') + '):\n' + out.join('\n'));
}
