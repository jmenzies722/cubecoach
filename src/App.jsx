import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Cube3D from './ui/Cube3D.jsx';
import { Cube, SOLVED, randomScramble } from './engine/cube.js';
import { solve } from './engine/solver.js';
import { validateCube } from './engine/validate.js';
import { COLORS } from './engine/geometry.js';

const SPEEDS = [
  { label: '0.5×', ms: 620 },
  { label: '1×', ms: 340 },
  { label: '2×', ms: 180 },
  { label: '4×', ms: 90 },
];
const MOVE_BTNS = ['U', "U'", 'R', "R'", 'F', "F'", 'D', "D'", 'L', "L'", 'B', "B'"];

const stateAfter = (start, moves, k) => Cube.fromString(start).moves(moves.slice(0, k)).toString();

function stageForStep(stages, step) {
  let acc = 0;
  for (let i = 0; i < stages.length; i++) {
    const len = stages[i].moves.length;
    if (step < acc + len || i === stages.length - 1) return { index: i, localStep: step - acc };
    acc += len;
  }
  return { index: 0, localStep: 0 };
}

export default function App() {
  const cubeRef = useRef();
  const [startState, setStartState] = useState(SOLVED);
  const [solution, setSolution] = useState(null);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speedIdx, setSpeedIdx] = useState(1);
  const [error, setError] = useState(null);
  const [painting, setPainting] = useState(false);

  const playingRef = useRef(false);
  const stepRef = useRef(0);
  const speedRef = useRef(SPEEDS[1].ms);
  useEffect(() => { speedRef.current = SPEEDS[speedIdx].ms; }, [speedIdx]);
  useEffect(() => { stepRef.current = step; }, [step]);

  const moves = solution?.moves || [];

  const loadState = useCallback((state, { push = true } = {}) => {
    setPlaying(false); playingRef.current = false;
    setSolution(null); setStep(0); stepRef.current = 0; setError(null);
    setStartState(state);
    cubeRef.current?.setStateNow(state);
    if (push) {
      const url = new URL(window.location);
      if (state === SOLVED) url.searchParams.delete('c');
      else url.searchParams.set('c', state);
      window.history.replaceState({}, '', url);
    }
  }, []);

  // load shared state from URL on mount
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const c = p.get('c');
    const s = p.get('s'); // legacy: move sequence
    if (c && validateCube(c).valid) loadState(c, { push: false });
    else if (s) { try { loadState(new Cube().moves(s).toString(), { push: false }); } catch { /* ignore */ } }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doScramble = useCallback(() => {
    loadState(new Cube().moves(randomScramble(25)).toString());
  }, [loadState]);

  const doSolve = useCallback(() => {
    setError(null);
    try {
      const sol = solve(startState);
      setSolution(sol);
      setStep(0); stepRef.current = 0;
      cubeRef.current?.setStateNow(startState);
    } catch (e) {
      setError(e.message || 'Could not solve this cube.');
    }
  }, [startState]);

  const gotoStep = useCallback((k) => {
    const clamped = Math.max(0, Math.min(moves.length, k));
    setPlaying(false); playingRef.current = false;
    setStep(clamped); stepRef.current = clamped;
    cubeRef.current?.setStateNow(stateAfter(startState, moves, clamped));
  }, [moves, startState]);

  const play = useCallback(async () => {
    if (!solution || stepRef.current >= moves.length) return;
    setPlaying(true); playingRef.current = true;
    for (let k = stepRef.current; k < moves.length; k++) {
      if (!playingRef.current) break;
      await cubeRef.current.apply(moves[k], speedRef.current);
      stepRef.current = k + 1; setStep(k + 1);
    }
    setPlaying(false); playingRef.current = false;
  }, [solution, moves]);

  const pause = useCallback(() => { setPlaying(false); playingRef.current = false; }, []);

  const manualTurn = useCallback(async (m) => {
    if (playing || painting) return;
    setSolution(null); setStep(0); stepRef.current = 0;
    await cubeRef.current.apply(m, 260);
    loadState(cubeRef.current.getState());
  }, [playing, painting, loadState]);

  const share = useCallback(async () => {
    try { await navigator.clipboard.writeText(window.location.href); } catch { /* noop */ }
  }, []);

  const cur = solution ? stageForStep(solution.stages, Math.min(step, Math.max(0, moves.length - 1))) : null;
  const isSolved = solution && step >= moves.length && moves.length > 0;

  return (
    <div className="min-h-full flex flex-col">
      <Header onShare={share} canShare={startState !== SOLVED} />
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-4 px-4 pb-6 max-w-[1400px] w-full mx-auto">
        <section className="relative rounded-2xl bg-panel/70 border border-edge overflow-hidden min-h-[46vh] lg:min-h-[70vh]">
          <Cube3D ref={cubeRef} initialState={startState} />
          <div className="pointer-events-none absolute top-3 left-3 text-xs text-white/40 font-display tracking-wide">
            drag to rotate · scroll to zoom
          </div>
          {isSolved && (
            <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-emerald-500/20 to-transparent text-center">
              <span className="font-display text-emerald-300 text-lg">Solved. Nice.</span>
            </div>
          )}
        </section>

        <section className="flex flex-col gap-4">
          {painting ? (
            <PaintPanel
              startState={startState}
              onPreview={(s) => cubeRef.current?.setStateNow(s)}
              onCancel={() => { setPainting(false); cubeRef.current?.setStateNow(startState); }}
              onUse={(s) => { setPainting(false); loadState(s); }}
            />
          ) : (
            <>
              <Panel>
                <div className="flex gap-2">
                  <button onClick={doScramble} className="btn-primary flex-1">Scramble</button>
                  <button onClick={doSolve} disabled={startState === SOLVED} className="btn-accent flex-1 disabled:opacity-40 disabled:cursor-not-allowed">Solve it</button>
                </div>
                <button onClick={() => { setPainting(true); }} className="mt-2 w-full py-2 rounded-xl border border-edge text-sm text-white/70 hover:text-white hover:border-white/30 transition font-display">
                  ✎ Paint my own cube
                </button>
                {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
                <MoveGrid onTurn={manualTurn} disabled={playing} />
              </Panel>

              {solution ? (
                <Panel className="flex-1 flex flex-col min-h-0">
                  <Playback
                    playing={playing} onPlay={play} onPause={pause}
                    onPrev={() => gotoStep(step - 1)} onNext={() => gotoStep(step + 1)}
                    onRestart={() => gotoStep(0)} step={step} total={moves.length}
                    speedIdx={speedIdx} onSpeed={setSpeedIdx}
                  />
                  <StageList
                    stages={solution.stages} current={cur}
                    onJumpStage={(i) => { let acc = 0; for (let j = 0; j < i; j++) acc += solution.stages[j].moves.length; gotoStep(acc); }}
                  />
                </Panel>
              ) : (
                <Panel>
                  <p className="text-sm text-white/60 leading-relaxed">
                    <span className="font-display text-white/90">How it works.</span> Hit
                    {' '}<span className="text-indigo-300">Scramble</span> (or paint your real cube),
                    then <span className="text-emerald-300">Solve it</span>. You'll get the solution
                    broken into named stages — play it, step through it, and read the plain-English
                    <em> why</em> behind each stage.
                  </p>
                </Panel>
              )}
            </>
          )}
        </section>
      </main>
      <StyleBits />
    </div>
  );
}

