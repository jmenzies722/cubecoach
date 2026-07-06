import React, { useCallback, useMemo, useRef, useState } from 'react';
import { parseAlg, EXAMPLES } from '../engine/algParse.js';
import { invertSequence } from '../engine/cube.js';

const SPEEDS = [
  { label: '0.5×', ms: 620 },
  { label: '1×', ms: 340 },
  { label: '2×', ms: 180 },
];

export default function DrillMode({ applyMove, resetCube, onClose }) {
  const [text, setText] = useState("R U R' U'");
  const [error, setError] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState({ i: 0, n: 0 });
  const [speedIdx, setSpeedIdx] = useState(1);
  const [direction, setDirection] = useState(null); // 'fwd' | 'rev' | null

  // Cancellation token — bump on stop / new run so any inflight loop bails.
  const runIdRef = useRef(0);
  const speedRef = useRef(SPEEDS[1].ms);
  speedRef.current = SPEEDS[speedIdx].ms;

  const parsed = useMemo(() => parseAlg(text), [text]);

  const runSequence = useCallback(async (sequence, dir) => {
    if (playing) return;
    setError(null);
    if (!sequence.length) return;
    const myRun = ++runIdRef.current;
    setPlaying(true);
    setDirection(dir);
    setProgress({ i: 0, n: sequence.length });
    try {
      resetCube();
      for (let k = 0; k < sequence.length; k++) {
        if (runIdRef.current !== myRun) return; // cancelled
        await applyMove(sequence[k], speedRef.current);
        if (runIdRef.current !== myRun) return;
        setProgress({ i: k + 1, n: sequence.length });
      }
    } catch (e) {
      setError(e?.message || 'Playback failed.');
    } finally {
      if (runIdRef.current === myRun) {
        setPlaying(false);
        setDirection(null);
      }
    }
  }, [applyMove, resetCube, playing]);

  const onRun = useCallback(() => {
    const p = parseAlg(text);
    if (!p.valid) { setError(p.error); return; }
    runSequence(p.moves, 'fwd');
  }, [text, runSequence]);

  const onReverse = useCallback(() => {
    const p = parseAlg(text);
    if (!p.valid) { setError(p.error); return; }
    runSequence(invertSequence(p.moves), 'rev');
  }, [text, runSequence]);

  const onStop = useCallback(() => {
    runIdRef.current++; // invalidate inflight loop
    setPlaying(false);
    setDirection(null);
  }, []);

  const onReset = useCallback(() => {
    runIdRef.current++;
    setPlaying(false);
    setDirection(null);
    setProgress({ i: 0, n: 0 });
    setError(null);
    resetCube();
  }, [resetCube]);

  const pickExample = useCallback((alg) => {
    if (playing) return;
    setText(alg);
    setError(null);
    setProgress({ i: 0, n: 0 });
  }, [playing]);

  const inputInvalid = text.trim().length > 0 && !parsed.valid;
  const disableRun = playing || !parsed.valid;

  return (
    <div className="rounded-2xl bg-panel/70 border border-edge p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="font-display text-white/90">Algorithm drill</span>
        <button
          onClick={onClose}
          className="text-xs text-white/50 hover:text-white transition"
        >
          ✕ close
        </button>
      </div>

      <p className="text-[13px] text-white/55 leading-relaxed">
        Paste any alg — sexy move, Sune, a PLL — and watch it run on the cube. Use
        <span className="text-white/80"> Reverse</span> to undo it and burn it into muscle memory.
      </p>

      {/* Input */}
      <div>
        <label className="text-[11px] uppercase tracking-widest text-white/35">Algorithm</label>
        <input
          value={text}
          onChange={(e) => { setText(e.target.value); setError(null); }}
          onKeyDown={(e) => { if (e.key === 'Enter' && !disableRun) onRun(); }}
          disabled={playing}
          spellCheck={false}
          autoCapitalize="characters"
          placeholder="R U R' U'"
          className={`mt-1 w-full px-3 py-2 rounded-xl bg-ink/60 border text-sm font-display text-white/90 placeholder-white/25 outline-none transition disabled:opacity-50 ${
            inputInvalid ? 'border-red-400/60 focus:border-red-400' : 'border-edge focus:border-indigo-400/60'
          }`}
        />
        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      </div>

      {/* Examples */}
      <div>
        <p className="text-[11px] uppercase tracking-widest text-white/35 mb-2">Quick picks</p>
        <div className="flex flex-wrap gap-1.5">
          {EXAMPLES.map((ex) => (
            <button
              key={ex.name}
              onClick={() => pickExample(ex.alg)}
              disabled={playing}
              title={ex.alg}
              className="text-[11px] px-2 py-1 rounded-md border border-edge bg-ink/70 text-white/55 hover:text-white hover:border-indigo-400/60 disabled:opacity-30 transition font-display"
            >
              {ex.name}
            </button>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-2">
        <button
          onClick={onRun}
          disabled={disableRun}
          className="btn-accent flex-1 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {playing && direction === 'fwd' ? 'Running…' : 'Run'}
        </button>
        <button
          onClick={onReverse}
          disabled={disableRun}
          className="btn-primary flex-1 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {playing && direction === 'rev' ? 'Reversing…' : 'Reverse'}
        </button>
      </div>

      <div className="flex gap-2">
        <button
          onClick={onStop}
          disabled={!playing}
          className="flex-1 py-2 rounded-xl border border-edge text-sm text-white/70 hover:text-white hover:border-white/30 disabled:opacity-30 transition font-display"
        >
          Stop
        </button>
        <button
          onClick={onReset}
          disabled={playing}
          className="flex-1 py-2 rounded-xl border border-edge text-sm text-white/70 hover:text-white hover:border-white/30 disabled:opacity-30 transition font-display"
        >
          Reset cube
        </button>
      </div>

      {/* Speed + progress */}
      <div className="border-t border-edge pt-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-white/50 font-display">
            move {progress.i} / {progress.n || (parsed.valid ? parsed.moves.length : 0)}
          </span>
          <div className="flex gap-1">
            {SPEEDS.map((s, i) => (
              <button
                key={s.label}
                onClick={() => setSpeedIdx(i)}
                className={`text-[11px] px-2 py-1 rounded-md border transition ${
                  i === speedIdx
                    ? 'border-indigo-400 text-indigo-200 bg-indigo-500/10'
                    : 'border-edge text-white/40 hover:text-white/70'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-2 h-1.5 rounded-full bg-ink overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-indigo-400 to-emerald-400 transition-all"
            style={{ width: `${progress.n ? (progress.i / progress.n) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Move preview */}
      {parsed.valid && (
        <div className="flex flex-wrap gap-1">
          {(direction === 'rev' ? invertSequence(parsed.moves) : parsed.moves).map((m, k) => {
            const active = playing && k === Math.max(0, progress.i - 1);
            return (
              <span
                key={k}
                className={`text-[11px] px-1.5 py-0.5 rounded font-display ${
                  active ? 'bg-emerald-400 text-ink' : 'bg-ink/70 text-white/55'
                }`}
              >
                {m}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
