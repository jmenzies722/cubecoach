# LayerCube — Launch Kit

Free launch to build audience. No paywall. Goal for week one: ~100 real users and
3 people who share it unprompted. That signal decides whether the classroom tier is
ever worth building.

Positioning line (the wedge):
> **Every other cube app gives you the answer. LayerCube gives you the reason.**

Secondary tagline (in the app): *"Stop looking up the moves. Learn the cube."*

---

## 0. Name + domain (decided)

Renamed from CubeCoach → **LayerCube**. Reason: "CubeCoach" collides with Rubik's
official **"Coach Cube"** (coach.rubiks.com, Spin Master) — same audience, two words
flipped, a brand you'd have to abandon. "LayerCube" keeps the layer-method concept,
is cube-specific (dodges the generic dev-tool "Layer"), and is ownable.

Available (verified via GoDaddy):
- **layercube.com** — https://www.godaddy.com/domainsearch/find?domainToCheck=layercube.com
- **layercube.app** — https://www.godaddy.com/domainsearch/find?domainToCheck=layercube.app
- backup: layermethod.com

Buy one (**your** action — I don't purchase). Then point it at the Vercel project and
optionally rename the Vercel project `cubecoach` → `layercube` so the URL matches.

---

## 1. Show HN  (lead channel — technical story is the hook)

**Post Monday ~9am ET. Title:**

> Show HN: A Rubik's Cube coach that teaches the *why* – with a fuzz-tested solver

**Body:**

I got stuck on the last layer of a Rubik's Cube, followed a tutorial, "solved" it
once, and forgot everything a week later. Every solver I found just dumps a move list
on you. So I built the thing I wanted: a coach that walks you through your own cube one
stage at a time and explains what you're building and why, before each move.

The part HN might care about: I didn't trust myself to hand-write a cube engine, so
it's verified.

- The 18 face turns are generated from the cubie model of `cubejs` and fuzz-tested to
  match it over 5,000 random sequences.
- The facelet↔3D-cubelet mapping is proven consistent with the engine (rotate each
  sticker by a move's physical rotation, assert it lands on the engine's destination
  facelet) — no eyeballing the render.
- The Layer-by-Layer solver's last-layer insertions are BFS-discovered rather than
  memorized, and it has to solve 10,000 random scrambles to completion in CI.

Stack: React + Vite + Three.js (react-three-fiber) + Tailwind. It's a PWA, works on
mobile, no sign-up. Three modes: Coach (solve + explain your cube), Learn (the method
map), Drill (run any algorithm forward/reverse).

Live: https://cubecoach-536psj30l-jmenzies722s-projects.vercel.app  (→ swap for layercube.com once DNS is live)
Would love feedback on the pedagogy — does "explain the stage before the moves"
actually make it stick for you?

**Reply-ready answers to expect:**
- *"Kociemba/two-phase is a solved problem."* → Yep — the engine isn't the novelty, the
  verification harness and the stage-by-stage teaching layer are. I used the beginner
  LBL method on purpose because it's learnable by a human, not optimal.
- *"Why not optimal solutions?"* → Optimal solves are 20 moves of noise to a beginner.
  The point is a method you can reproduce from memory afterward.

---

## 2. Reddit — r/learnprogramming (build-story angle)

**Title:** I got stuck on a Rubik's Cube and spent way too long building a 3D coach that verifies its own solver

**Body:** short version of the HN body, dev-flavored: the BFS insertion discovery, the
"verify geometry against the engine instead of trusting the render" trick, the
react-three-fiber animated turns. Link at the end, not the top. Ask what they'd add.

Also post to **r/webdev** (Three.js/PWA angle) and, LAST and only after some social
proof, **r/Cubers** — that crowd is speedcubers and will judge it as a beginner tool
(which it is). Lead there with "built this for the people who quit at the last layer,"
not "check out my app."

---

## 3. YouTube comment seeding (highest-intent, zero cost)

Find the top ~5 beginner LBL tutorials (J Perm's beginner tutorial, etc.). Read the
comments for people stuck at the last layer. Post genuine, non-spammy replies — 2-3 per
video, spaced out, only where it's actually relevant:

- *"Got stuck in exactly this spot for weeks. Ended up building a free 3D thing that
  explains what each stage is doing before the moves — [link]. The last-layer part is
  where it finally clicked for me."*
- *"If the last-layer algs feel like memorizing noise, a stage-by-stage walkthrough
  helped me way more than repeating the sequence. Made a free one here if it helps:
  [link]"*

Do NOT paste the same comment everywhere. Do NOT comment on every video at once.

---

## 4. TikTok / Shorts — the shareable demo moment

The "holy shit" moment is **the pause before the first move**. Don't lead with the
solved cube. Lead with the app stopping to explain.

**Video A (demo, ~20s, no face/voice needed):**
1. Scrambled cube on screen (Coach route, just after Scramble).
2. On-screen caption: "Every cube app dumps 80 moves on you."
3. Cut to the coaching rail appearing: "Stage 1: White Cross — we're building a plus
   sign on the bottom. Here's *why* we start here."
4. Caption: "This one explains first." Then the first move animates.
5. End card: LayerCube — the cube, explained. [URL]

**Video B (dev angle, ~30s):** "I got stuck on a Rubik's cube and built the tool I
wish existed — here's the one design decision that made it different" → the pause.

Post A first. If A gets signal in 48h, make two more like it. If B wins, pivot to dev
content. Tags: #RubiksCube #Cubing #LearnOnTikTok #buildinpublic

> Recording note: capture this in a **focused** browser window (QuickTime screen record,
> ⌘⇧5). The automation harness runs the tab hidden, which throttles the 3D animation —
> a screen capture from a normal focused window records the smooth 60fps solve.

---

## 5. One-week sequence (solo)

1. **Day 1** — Buy layercube.com, point DNS at Vercel, rename the Vercel project. Confirm
   the app loads on the custom domain.
2. **Day 2** — Screen-record Video A (shot list above). This clip is most of your
   marketing for the month.
3. **Day 3** — Show HN, Monday ~9am ET. Sit in the thread and answer for the first 3h.
4. **Day 4–5** — YouTube comment seeding + the r/learnprogramming post.
5. **Day 6–7** — Drop TikTok Video A; post Video B a day later; double down on the winner.

Metric that decides continue/kill: does anyone share it *without being asked*, and do
you get one inbound (educator / creator / press) in 30 days? If yes → the classroom
tier is worth scoping. If no → it stays a portfolio piece, and that's a real win too.

---

## What only you can do (I can't / won't)

- **Buy the domain** and set DNS (financial + account action).
- **Post** to HN / Reddit / YouTube / TikTok (posting on your behalf + accepting each
  platform's terms is yours).
- **Rename the Vercel project** if you want the bare URL to read `layercube`.

Everything above (copy, rename, README, deploy) is done and in the repo.