// ---- Paint mode ------------------------------------------------------------

const NET = { // face -> [gridRow, gridCol] base (1-indexed)
  U: [1, 4], L: [4, 1], F: [4, 4], R: [4, 7], B: [4, 10], D: [7, 4],
};
const FACE_OFFSET = { U: 0, R: 9, F: 18, D: 27, L: 36, B: 45 };
const CENTER_LOCAL = 4;

function PaintPanel({ startState, onPreview, onCancel, onUse }) {
  const [draft, setDraft] = useState(startState === SOLVED ? SOLVED : startState);
  const [pick, setPick] = useState('D'); // white by default
  const [err, setErr] = useState(null);

  useEffect(() => { onPreview(draft); }, [draft, onPreview]);

  const paint = (globalIdx, localIdx) => {
    if (localIdx === CENTER_LOCAL) return; // centres fixed
    setErr(null);
    setDraft((d) => { const a = d.split(''); a[globalIdx] = pick; return a.join(''); });
  };

  const tryUse = () => {
    const res = validateCube(draft);
    if (res.valid) onUse(draft);
    else setErr(res.reason);
  };

  const cells = [];
  for (const [face, [br, bc]] of Object.entries(NET)) {
    for (let k = 0; k < 9; k++) {
      const gi = FACE_OFFSET[face] + k;
      const r = br + Math.floor(k / 3), c = bc + (k % 3);
      const isCenter = k === CENTER_LOCAL;
      cells.push(
        <button
          key={gi}
          onClick={() => paint(gi, k)}
          style={{ gridRow: r, gridColumn: c, background: COLORS[draft[gi]] }}
          className={`aspect-square rounded-[3px] border border-black/40 ${isCenter ? 'cursor-default ring-1 ring-white/40' : 'hover:brightness-110'}`}
          title={isCenter ? 'centre (fixed)' : ''}
        />,
      );
    }
  }

  return (
    <Panel className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="font-display text-white/90">Paint your cube</span>
        <button onClick={onCancel} className="text-xs text-white/50 hover:text-white">✕ cancel</button>
      </div>
      <p className="text-[13px] text-white/55 leading-relaxed">
        Pick a colour, then click stickers to match your real cube. Centres are fixed. Hold it with
        <span className="text-white/80"> white on the bottom, green in front.</span>
      </p>

      {/* palette */}
      <div className="flex gap-2">
        {['D', 'U', 'F', 'B', 'R', 'L'].map((f) => (
          <button
            key={f}
            onClick={() => setPick(f)}
            style={{ background: COLORS[f] }}
            className={`w-9 h-9 rounded-lg border-2 transition ${pick === f ? 'border-white scale-110' : 'border-black/40'}`}
            title={f}
          />
        ))}
      </div>

      {/* unfolded net */}
      <div className="grid gap-[3px] mx-auto w-full max-w-[320px]" style={{ gridTemplateColumns: 'repeat(12,1fr)', gridTemplateRows: 'repeat(9,1fr)' }}>
        {cells}
      </div>

      {err && <p className="text-sm text-red-400">{err}</p>}
      <div className="flex gap-2">
        <button onClick={() => { setDraft(SOLVED); setErr(null); }} className="flex-1 py-2 rounded-xl border border-edge text-sm text-white/70 hover:text-white transition">Reset</button>
        <button onClick={tryUse} className="btn-accent flex-1">Use this cube</button>
      </div>
    </Panel>
  );
}

