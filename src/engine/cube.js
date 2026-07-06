// Rubik's Cube engine — facelet model, URFDLB order (Kociemba/cubejs compatible).
//
// Facelet indices:
//   U: 0..8   R: 9..17  F: 18..26  D: 27..35  L: 36..44  B: 45..53
// Each face laid out as:
//   0 1 2
//   3 4 5
//   6 7 8
//
// Solved string: UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB

import { PERMS } from './moves.generated.js';

export const FACES = ['U', 'R', 'F', 'D', 'L', 'B'];
export const SOLVED = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';

// PERMS[token] is a facelet permutation: newState[i] = oldState[PERMS[token][i]].
// Verified against the cubejs cubie model (see scripts/gen-moves.mjs).
function applyPerm(state, perm) {
  const out = new Array(54);
  for (let i = 0; i < 54; i++) out[i] = state[perm[i]];
  return out;
}

export class Cube {
  constructor(state) {
    this.state = state ? state.slice() : SOLVED.split('');
  }

  static solved() {
    return new Cube();
  }

  static fromString(str) {
    if (str.length !== 54) throw new Error('facelet string must be 54 chars');
    return new Cube(str.split(''));
  }

  clone() {
    return new Cube(this.state);
  }

  toString() {
    return this.state.join('');
  }

  isSolved() {
    return this.toString() === SOLVED;
  }

  // Apply a single move token: U, U', U2, R, R', ... etc.
  move(token) {
    const perm = PERMS[token];
    if (!perm) throw new Error('unknown move: ' + token);
    this.state = applyPerm(this.state, perm);
    return this;
  }

  // Apply a whitespace-separated sequence of moves.
  moves(seq) {
    const list = Array.isArray(seq) ? seq : seq.trim().split(/\s+/).filter(Boolean);
    for (const m of list) this.move(m);
    return this;
  }
}

export const ALL_MOVES = [];
for (const f of FACES) for (const suf of ['', "'", '2']) ALL_MOVES.push(f + suf);

export function invertMove(m) {
  if (m.endsWith('2')) return m;
  if (m.endsWith("'")) return m[0];
  return m + "'";
}

export function invertSequence(seq) {
  const list = Array.isArray(seq) ? seq : seq.trim().split(/\s+/).filter(Boolean);
  return list.slice().reverse().map(invertMove);
}

export function randomScramble(n = 25, rng = Math.random) {
  const faces = ['U', 'R', 'F', 'D', 'L', 'B'];
  const sufs = ['', "'", '2'];
  const out = [];
  let last = '';
  for (let i = 0; i < n; i++) {
    let f;
    do { f = faces[Math.floor(rng() * 6)]; } while (f === last);
    last = f;
    out.push(f + sufs[Math.floor(rng() * 3)]);
  }
  return out;
}
