// Oracle: the LBL solver must solve N random scrambles to completion.
// A solve counts only if applying the returned flat move list leaves the cube SOLVED.
import { Cube, randomScramble } from '../src/engine/cube.js';
import { solve } from '../src/engine/solver.js';

const N = Number(process.argv[2] || 10000);
// Deterministic PRNG so failures are reproducible.
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let fails = 0, moveTotal = 0, maxMoves = 0;
const failSeeds = [];
for (let i = 0; i < N; i++) {
  const rng = mulberry32(i + 1);
  const scramble = randomScramble(25, rng);
  const cube = new Cube().moves(scramble);
  let result, ok = false;
  try {
    result = solve(cube.toString());
    const check = new Cube().moves(scramble);
    // validate stage moves concatenate to the flat list
    const staged = result.stages.flatMap((s) => s.moves);
    check.moves(result.moves);
    ok = check.isSolved() && staged.length === result.moves.length;
  } catch (e) {
    if (failSeeds.length < 5) failSeeds.push({ i, err: e.message, scramble: scramble.join(' ') });
  }
  if (ok) {
    moveTotal += result.moves.length;
    maxMoves = Math.max(maxMoves, result.moves.length);
  } else {
    fails++;
    if (failSeeds.length < 5 && result) failSeeds.push({ i, scramble: scramble.join(' '), moves: result.moves.length });
  }
}

console.log(`solved ${N - fails}/${N}`);
if (fails === 0) {
  console.log(`avg moves ${(moveTotal / N).toFixed(1)}, max ${maxMoves}`);
} else {
  console.log('FAILURES:', JSON.stringify(failSeeds, null, 2));
  process.exit(1);
}