// ---- Chrome ----------------------------------------------------------------

function Header({ onShare, canShare }) {
  return (
    <header className="flex items-center justify-between px-5 py-4 max-w-[1400px] w-full mx-auto">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-emerald-400 grid place-items-center font-display font-bold text-ink">C</div>
        <div>
          <h1 className="font-display text-lg leading-none">CubeCoach</h1>
          <p className="text-[11px] text-white/40 leading-none mt-1">solve any cube · actually learn how</p>
        </div>
      </div>
      <button onClick={onShare} disabled={!canShare} className="text-xs px-3 py-2 rounded-lg border border-edge text-white/70 hover:text-white hover:border-white/30 disabled:opacity-30 transition">
        Copy share link
      </button>
    </header>
  );
}

function Panel({ children, className = '' }) {
  return <div className={`rounded-2xl bg-panel/70 border border-edge p-4 ${className}`}>{children}</div>;
}

function MoveGrid({ onTurn, disabled }) {
  return (
    <div className="mt-3">
      <p className="text-[11px] uppercase tracking-widest text-white/35 mb-2">Turn a face</p>
      <div className="grid grid-cols-6 gap-1.5">
        {MOVE_BTNS.map((m) => (
          <button key={m} onClick={() => onTurn(m)} disabled={disabled} className="py-2 rounded-lg bg-ink/60 border border-edge text-sm font-display hover:border-indigo-400/60 hover:text-indigo-200 disabled:opacity-30 transition">{m}</button>
        ))}
      </div>
    </div>
  );
}

