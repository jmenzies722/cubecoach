# CubeCoach

Solve **any** Rubik's Cube — and actually learn how. Paint or scramble a cube, hit
solve, and get a step-by-step, 3D-animated solution broken into named stages
(White Cross → First Layer → Middle Layer → Last Layer) with plain-English
explanations of the *why* behind each stage.

Web-first, mobile-responsive. React + Vite + Three.js + Tailwind.

## Why this is trustworthy

The two things that make a cube app credible — the move engine and the solver —
are **machine-verified**, not vibe-checked:

- **Move engine** (`src/engine/cube.js`): all 18 face turns are generated from the
  cubie model of the battle-tested `cubejs` library (`scripts/gen-moves.mjs`) and
  fuzz-tested to match it over 5,000 random sequences
  (`npm run test:engine`). Within-face sticker rotation is correct, not just color.
- **3D geometry** (`src/engine/geometry.js`): the facelet→cubelet mapping is proven
  consistent with the engine — rotating each source sticker by a move's physical
  rotation lands exactly on the engine's destination facelet
  (`node scripts/verify-geometry.mjs`). No pixel-peeping.
- **Solver** (`src/engine/solver.js`): a Layer-by-Layer (beginner method) solver that
  must solve **10,000 random scrambles to completion** (`npm run test:solve`).

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
src/App.jsx            # scramble → solve → learn loop, playback, share URL
scripts/               # verification + codegen
```

## Roadmap (from the PRD)

- P0 (this MVP): scramble/turn input, verified engine, LBL solver, 3D playback,
  stage explanations, shareable URL.
- P1: color-picker paint input, follow-along mode, algorithm drill, progress
  tracker, PWA.
- P2: camera scan, accounts, embeddable widget/API, CFOP.
