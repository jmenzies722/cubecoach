// Fuzz-test our engine against cubejs. If facelet strings match over many
// random sequences, our move system is provably consistent with a trusted ref.
import CubeJS from 'cubejs';
import { Cube, ALL_MOVES } from '../src/engine/cube.js';

// 1) Single-move check — localize any broken move immediately.
let singleFail = [];
for (const m of ALL_MOVES) {
  const mine = new Cube().move(m).toString();
  const ref = new CubeJS(); ref.move(m); const refs = ref.asString();
  if (mine !== ref.asString()) singleFail.push({ m, mine, ref: refs });
}
if (singleFail.length) {
  console.log('SINGLE-MOVE MISMATCHES:');
  for (const f of singleFail) console.log(` ${f.m}\n  mine: ${f.mine}\n  ref : ${f.ref}`);
} else {
  console.log('All 18 single moves match cubejs ✓');
}

// 2) Fuzz sequences.
let N = 5000, fails = 0, firstFail = null;
for (let i = 0; i < N; i++) {
  const len = 5 + (i % 30);
  const seq = [];
  for (let k = 0; k < len; k++) seq.push(ALL_MOVES[(Math.floor((Math.sin(i * 7.3 + k * 1.9) * 10000) % ALL_MOVES.length) + ALL_MOVES.length) % ALL_MOVES.length]);
  const mine = new Cube().moves(seq).toString();
  const ref = new CubeJS(); ref.move(seq.join(' '));
  if (mine !== ref.asString()) {
    fails++;
    if (!firstFail) firstFail = { seq: seq.join(' '), mine, ref: ref.asString() };
  }
}
if (fails) {
  console.log(`FUZZ: ${fails}/${N} mismatches`);
  console.log(' first fail seq:', firstFail.seq);
  console.log('  mine:', firstFail.mine);
  console.log('  ref :', firstFail.ref);
  process.exit(1);
} else {
  console.log(`Fuzz ${N}/${N} sequences match cubejs ✓`);
}