function Playback({ playing, onPlay, onPause, onPrev, onNext, onRestart, step, total, speedIdx, onSpeed }) {
  return (
    <div className="border-b border-edge pb-3 mb-3">
      <div className="flex items-center gap-2">
        <IconBtn onClick={onRestart} label="⏮" />
        <IconBtn onClick={onPrev} label="◀" />
        <button onClick={playing ? onPause : onPlay} className="flex-1 py-2 rounded-lg bg-emerald-500/90 hover:bg-emerald-400 text-ink font-display font-semibold transition">
          {playing ? 'Pause' : step >= total ? 'Replay' : 'Play'}
        </button>
        <IconBtn onClick={onNext} label="▶" />
      </div>
      <div className="flex items-center justify-between mt-3">
        <span className="text-xs text-white/50 font-display">move {Math.min(step, total)} / {total}</span>
        <div className="flex gap-1">
          {SPEEDS.map((s, i) => (
            <button key={s.label} onClick={() => onSpeed(i)} className={`text-[11px] px-2 py-1 rounded-md border transition ${i === speedIdx ? 'border-indigo-400 text-indigo-200 bg-indigo-500/10' : 'border-edge text-white/40 hover:text-white/70'}`}>{s.label}</button>
          ))}
        </div>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-ink overflow-hidden">
        <div className="h-full bg-gradient-to-r from-indigo-400 to-emerald-400 transition-all" style={{ width: `${total ? (Math.min(step, total) / total) * 100 : 0}%` }} />
      </div>
    </div>
  );
}

function IconBtn({ onClick, label }) {
  return <button onClick={onClick} className="w-10 py-2 rounded-lg bg-ink/60 border border-edge text-white/70 hover:text-white hover:border-white/30 transition">{label}</button>;
}

function StageList({ stages, current, onJumpStage }) {
  return (
    <div className="overflow-y-auto scroll-thin flex-1 -mr-2 pr-2 space-y-2">
      {stages.map((stage, i) => {
        const active = current && current.index === i;
        return (
          <button key={stage.key} onClick={() => onJumpStage(i)} className={`w-full text-left rounded-xl p-3 border transition ${active ? 'border-indigo-400/70 bg-indigo-500/10' : 'border-edge bg-ink/40 hover:border-white/20'}`}>
            <div className="flex items-center justify-between">
              <span className={`font-display text-sm ${active ? 'text-indigo-200' : 'text-white/80'}`}>{i + 1}. {stage.title}</span>
              <span className="text-[11px] text-white/35">{stage.moves.length} moves</span>
            </div>
            {active && (
              <>
                <p className="text-[13px] text-white/60 mt-2 leading-relaxed">{stage.explanation}</p>
                {stage.moves.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {stage.moves.map((m, k) => (
                      <span key={k} className={`text-[11px] px-1.5 py-0.5 rounded font-display ${k === current.localStep ? 'bg-emerald-400 text-ink' : 'bg-ink/70 text-white/55'}`}>{m}</span>
                    ))}
                  </div>
                )}
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}

function StyleBits() {
  return (
    <style>{`
      .btn-primary{background:linear-gradient(135deg,#6366f1,#4f46e5);color:#0a0a0f;font-weight:600;border-radius:.75rem;padding:.6rem 1rem;font-family:'Space Grotesk',sans-serif;transition:filter .15s}
      .btn-primary:hover{filter:brightness(1.08)}
      .btn-accent{background:linear-gradient(135deg,#34d399,#10b981);color:#0a0a0f;font-weight:600;border-radius:.75rem;padding:.6rem 1rem;font-family:'Space Grotesk',sans-serif;transition:filter .15s}
      .btn-accent:hover{filter:brightness(1.08)}
    `}</style>
  );
}
