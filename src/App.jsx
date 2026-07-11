import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Cube3D from './ui/Cube3D.jsx';
import { Cube, SOLVED, randomScramble, invertSequence } from './engine/cube.js';
import { solve } from './engine/solver.js';
import { validateCube } from './engine/validate.js';
import { parseAlg } from './engine/algParse.js';
import { COLORS } from './engine/geometry.js';

// ---------------------------------------------------------------------------
// Coaching copy — short spoken lines, one per real solver stage (by key).
// The long teaching text still lives in the solver's stage.explanation.
// ---------------------------------------------------------------------------
const COACH = {
  cross: "First the white cross — it's the anchor everything else builds on.",
  firstLayer: 'Corners next. Bring each white corner over its home and tuck it in.',
  middleLayer: 'Middle layer now — send each edge into its slot.',
  llCross: 'Bottom two layers done. Now the yellow top — a cross first.',
  llFace: 'Make the whole top face yellow. Position comes after.',
  llCorners: 'Get the last corners home — the twist comes after.',
  llEdges: "Last edges into place — and that's a solve.",
};

// Canonical beginner-method triggers, one per stage, for the Learn preview loop.
// These are the standard teaching algorithms — reference demos, not a per-cube solve.
const LEARN_ALG = {
  cross: "F R U R' U' F'",
  firstLayer: "R U R' U' R U R' U'",
  middleLayer: "U R U' R' U' F' U F",
  llCross: "F R U R' U' F'",
  llFace: "R U R' U R U2 R'",
  llCorners: "U R U' L' U R' U' L",
  llEdges: "R U R' U' R' F R2 U' R' U' R U R' F'",
};

const DRILL_CHIPS = [
  { label: 'Sexy', alg: "R U R' U'" },
  { label: 'Sune', alg: "R U R' U R U2 R'" },
  { label: 'T-perm', alg: "R U R' U' R' F R2 U' R' U' R U R' F'" },
  { label: 'Sledgehammer', alg: "R' F R F'" },
];

const WATCH_MS = 300;

