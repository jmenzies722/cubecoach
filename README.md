# Cubist

**Not a solver. A teacher.** Every other cube app dumps a wall of moves on you and
walks away. Cubist coaches you through *your own* cube — one stage, one *why*, at a
time — until the beginner Layer-by-Layer method actually sticks.

Paint or scramble a cube and get a step-by-step, 3D-animated solve broken into the
seven named stages of the beginner method (White Cross → First-Layer Corners →
Middle-Layer Edges → Last-Layer Cross → Orient Last Layer → Position Corners →
Position Edges), each with a plain-English explanation of what you're building and
why that stage comes before the next.

Three modes:

- **Coach** — scramble or paint in your real cube; get walked through the solve stage
  by stage, in 3D, with the reasoning before each move. Watch it solve, or step move
  by move in Guide mode.
- **Learn** — the method map: all seven stages, their triggers, and the logic that
  connects them, with a looping preview cube.
- **Drill** — type any algorithm in standard notation (or pick Sexy / Sune / T-perm /
  Sledgehammer) and run it forward or in reverse on the cube.

Web-first, mobile-responsive, installable (PWA). React + Vite + Three.js + Tailwind.

## Why this is trustworthy

The two things that make a cube app credible — the move engine and the solver — are
**machine-verified**, not vibe-checked:

- **Move engine** (`src/engine/cube.js`): all 18 face turns are generated from the
  cubie model of the battle-tested `cubejs` library (`scripts/gen-moves.mjs`) and
  fuzz-tested to match it over **5,000 random sequences** (`npm run test:engine`).
  Within-face sticker rotation is correct, not just color.
- **3D geometry** (`src/engine/geometry.js`): the facelet→cubelet mapping is proven
  consistent with the engine — rotating each source sticker by a move's physical
  rotation lands exactly on the engine's destination facelet
  (`node scripts/verify-geometry.mjs`). No pixel-peeping.
- **Solver** (`src/engine/solver.js`): a Layer-by-Layer (beginner method) solver whose
  last-layer insertions are **BFS-discovered, not memorized**, and which must solve
  **10,000 random scrambles to completion** (`npm run test:solve`).

When Cubist shows you a move, it is correct — and provably so.

## Develop

```bash
npm install
npm run dev            # start the app
npm run test:engine    # fuzz engine vs cubejs (5k sequences)
npm run test:solve     # solve 10k random scrambles end-to-end
node scripts/verify-geometry.mjs
npm run gen            # regenerate move perms from cubejs
npm run build          # production build -> dist/
```

## Architecture

```
src/engine/
  cube.js              # facelet engine, moves, scramble (verified)
  moves.generated.js   # AUTO-GENERATED move permutations
  geometry.js          # facelet <-> 3D cubelet mapping + move rotations
  solver.js            # Layer-by-Layer solver -> named, explained stages
src/ui/
  Cube3D.jsx           # react-three-fiber cube with animated turns
src/App.jsx            # Coach / Learn / Drill routes, playback, share URL
scripts/               # verification + codegen
```

## Roadmap

- **Shipped:** verified engine, BFS-backed LBL solver, 3D playback, seven-stage
  coaching with explanations, Coach/Learn/Drill, paint input, shareable `?c=` URL, PWA.
- **Next:** camera scan (scan your real cube), progress tracking, printable stage
  cheatsheet, CFOP/advanced methods.

---

Built by [Shua Labs](https://github.com/jmenzies722). The engine and solver are
open and verifiable — clone it and run the tests.