// Plain-English translation of a move token, so a beginner who doesn't read cube
// notation knows exactly which face to turn and which way. Directions are given as
// you look straight at that face (the standard convention).
const FACE_NAME = { U: 'Top', D: 'Bottom', F: 'Front', B: 'Back', L: 'Left', R: 'Right' };
function describeMove(token) {
  if (!token) return null;
  const name = FACE_NAME[token[0]];
  if (!name) return null;
  const mod = token.slice(1);
  if (mod === '2') return { name, arrow: '180°', dir: 'half turn (twice around)' };
  if (mod === "'") return { name, arrow: '↺', dir: 'counter-clockwise' };
  return { name, arrow: '↻', dir: 'clockwise' };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const stateAfter = (start, moves, k) => Cube.fromString(start).moves(moves.slice(0, k)).toString();

// Per-stage [start, len) offsets into the flat move list.
function stageBounds(stages) {
  const out = [];
  let acc = 0;
  for (const s of stages) { out.push({ start: acc, len: s.moves.length }); acc += s.moves.length; }
  return out;
}

// Animate a sequence one move at a time; bail if alive() turns false (route change).
async function playSeq(ref, moves, ms, alive) {
  for (const m of moves) {
    if (!alive() || !ref.current) return false;
    // eslint-disable-next-line no-await-in-loop
    await ref.current.apply(m, ms);
  }
  return alive();
}

function useMedia(query) {
  const [match, setMatch] = useState(() => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false));
  useEffect(() => {
    const mq = window.matchMedia(query);
    const handler = (e) => setMatch(e.matches);
    setMatch(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [query]);
  return match;
}

const prefersReduced = () => typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const ROUTES = { '#/coach': 'coach', '#/learn': 'learn', '#/drill': 'drill' };
const routeFromHash = () => ROUTES[window.location.hash] || 'landing';

// A shared cube in the URL (?c=) should auto-open its solve ONCE — on a genuine
// deep link into the page. After that, re-entering Coach via the nav must show the
// input menu (Scramble / Paint / Drill), not silently resume the old cube.
let deepLinkConsumed = false;

// ===========================================================================
// App
// ===========================================================================
export default function App() {
  const [route, setRoute] = useState(routeFromHash);
  const [solvedCount, setSolvedCount] = useState(() => {
    try { return Number(localStorage.getItem('cc_solved') || 0); } catch { return 0; }
  });

  useEffect(() => {
    const onHash = () => setRoute(routeFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Every route change starts at the top — no carried-over scroll ("skip").
  useEffect(() => { if (typeof window !== 'undefined') window.scrollTo({ top: 0 }); }, [route]);

  const go = useCallback((r) => {
    window.location.hash = r === 'landing' ? '#/' : `#/${r}`;
    setRoute(r);
  }, []);

  const bumpSolved = useCallback(() => {
    setSolvedCount((n) => { const v = n + 1; try { localStorage.setItem('cc_solved', String(v)); } catch { /* noop */ } return v; });
  }, []);

  return (
    <div className="min-h-screen bg-ink text-[#e7e7ee]">
      <Header route={route} go={go} solvedCount={solvedCount} />
      {route === 'landing' && <Landing go={go} />}
      {route === 'coach' && <Coach go={go} onSolved={bumpSolved} />}
      {route === 'learn' && <Learn />}
      {route === 'drill' && <Drill />}
    </div>
  );
}

// ===========================================================================
// Chrome
// ===========================================================================
function CubeLogo() {
  const faceBg = 'linear-gradient(#08080c 0 1.4px,transparent 1.4px),linear-gradient(90deg,#08080c 0 1.4px,transparent 1.4px)';
  const base = { position: 'absolute', width: 22, height: 22, borderRadius: 4, backgroundImage: faceBg, backgroundSize: '7.33px 7.33px', border: '1.4px solid #08080c' };
  // The isometric rotation throws the cube's projected mass up-and-right, so we
  // reserve a wider box than the 22px face and nudge the 3D group down-left to keep
  // it centred — otherwise the top-right vertex bleeds onto the wordmark.
  return (
    <span aria-hidden="true" style={{ position: 'relative', width: 34, height: 30, marginRight: 12, perspective: 220, filter: 'drop-shadow(0 5px 10px rgba(0,0,0,.5))', flex: '0 0 auto' }}>
      <span style={{ position: 'absolute', left: 4, top: 6, width: 22, height: 22, transformStyle: 'preserve-3d', transform: 'rotateX(-24deg) rotateY(-32deg)' }}>
        <span style={{ ...base, backgroundColor: '#12B76A', transform: 'translateZ(11px)' }} />
        <span style={{ ...base, backgroundColor: '#E4463B', transform: 'rotateY(90deg) translateZ(11px)' }} />
        <span style={{ ...base, backgroundColor: '#FFD11A', transform: 'rotateX(90deg) translateZ(11px)' }} />
      </span>
    </span>
  );
}

function Header({ route, go, solvedCount }) {
  const nav = [
    { key: 'coach', label: 'Coach' },
    { key: 'learn', label: 'Learn' },
    { key: 'drill', label: 'Drill' },
  ];
  return (
    <header className="sticky top-0 z-[60] flex items-center justify-between h-16 px-4 sm:px-8 bg-ink/70 backdrop-blur-xl border-b border-edge">
      <button onClick={() => go('landing')} className="inline-flex items-center bg-transparent border-0 cursor-pointer p-0">
        <CubeLogo />
        <span className="font-display font-semibold text-lg tracking-tight text-[#e7e7ee]">Cubist</span>
      </button>
      <nav className="hidden sm:flex items-center gap-1">
        {nav.map((n) => (
          <button
            key={n.key}
            onClick={() => go(n.key)}
            className={`text-sm font-medium px-3.5 py-2 rounded-lg transition hover:bg-panel ${route === n.key ? 'text-[#e7e7ee]' : 'text-white/55 hover:text-[#e7e7ee]'}`}
          >
            {n.label}
          </button>
        ))}
      </nav>
      <div className="flex items-center gap-2">
        {solvedCount > 0 && (
          <span className="hidden sm:inline text-[11px] px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-400/30 text-emerald-300 font-mono">✓ {solvedCount} solved</span>
        )}
        <button
          onClick={() => go('coach')}
          className="font-display font-semibold text-sm text-white rounded-[10px] py-2.5 px-[18px] cursor-pointer transition hover:-translate-y-px"
          style={{ background: 'linear-gradient(135deg,#6366f1,#4f46e5)', boxShadow: '0 6px 20px rgba(99,102,241,.28)' }}
        >
          Coach me
        </button>
      </div>
    </header>
  );
}

// small isometric CSS cube glyph used as a decoration on feature rows
function CubeGlyph({ size = 44, accent = '#34d399' }) {
  const faceBg = 'linear-gradient(#08080c 0 1.6px,transparent 1.6px),linear-gradient(90deg,#08080c 0 1.6px,transparent 1.6px)';
  const s = size;
  const z = s / 2;
  const base = { position: 'absolute', width: s, height: s, borderRadius: 5, backgroundImage: faceBg, backgroundSize: `${s / 3}px ${s / 3}px`, border: '1.6px solid #08080c' };
  return (
    <span aria-hidden="true" style={{ position: 'relative', width: s, height: s, perspective: s * 6, filter: 'drop-shadow(0 8px 16px rgba(0,0,0,.5))' }}>
      <span style={{ position: 'absolute', inset: 0, transformStyle: 'preserve-3d', transform: 'rotateX(-24deg) rotateY(-30deg)' }}>
        <span style={{ ...base, backgroundColor: '#12B76A', transform: `translateZ(${z}px)` }} />
        <span style={{ ...base, backgroundColor: accent === '#34d399' ? '#E4463B' : '#6366f1', transform: `rotateY(90deg) translateZ(${z}px)` }} />
        <span style={{ ...base, backgroundColor: '#FFD11A', transform: `rotateX(90deg) translateZ(${z}px)` }} />
      </span>
    </span>
  );
}

// ===========================================================================
// Landing
// ===========================================================================
function HeroCube() {
  const ref = useRef();
  useEffect(() => {
    let live = true;
    const alive = () => live;
    const reduced = prefersReduced();
    const scramble = randomScramble(18);
    const solveSeq = invertSequence(scramble);
    if (reduced) { ref.current?.setStateNow(SOLVED); return () => { live = false; }; }
    const loop = async () => {
      while (live && ref.current) {
        ref.current.setStateNow(SOLVED);
        // eslint-disable-next-line no-await-in-loop
        await playSeq(ref, scramble, 150, alive); // mix it up fast
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 500));
        // eslint-disable-next-line no-await-in-loop
        await playSeq(ref, solveSeq, 300, alive); // ...then solve it
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 2200));
      }
    };
    const t = setTimeout(loop, 400);
    return () => { live = false; clearTimeout(t); };
  }, []);
  return <Cube3D ref={ref} initialState={SOLVED} />;
}

function Landing({ go }) {
  const features = [
    { accent: '#818cf8', tag: 'interactive 3D', title: "Turn it, don't read it.", body: 'A real cube you can orbit and scrub — not a static diagram. Every move you’ll make is one you can watch first.' },
    { accent: '#34d399', tag: 'plain-English why', title: 'Understand each stage.', body: 'The coach names what you’re doing and why it matters, so the pattern sticks — long after you close the tab.' },
    { accent: '#818cf8', tag: 'follow-along', title: 'Move with your cube.', body: 'Guide-me mode paces one move at a time, waiting for you. Your hands and the screen stay in sync.' },
  ];
  return (
    <main>
      <section className="relative overflow-hidden px-4 sm:px-8 pt-10 sm:pt-20 pb-12 sm:pb-24">
        <div className="pointer-events-none absolute -top-[10%] -right-[5%] w-[60%] h-[120%]" style={{ background: 'radial-gradient(circle at 60% 40%,rgba(99,102,241,.12),transparent 60%)' }} />
        <div className="pointer-events-none absolute -bottom-[20%] -left-[10%] w-[55%] h-full" style={{ background: 'radial-gradient(circle at 40% 60%,rgba(16,185,129,.09),transparent 60%)' }} />
        <div className="relative max-w-[1200px] mx-auto flex items-center gap-6 sm:gap-14 flex-wrap">
          <div className="flex-1 min-w-[300px] basis-[380px]">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 border border-edge rounded-full text-xs text-white/65 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" style={{ boxShadow: '0 0 8px #34d399' }} />
              A coach, not a solver
            </div>
            <h1 className="font-display font-semibold leading-[1.02] tracking-[-0.03em] mb-5 text-[#f4f4f8]" style={{ fontSize: 'clamp(40px,6vw,64px)' }}>
              Stop looking up<br />the moves.<br />
              <span style={{ background: 'linear-gradient(135deg,#818cf8,#34d399)', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Learn the cube.</span>
            </h1>
            <p className="text-white/60 leading-relaxed mb-8 max-w-[30ch]" style={{ fontSize: 'clamp(16px,2vw,20px)' }}>
              Every other solver hands you a wall of moves and walks away. Cubist coaches you through your own cube — one stage, one why, at a time.
            </p>
            <div className="flex items-center gap-4 flex-wrap">
              <button onClick={() => go('coach')} className="font-display font-semibold text-base text-white rounded-xl px-7 py-[15px] cursor-pointer transition hover:-translate-y-0.5" style={{ background: 'linear-gradient(135deg,#6366f1,#4f46e5)', boxShadow: '0 10px 30px rgba(99,102,241,.32)' }}>
                Coach me &nbsp;→
              </button>
              <span className="text-[13px] text-white/45">No sign-up. Works with the cube in your hand.</span>
            </div>
          </div>
          <div className="flex-1 min-w-[300px] basis-[420px] flex items-center justify-center">
            <div className="relative w-full max-w-[460px] aspect-square">
              <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at 50% 42%,rgba(27,27,38,.9),rgba(10,10,15,0) 62%)', borderRadius: '50%' }} />
              <div className="absolute inset-0"><HeroCube /></div>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-[1160px] mx-auto px-4 sm:px-8 pb-24">
        <p className="font-display text-[13px] tracking-[0.14em] uppercase text-white/40 mb-2">Coach vs. vending machine</p>
        <h2 className="font-display font-semibold tracking-[-0.02em] mb-11 text-[#f4f4f8] max-w-[20ch]" style={{ fontSize: 'clamp(26px,3.5vw,40px)' }}>A wall of moves teaches you nothing.</h2>
        <div className="flex flex-col gap-px rounded-[20px] overflow-hidden border border-edge" style={{ background: '#23232f' }}>
          {features.map((f) => (
            <div key={f.title} className="flex items-center gap-6 sm:gap-12 p-6 sm:p-10 flex-wrap" style={{ background: '#0c0c12' }}>
              <div className="flex-none w-[120px] h-[120px] grid place-items-center rounded-3xl" style={{ background: 'radial-gradient(circle at 50% 45%,rgba(27,27,38,.8),transparent 65%)' }}>
                <CubeGlyph size={56} accent={f.accent} />
              </div>
              <div className="flex-1 min-w-[220px] basis-[260px]">
                <span className="inline-block font-mono text-xs text-emerald-300 border border-emerald-400/30 rounded-md px-2.5 py-1 mb-3.5">{f.tag}</span>
                <h3 className="font-display font-semibold text-[22px] tracking-[-0.01em] mb-2.5 text-[#f4f4f8]">{f.title}</h3>
                <p className="text-base leading-relaxed text-white/60 max-w-[46ch]">{f.body}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="text-center mt-16">
          <button onClick={() => go('coach')} className="font-display font-semibold text-[17px] text-white rounded-2xl px-10 py-4 cursor-pointer transition hover:-translate-y-0.5" style={{ background: 'linear-gradient(135deg,#6366f1,#10b981)', boxShadow: '0 12px 36px rgba(99,102,241,.3)' }}>
            Coach me through my cube
          </button>
        </div>
      </section>
    </main>
  );
}

// ===========================================================================
// Coach  — the product
// ===========================================================================
function Coach({ go, onSolved }) {
  const cubeRef = useRef();
  const narrow = useMedia('(max-width: 920px)');

  const [startState, setStartState] = useState(SOLVED);
  // When a cube is entered by painting, its centres may not sit in the canonical
  // orientation, so we solve a re-oriented copy but render the player's own colours
  // via this map (position letter -> hex). null = the canonical scheme.
  const [colorMap, setColorMap] = useState(null);
  const [solution, setSolution] = useState(null);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [mode, setMode] = useState('watch'); // 'watch' | 'guide'
  const [paintOpen, setPaintOpen] = useState(false);
  const [error, setError] = useState(null);

  // Paint draft lives here (not inside PaintPanel) so the 3D cube on the stage and
  // the flat map in the rail both edit the same cube — click either one to paint.
  const [draft, setDraft] = useState(SOLVED);
  const [pick, setPick] = useState('D');
  const pickRef = useRef('D');
  useEffect(() => { pickRef.current = pick; }, [pick]);

  const playingRef = useRef(false);
  const stepRef = useRef(0);
  const countedRef = useRef(false);
  useEffect(() => { stepRef.current = step; }, [step]);

  // Paint a single facelet the current colour — including centres, which declare
  // each face's colour so the cube can be entered in any orientation. Shared by the
  // 3D stickers and the flat map.
  const paintCell = useCallback((i) => {
    setDraft((d) => { const a = d.split(''); a[i] = pickRef.current; return a.join(''); });
  }, []);

  // While painting, mirror the draft onto the 3D cube live.
  useEffect(() => { if (paintOpen) cubeRef.current?.setStateNow(draft); }, [draft, paintOpen]);

  const moves = solution?.moves || [];
  const total = moves.length;
  const stages = solution?.stages || [];
  const bounds = useMemo(() => stageBounds(stages), [solution]);

  const solved = solution && total > 0 && step >= total;
  const curIdx = useMemo(() => {
    if (!bounds.length) return 0;
    const s = Math.min(step, total > 0 ? total - 1 : 0);
    for (let i = 0; i < bounds.length; i++) { if (s < bounds[i].start + bounds[i].len || i === bounds.length - 1) return i; }
    return 0;
  }, [step, bounds, total]);
  const stage = stages[curIdx] || null;
  const local = stage ? step - bounds[curIdx].start : 0;
  const stageDone = stage ? local >= bounds[curIdx].len : false;

  // count each completed solve once
  useEffect(() => {
    if (solved && !countedRef.current) { countedRef.current = true; onSolved(); }
  }, [solved, onSolved]);

  // deep-link: ?c=<54-facelet> auto-loads and solves straight into coaching —
  // but only on the first entry of the session, so nav re-entry shows the menu.
  useEffect(() => {
    if (deepLinkConsumed) return;
    deepLinkConsumed = true;
    const c = new URLSearchParams(window.location.search).get('c');
    if (c && validateCube(c).valid) begin(c, { push: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Back to the Scramble / Paint / Drill menu, clearing the shared-cube URL.
  const resetToInput = useCallback(() => {
    setPlaying(false); playingRef.current = false;
    setSolution(null); setStep(0); stepRef.current = 0;
    setError(null); countedRef.current = false; setPaintOpen(false);
    setColorMap(null); setStartState(SOLVED); cubeRef.current?.setStateNow(SOLVED);
    const url = new URL(window.location); url.searchParams.delete('c');
    window.history.replaceState({}, '', url);
  }, []);

  const begin = useCallback((state, { push = true, cmap = null } = {}) => {
    setPlaying(false); playingRef.current = false;
    setStep(0); stepRef.current = 0; setError(null); countedRef.current = false;
    setColorMap(cmap);
    setStartState(state);
    cubeRef.current?.setStateNow(state);
    if (push) {
      const url = new URL(window.location);
      if (state === SOLVED) url.searchParams.delete('c'); else url.searchParams.set('c', state);
      window.history.replaceState({}, '', url);
    }
    try { setSolution(solve(state)); }
    catch (e) { setSolution(null); setError(e.message || 'Could not solve this cube.'); }
  }, []);

  const startScramble = useCallback(() => {
    setPaintOpen(false);
    begin(new Cube().moves(randomScramble(25)).toString());
  }, [begin]);

  const gotoStep = useCallback((k) => {
    const clamped = Math.max(0, Math.min(total, k));
    setPlaying(false); playingRef.current = false;
    setStep(clamped); stepRef.current = clamped;
    cubeRef.current?.setStateNow(stateAfter(startState, moves, clamped));
  }, [total, moves, startState]);

  const play = useCallback(async () => {
    if (!solution || stepRef.current >= total) return;
    setPlaying(true); playingRef.current = true;
    for (let k = stepRef.current; k < total; k++) {
      if (!playingRef.current) break;
      // brief pause at each stage boundary so the spine node reads
      if (bounds.some((b) => b.start === k) && k !== 0) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 260));
        if (!playingRef.current) break;
      }
      // eslint-disable-next-line no-await-in-loop
      await cubeRef.current.apply(moves[k], WATCH_MS);
      stepRef.current = k + 1; setStep(k + 1);
    }
    setPlaying(false); playingRef.current = false;
  }, [solution, moves, total, bounds]);

  const pause = useCallback(() => { setPlaying(false); playingRef.current = false; }, []);
  const playPause = useCallback(() => { if (solved) return; if (playingRef.current) pause(); else play(); }, [solved, play, pause]);

  const nextMove = useCallback(async () => {
    if (playingRef.current || stepRef.current >= total) return;
    setPlaying(true); playingRef.current = true;
    const k = stepRef.current;
    await cubeRef.current.apply(moves[k], WATCH_MS);
    stepRef.current = k + 1; setStep(k + 1);
    setPlaying(false); playingRef.current = false;
  }, [moves, total]);

  const inCoaching = !!solution;
  const solveDir = narrow ? 'column' : 'row';

  return (
    <main className="flex min-h-[calc(100vh-64px)]" style={{ flexDirection: solveDir }}>
      {/* STAGE */}
      <section
        aria-label="3D cube stage"
        className="relative overflow-hidden"
        style={{ flex: narrow ? '0 0 auto' : '1 1 62%', minHeight: narrow ? '46vh' : 'auto', background: 'radial-gradient(circle at 50% 40%,#16161f,#0a0a0f 70%)' }}
      >
        <div className="absolute top-5 left-6 z-[3] flex items-center gap-2 font-mono text-xs text-white/40">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> {paintOpen ? 'tap a sticker to paint · drag to orbit' : 'drag to orbit'}
        </div>
        <div className="absolute inset-0 z-[2]"><Cube3D ref={cubeRef} initialState={startState} colorMap={paintOpen ? null : colorMap} paintMode={paintOpen} onPaintSticker={paintCell} /></div>
        {solved && (
          <div className="absolute inset-0 z-[4] pointer-events-none cc-sweep" style={{ background: 'linear-gradient(120deg,transparent,rgba(99,102,241,.35),rgba(16,185,129,.35),transparent)' }} />
        )}
      </section>

      {/* COACHING RAIL */}
      <aside
        aria-label="Coaching rail"
        className="flex bg-panel/70 backdrop-blur-md"
        style={{ flex: narrow ? '1 1 auto' : '0 0 38%', flexDirection: narrow ? 'column' : 'row', borderTop: narrow ? '1px solid #23232f' : 'none', borderLeft: narrow ? 'none' : '1px solid #23232f' }}
      >
        {inCoaching && !narrow && <Spine stages={stages} bounds={bounds} step={step} total={total} curIdx={curIdx} solved={solved} onJump={(i) => gotoStep(bounds[i].start)} />}

        <div className="flex-1 min-w-0 flex flex-col p-6 sm:p-8">
          {!inCoaching ? (
            paintOpen ? (
              <PaintPanel
                draft={draft}
                pick={pick}
                setPick={setPick}
                onPaintCell={paintCell}
                onReset={() => setDraft(SOLVED)}
                onCancel={() => { setPaintOpen(false); cubeRef.current?.setStateNow(startState); }}
                onUse={(d) => {
                  const res = paintToCanonical(d);
                  if (res.error) return res.error;
                  const v = validateCube(res.pos);
                  if (!v.valid) return v.reason;
                  setPaintOpen(false);
                  begin(res.pos, { cmap: res.colorMap });
                  return null;
                }}
              />
            ) : (
              <InputPhase
                error={error}
                onScramble={startScramble}
                onPaint={() => { setDraft(SOLVED); setPick('D'); setStartState(SOLVED); setColorMap(null); setPaintOpen(true); }}
                onDrill={() => go('drill')}
              />
            )
          ) : (
            <CoachingPhase
              stage={stage} curIdx={curIdx} stageDone={stageDone} local={local}
              moveCount={bounds[curIdx]?.len || 0} nextToken={step < total ? moves[step] : null}
              solved={solved} mode={mode} setMode={setMode}
              playing={playing} playPause={playPause}
              onPrev={() => gotoStep(step - 1)} onNext={nextMove} onRestart={() => gotoStep(0)}
              onNewCube={resetToInput} hasProgress={step > 0}
            />
          )}
        </div>
      </aside>

      {solved && (
        <div className="fixed left-1/2 bottom-9 -translate-x-1/2 z-[80] flex items-center gap-4 rounded-2xl px-5 py-4 cc-rise bg-panel/90 backdrop-blur-lg border border-edge" style={{ boxShadow: '0 20px 50px rgba(0,0,0,.5)' }}>
          <span className="w-9 h-9 rounded-[10px] grid place-items-center text-white text-xl" style={{ background: 'linear-gradient(135deg,#6366f1,#10b981)' }}>✓</span>
          <span>
            <span className="block font-display font-semibold text-[17px] text-[#f4f4f8]">Solved. You did that.</span>
            <span className="block text-[13px] text-white/55">Every stage, in your own hands.</span>
          </span>
          <button onClick={startScramble} className="ml-2 rounded-[10px] px-4 py-2.5 font-display font-semibold text-sm text-[#e7e7ee] bg-panel border border-edge hover:border-emerald-400/70 transition">Solve another</button>
        </div>
      )}
    </main>
  );
}

function Spine({ stages, bounds, step, total, curIdx, solved, onJump }) {
  const completed = bounds.filter((b, i) => solved || step >= b.start + b.len).length;
  const fillFrac = Math.max(0, Math.min(1, completed / stages.length));
  return (
    <div className="relative flex-none w-[184px] px-[18px] py-6 flex-col justify-center border-r border-edge hidden md:flex">
      <div className="relative flex flex-col gap-1.5">
        <div className="absolute left-[15px] top-3.5 bottom-3.5 w-0.5 bg-edge z-0" />
        <div className="absolute left-[15px] top-3.5 w-0.5 z-[1] transition-[height] duration-500" style={{ background: 'linear-gradient(#34d399,#6366f1)', height: `calc((100% - 28px) * ${fillFrac})` }} />
        {stages.map((st, i) => {
          const isActive = i === curIdx && !solved;
          const done = solved || step >= bounds[i].start + bounds[i].len;
          return (
            <button key={st.key} onClick={() => onJump(i)} title={st.title} className="flex items-center gap-3 rounded-[9px] py-1.5 pr-2 cursor-pointer text-left transition-colors" style={{ background: isActive ? 'rgba(99,102,241,.08)' : 'transparent' }}>
              <span
                className="flex-none w-4 h-4 rounded-full ml-2 z-[2] transition-all duration-300"
                style={{
                  background: done ? '#34d399' : isActive ? '#6366f1' : '#14141c',
                  border: `2px solid ${done ? '#34d399' : isActive ? '#6366f1' : '#2b2b3a'}`,
                  boxShadow: isActive ? '0 0 0 4px rgba(99,102,241,.15)' : done ? '0 0 10px rgba(52,211,153,.5)' : 'none',
                }}
              />
              <span className="font-display text-[12.5px] truncate" style={{ fontWeight: isActive ? 600 : 500, color: isActive ? '#e7e7ee' : done ? 'rgba(52,211,153,.85)' : 'rgba(231,231,238,.42)' }}>{st.title}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function InputPhase({ error, onScramble, onPaint, onDrill }) {
  const opt = 'flex items-center gap-4 text-left bg-panel2 border border-edge rounded-2xl px-5 py-[18px] cursor-pointer transition hover:-translate-y-px';
  return (
    <div className="flex flex-col h-full">
      <p className="font-display text-xs tracking-[0.14em] uppercase text-white/40 mb-3">The Coach</p>
      <h2 className="font-display font-semibold text-[26px] leading-tight tracking-[-0.01em] mb-2.5 text-[#f4f4f8]">Let’s get started.</h2>
      <p className="text-base leading-relaxed text-white/60 mb-7">Scramble one, or paint the cube in your hand.</p>
      <div className="flex flex-col gap-3">
        <button onClick={onScramble} className={`${opt} hover:border-indigo-500`}>
          <span className="flex-none w-10 h-10 rounded-[10px] grid place-items-center font-mono font-semibold text-white" style={{ background: 'linear-gradient(135deg,#6366f1,#4f46e5)' }}>R'</span>
          <span className="flex-1"><span className="block font-display font-semibold text-base text-[#f4f4f8]">Scramble</span><span className="block text-[13px] text-white/50">Generate a mixed cube to coach.</span></span>
        </button>
        <button onClick={onPaint} className={`${opt} hover:border-emerald-400`}>
          <span className="flex-none w-10 h-10 rounded-[10px] grid place-items-center bg-panel border border-edge">
            <span className="grid grid-cols-3 gap-0.5">
              {['#E4463B', '#FFD11A', '#12B76A', '#F7F7F7', '#2E6BE6', '#F08417', '#FFD11A', '#12B76A', '#E4463B'].map((c, i) => <span key={i} className="w-[5px] h-[5px]" style={{ background: c }} />)}
            </span>
          </span>
          <span className="flex-1"><span className="block font-display font-semibold text-base text-[#f4f4f8]">Paint my cube</span><span className="block text-[13px] text-white/50">Enter the cube in your hand, face by face.</span></span>
        </button>
        <button onClick={onDrill} className={`${opt} hover:border-indigo-500`}>
          <span className="flex-none w-10 h-10 rounded-[10px] grid place-items-center bg-panel border border-edge font-mono font-semibold text-indigo-400">alg</span>
          <span className="flex-1"><span className="block font-display font-semibold text-base text-[#f4f4f8]">Drill</span><span className="block text-[13px] text-white/50">Run any algorithm forward or reverse.</span></span>
        </button>
      </div>
      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
    </div>
  );
}

function CoachingPhase({ stage, curIdx, stageDone, local, moveCount, nextToken, solved, mode, setMode, playing, playPause, onPrev, onNext, onRestart, onNewCube, hasProgress }) {
  const coachLine = solved ? 'Solved. You did that.' : stageDone ? 'Stage clear — moving on.' : COACH[stage?.key] || stage?.explanation || '';
  const bigMove = solved ? '✓' : stageDone ? '✓' : nextToken || '';
  const plain = describeMove(nextToken);
  const seg = 'flex-1 border-0 rounded-[9px] py-2.5 font-display font-semibold text-sm cursor-pointer transition';
  const iconBtn = 'flex-none w-[46px] h-[46px] rounded-xl bg-panel border border-edge text-white/70 cursor-pointer grid place-items-center transition hover:border-indigo-500 hover:text-[#e7e7ee]';
  return (
    <div className="flex flex-col h-full">
      {/* back to the input menu (paint / scramble) */}
      <button onClick={onNewCube} className="self-start mb-4 inline-flex items-center gap-1.5 text-[13px] text-white/50 hover:text-[#e7e7ee] transition">← New cube</button>

      {/* mode segmented */}
      <div className="flex p-[3px] bg-panel border border-edge rounded-[11px] mb-6">
        <button onClick={() => setMode('watch')} className={seg} style={mode === 'watch' ? { background: '#6366f1', color: '#fff', boxShadow: '0 2px 10px rgba(99,102,241,.35)' } : { background: 'transparent', color: 'rgba(231,231,238,.55)' }}>Watch</button>
        <button onClick={() => setMode('guide')} className={seg} style={mode === 'guide' ? { background: '#34d399', color: '#04140d', boxShadow: '0 2px 10px rgba(52,211,153,.35)' } : { background: 'transparent', color: 'rgba(231,231,238,.55)' }}>Guide me</button>
      </div>

      {/* stage card */}
      <div className="flex items-baseline justify-between gap-3 mb-1.5">
        <span className="font-mono text-xs text-white/40">Stage {curIdx + 1} / 7</span>
        <span className="font-mono text-xs text-indigo-400 bg-indigo-500/10 rounded-md px-2 py-0.5">{moveCount} moves</span>
      </div>
      <h2 className="font-display font-semibold text-2xl tracking-[-0.01em] mb-2 text-[#f4f4f8]">{stage?.title || ''}</h2>
      <p className="text-[15px] leading-relaxed text-white/60 mb-6 min-h-[44px]">{coachLine}</p>

      {/* big move */}
      <div className="bg-panel border border-edge rounded-2xl p-6 mb-4">
        <p className="text-xs tracking-[0.1em] uppercase text-white/40 mb-3">{stageDone ? 'Stage complete' : 'Next move'}</p>
        <div className="flex items-center gap-4 mb-4">
          <span className="font-display font-semibold leading-none tracking-[-0.02em] text-[#f4f4f8] min-h-[56px] text-[56px]">{bigMove}</span>
          {!solved && !stageDone && plain && (
            <span className="flex items-center gap-2.5 text-white/75">
              <span className="text-[34px] leading-none text-indigo-300" aria-hidden="true">{plain.arrow}</span>
              <span className="text-[15px] leading-tight">
                <span className="block font-semibold text-[#f4f4f8]">{plain.name} face</span>
                <span className="block text-white/60">{plain.dir}</span>
              </span>
            </span>
          )}
        </div>
        {!solved && !stageDone && plain && (
          <p className="text-[12px] text-white/35 mb-4">Directions are as you look straight at that face.</p>
        )}
        <div className="flex flex-wrap gap-1.5">
          {(stage?.moves || []).map((m, i) => {
            const st = i < local ? 'done' : i === local ? 'active' : 'todo';
            const style = st === 'active'
              ? { background: 'rgba(99,102,241,.18)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,.5)' }
              : st === 'done'
                ? { background: 'transparent', color: 'rgba(52,211,153,.7)', border: '1px solid transparent' }
                : { background: '#1b1b26', color: 'rgba(231,231,238,.45)', border: '1px solid #23232f' };
            return <span key={i} className="font-mono text-[13px] px-2 py-1.5 rounded-md transition-all" style={style}>{m}</span>;
          })}
        </div>
      </div>

      {mode === 'guide' && !solved && !stageDone && (
        <p className="text-sm text-emerald-300 mb-4 flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" style={{ boxShadow: '0 0 8px #34d399' }} />{plain ? `Turn the ${plain.name.toLowerCase()} face ${plain.dir}, then tap Done.` : 'Do this move on your cube, then tap Done.'}</p>
      )}

      <div className="flex-1" />

      {/* transport */}
      <div className="flex items-center gap-2.5">
        <button onClick={onRestart} title="Restart" aria-label="Restart" className={iconBtn}>↺</button>
        <button onClick={onPrev} title="Previous move" aria-label="Previous move" className={iconBtn}>◀</button>
        {mode === 'watch' ? (
          <button onClick={playPause} disabled={solved} className="flex-1 h-[46px] px-2 rounded-xl border-0 text-white font-display font-semibold text-[15px] whitespace-nowrap cursor-pointer transition hover:-translate-y-px disabled:opacity-40" style={{ background: 'linear-gradient(135deg,#6366f1,#4f46e5)', boxShadow: '0 6px 18px rgba(99,102,241,.3)' }}>
            {playing ? 'Pause' : hasProgress ? 'Resume' : 'Watch it solve'}
          </button>
        ) : (
          <button onClick={onNext} disabled={solved} className="flex-1 h-[46px] px-2 rounded-xl border-0 font-display font-semibold text-[15px] whitespace-nowrap cursor-pointer transition hover:-translate-y-px disabled:opacity-40" style={{ background: 'linear-gradient(135deg,#34d399,#10b981)', color: '#04140d', boxShadow: '0 6px 18px rgba(16,185,129,.3)' }}>
            Done &nbsp;→
          </button>
        )}
        <button onClick={onNext} title="Next move" aria-label="Next move" className={iconBtn}>▶</button>
      </div>
    </div>
  );
}

// ===========================================================================
// Paint  (ported from the shipped app, restyled for the rail)
// ===========================================================================
const NET = { U: [1, 4], L: [4, 1], F: [4, 4], R: [4, 7], B: [4, 10], D: [7, 4] };
const FACE_OFFSET = { U: 0, R: 9, F: 18, D: 27, L: 36, B: 45 };
const CENTER_LOCAL = 4;

const PICK_LABEL = { D: 'White', U: 'Yellow', F: 'Green', B: 'Blue', R: 'Red', L: 'Orange' };

// Facelet index of each face's centre, in canonical U R F D L B order.
const CENTER_IDX = { U: 4, R: 13, F: 22, D: 31, L: 40, B: 49 };

// Turn a painted cube (any orientation) into a canonical solver string. The six
// centres are read as "this face is this colour", which re-labels every sticker to
// its face-position letter — so the solver, which assumes canonical centres, works
// no matter how the cube was held. Also returns a colour map so the solve animation
// renders in the player's own colours, not the canonical scheme.
function paintToCanonical(draft) {
  const positions = ['U', 'R', 'F', 'D', 'L', 'B'];
  const centres = positions.map((p) => draft[CENTER_IDX[p]]);
  if (new Set(centres).size !== 6) {
    return { error: 'Give the 6 centre stickers 6 different colours — the centres tell the app which colour each face is.' };
  }
  const colourToPos = {};
  const colorMap = {};
  positions.forEach((p, i) => { colourToPos[centres[i]] = p; colorMap[p] = COLORS[centres[i]]; });
  const pos = draft.split('').map((ch) => colourToPos[ch] ?? ch).join('');
  return { pos, colorMap };
}

function PaintPanel({ draft, pick, setPick, onPaintCell, onReset, onCancel, onUse }) {
  const [err, setErr] = useState(null);
  const tryUse = () => { const e = onUse(draft); if (e) setErr(e); };

  const cells = [];
  for (const [face, [br, bc]] of Object.entries(NET)) {
    for (let k = 0; k < 9; k++) {
      const gi = FACE_OFFSET[face] + k;
      const r = br + Math.floor(k / 3), c = bc + (k % 3);
      const isCenter = k === CENTER_LOCAL;
      cells.push(<button key={gi} onClick={() => { setErr(null); onPaintCell(gi); }} style={{ gridRow: r, gridColumn: c, background: COLORS[draft[gi]] }} className={`aspect-square rounded-[3px] border border-black/40 hover:brightness-110 ${isCenter ? 'ring-1 ring-white/50' : ''}`} title={isCenter ? 'centre — sets this face’s colour' : ''} />);
    }
  }
  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex items-center justify-between">
        <span className="font-display font-semibold text-[#f4f4f8]">Paint your cube</span>
        <button onClick={onCancel} className="text-xs text-white/50 hover:text-white">✕ cancel</button>
      </div>
      <p className="text-[13px] text-white/55 leading-relaxed">
        Pick a colour, then tap stickers — <span className="text-white/80">on the 3D cube or the map below</span> — to match the cube in your hand, exactly as you’re holding it. Drag the cube to reach the back and bottom.
      </p>
      <p className="text-[12px] text-white/40 leading-relaxed">
        Paint every sticker, <span className="text-white/70">centres included</span> — the 6 centres set which colour each face is, so you can hold your cube any way you like. Just give the centres 6 different colours.
      </p>
      <div className="flex items-center gap-2">
        {['D', 'U', 'F', 'B', 'R', 'L'].map((f) => (
          <button key={f} onClick={() => setPick(f)} style={{ background: COLORS[f] }} className={`w-9 h-9 rounded-lg border-2 transition ${pick === f ? 'border-white scale-110' : 'border-black/40'}`} title={PICK_LABEL[f]} aria-label={PICK_LABEL[f]} />
        ))}
        <span className="ml-1 text-[13px] text-white/55">{PICK_LABEL[pick]}</span>
      </div>
      <div className="grid gap-[3px] mx-auto w-full max-w-[300px]" style={{ gridTemplateColumns: 'repeat(12,1fr)', gridTemplateRows: 'repeat(9,1fr)' }}>{cells}</div>
      {err && <p className="text-sm text-red-400">{err}</p>}
      <div className="flex gap-2 mt-auto">
        <button onClick={() => { onReset(); setErr(null); }} className="flex-1 py-2.5 rounded-xl border border-edge text-sm text-white/70 hover:text-white transition">Reset</button>
        <button onClick={tryUse} className="flex-1 py-2.5 rounded-xl border-0 font-display font-semibold text-sm text-[#04140d]" style={{ background: 'linear-gradient(135deg,#34d399,#10b981)' }}>Use this cube</button>
      </div>
    </div>
  );
}

// ===========================================================================
// Learn  — method map
// ===========================================================================
function Learn() {
  const cubeRef = useRef();
  const stages = useMemo(() => solve(new Cube().moves(randomScramble(25)).toString()).stages, []);
  const [sel, setSel] = useState(0);
  const selRef = useRef(0);
  useEffect(() => { selRef.current = sel; }, [sel]);

  // loop the selected stage's canonical teaching trigger on the preview cube
  useEffect(() => {
    let live = true;
    const alive = () => live && selRef.current === sel;
    const reduced = prefersReduced();
    const parsed = parseAlg(LEARN_ALG[stages[sel].key] || "R U R' U'");
    const seq = parsed.valid ? parsed.moves : [];
    cubeRef.current?.setStateNow(SOLVED);
    if (reduced || !seq.length) return () => { live = false; };
    const loop = async () => {
      while (alive() && cubeRef.current) {
        // eslint-disable-next-line no-await-in-loop
        const ok = await playSeq(cubeRef, seq, 340, alive);
        if (!ok) break;
        // eslint-disable-next-line no-await-in-loop
        await playSeq(cubeRef, invertSequence(seq), 340, alive);
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 700));
      }
    };
    const t = setTimeout(loop, 300);
    return () => { live = false; clearTimeout(t); };
  }, [sel, stages]);

  const cur = stages[sel];
  const progress = `${(sel / (stages.length - 1)) * 100}%`;

  return (
    <main className="max-w-[1160px] mx-auto px-4 sm:px-8 pt-10 sm:pt-16 pb-24">
      <p className="font-display text-[13px] tracking-[0.14em] uppercase text-white/40 mb-2">Method map</p>
      <h1 className="font-display font-semibold tracking-[-0.02em] mb-3.5 text-[#f4f4f8]" style={{ fontSize: 'clamp(30px,4vw,48px)' }}>The beginner method, one climb.</h1>
      <p className="text-[17px] leading-relaxed text-white/60 max-w-[56ch] mb-11">Seven stages, bottom to top. Tap any stage to see the why and watch its moves loop on the cube.</p>
      <div className="flex gap-6 sm:gap-14 items-start flex-wrap">
        <div className="flex-1 min-w-[300px] basis-[420px] relative">
          <div className="absolute left-[19px] top-5 bottom-5 w-0.5 bg-edge" />
          <div className="absolute left-[19px] top-5 w-0.5 transition-[height] duration-500" style={{ background: 'linear-gradient(#34d399,#6366f1)', height: progress }} />
          <div className="flex flex-col gap-3">
            {stages.map((s, i) => {
              const active = i === sel;
              return (
                <button key={s.key} onClick={() => setSel(i)} className="flex items-center gap-4 w-full rounded-2xl px-4 py-3.5 cursor-pointer transition text-left" style={{ background: active ? 'rgba(20,20,28,.9)' : 'transparent', border: `1px solid ${active ? '#6366f1' : 'transparent'}` }}>
                  <span className="flex-none w-[22px] h-[22px] rounded-full grid place-items-center font-mono text-[11px] z-[2] transition" style={{ background: active ? '#6366f1' : '#14141c', border: `2px solid ${active ? '#6366f1' : '#2b2b3a'}`, color: active ? '#fff' : 'rgba(231,231,238,.5)' }}>{i + 1}</span>
                  <span className="flex-1 min-w-0 text-left">
                    <span className="block font-display font-semibold text-[17px] text-[#f4f4f8]">{s.title}</span>
                    <span className="block text-[13.5px] leading-snug mt-0.5" style={{ color: active ? 'rgba(231,231,238,.62)' : 'rgba(231,231,238,.4)' }}>{s.explanation}</span>
                  </span>
                  <span className="font-mono text-xs text-white/40 flex-none">{s.moves.length} moves</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex-1 min-w-[300px] basis-[340px] sticky top-[88px]">
          <div className="bg-panel/70 border border-edge rounded-[20px] overflow-hidden">
            <div className="relative h-[300px]" style={{ background: 'radial-gradient(circle at 50% 42%,#16161f,#0a0a0f 72%)' }}>
              <div className="absolute inset-0"><Cube3D ref={cubeRef} initialState={SOLVED} /></div>
            </div>
            <div className="p-6 border-t border-edge">
              <div className="flex items-center justify-between mb-2.5">
                <h3 className="font-display font-semibold text-xl m-0 text-[#f4f4f8]">{cur.title}</h3>
                <span className="font-mono text-[13px] text-emerald-300">{LEARN_ALG[cur.key]}</span>
              </div>
              <p className="text-[15px] leading-relaxed text-white/60 m-0">{cur.explanation}</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

// ===========================================================================
// Drill  — algorithm lab
// ===========================================================================
function Drill() {
  const cubeRef = useRef();
  const [alg, setAlg] = useState("R U R' U'");
  const runningRef = useRef(false);

  const run = useCallback(async (reverse) => {
    if (runningRef.current) return;
    const parsed = parseAlg(alg);
    if (!parsed.valid || !parsed.moves.length) return;
    const seq = reverse ? invertSequence(parsed.moves) : parsed.moves;
    runningRef.current = true;
    await playSeq(cubeRef, seq, 300, () => true);
    runningRef.current = false;
  }, [alg]);

  const reset = () => { runningRef.current = false; cubeRef.current?.setStateNow(SOLVED); };

  return (
    <main className="max-w-[820px] mx-auto px-4 sm:px-8 pt-10 sm:pt-16 pb-24">
      <p className="font-display text-[13px] tracking-[0.14em] uppercase text-white/40 mb-2">Algorithm lab</p>
      <h1 className="font-display font-semibold tracking-[-0.02em] mb-8 text-[#f4f4f8]" style={{ fontSize: 'clamp(30px,4vw,48px)' }}>Type it. Watch it run.</h1>

      <div className="relative h-80 border border-edge rounded-[20px] overflow-hidden mb-6" style={{ background: 'radial-gradient(circle at 50% 40%,#16161f,#0a0a0f 72%)' }}>
        <div className="absolute top-4 left-5 z-[3] font-mono text-xs text-white/40">drag to orbit</div>
        <div className="absolute inset-0 z-[2]"><Cube3D ref={cubeRef} initialState={SOLVED} /></div>
      </div>

      <label className="block text-[13px] text-white/50 mb-2">Algorithm (standard notation)</label>
      <input
        value={alg}
        onChange={(e) => setAlg(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') run(false); }}
        placeholder="R U R' U'"
        spellCheck={false}
        className="w-full font-mono text-[22px] tracking-[0.06em] text-[#f4f4f8] bg-panel border border-edge rounded-2xl px-[18px] py-4 outline-none transition focus:border-indigo-500 mb-4"
      />

      <div className="flex flex-wrap gap-2 mb-6">
        {DRILL_CHIPS.map((chip) => (
          <button key={chip.label} onClick={() => { setAlg(chip.alg); }} className="font-mono text-[13px] text-white/75 bg-panel2 border border-edge rounded-md px-3.5 py-2 cursor-pointer transition hover:border-indigo-500 hover:text-[#e7e7ee]">{chip.label}</button>
        ))}
      </div>

      <div className="flex gap-3 flex-wrap">
        <button onClick={() => run(false)} className="flex-1 min-w-[160px] h-[52px] rounded-2xl border-0 text-white font-display font-semibold text-base cursor-pointer transition hover:-translate-y-px" style={{ background: 'linear-gradient(135deg,#6366f1,#4f46e5)', boxShadow: '0 8px 22px rgba(99,102,241,.28)' }}>Run forward &nbsp;→</button>
        <button onClick={() => run(true)} className="flex-1 min-w-[160px] h-[52px] rounded-2xl bg-panel border border-edge text-[#e7e7ee] font-display font-semibold text-base cursor-pointer transition hover:border-emerald-400">← &nbsp;Run reverse</button>
        <button onClick={reset} title="Reset cube" className="flex-none w-[52px] h-[52px] rounded-2xl bg-panel border border-edge text-white/70 text-xl cursor-pointer transition hover:border-indigo-500 hover:text-[#e7e7ee]">↺</button>
      </div>
    </main>
  );
}
