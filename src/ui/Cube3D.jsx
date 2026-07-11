import React, {
  forwardRef, useImperativeHandle, useMemo, useRef, useState, useCallback, useEffect,
} from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { Cube } from '../engine/cube.js';
import { stickersFor, CUBELETS, parseMove, COLORS } from '../engine/geometry.js';

const HALF_PI = Math.PI / 2;
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

// Rotation to orient a +z plane to face a given axis-aligned normal.
function stickerRotation(n) {
  if (n[1] === 1) return [-HALF_PI, 0, 0];
  if (n[1] === -1) return [HALF_PI, 0, 0];
  if (n[0] === 1) return [0, HALF_PI, 0];
  if (n[0] === -1) return [0, -HALF_PI, 0];
  if (n[2] === -1) return [0, Math.PI, 0];
  return [0, 0, 0];
}

// A single sticker plane. In paint mode it becomes clickable: a tap paints it the
// current colour, while a drag still orbits the cube (we compare pointer-down vs
// pointer-up screen position and only paint if the pointer barely moved). Centres
// ARE paintable — they declare which colour each face is, so a cube can be entered
// in whatever orientation the player is holding it (the solver re-orients it).
function Sticker({ position, rotation, color, index, paint }) {
  const [hover, setHover] = useState(false);
  const paintable = !!paint;

  // r3f's synthetic event doesn't reliably carry clientX/clientY at the top level,
  // so read screen coords from the underlying native pointer event.
  const screenXY = (e) => { const n = e.nativeEvent || e; return [n.clientX ?? 0, n.clientY ?? 0]; };

  const handlers = paintable
    ? {
        onPointerOver: (e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = 'crosshair'; },
        onPointerOut: () => { setHover(false); document.body.style.cursor = ''; },
        onPointerDown: (e) => { const [x, y] = screenXY(e); paint.downRef.current = { x, y }; },
        onPointerUp: (e) => {
          const d = paint.downRef.current;
          paint.downRef.current = null;
          const [x, y] = screenXY(e);
          if (d && Math.hypot(x - d.x, y - d.y) < 6) { e.stopPropagation(); paint.onPaint(index); }
        },
      }
    : {};

  return (
    <mesh position={position} rotation={rotation} {...handlers}>
      <planeGeometry args={[0.82, 0.82]} />
      <meshStandardMaterial
        color={color}
        roughness={0.35}
        metalness={0.05}
        emissive={hover ? '#ffffff' : '#000000'}
        emissiveIntensity={hover ? 0.28 : 0}
      />
    </mesh>
  );
}

function Cubelet({ pos, stickers, paint }) {
  return (
    <group position={pos}>
      <RoundedBox args={[0.96, 0.96, 0.96]} radius={0.08} smoothness={3} castShadow receiveShadow>
        <meshStandardMaterial color="#0c0c12" roughness={0.55} metalness={0.15} />
      </RoundedBox>
      {stickers.map((s, i) => (
        <Sticker
          key={i}
          position={s.normal.map((v) => v * 0.5)}
          rotation={stickerRotation(s.normal)}
          color={s.color}
          index={s.index}
          paint={paint}
        />
      ))}
    </group>
  );
}

// The rotating rig. Holds `state` (facelet string) and animates single moves.
const CubeRig = forwardRef(function CubeRig({ initialState, onStep, paint, colorMap }, ref) {
  const [state, setState] = useState(initialState);
  const anim = useRef(null); // { axisIndex, layer, sign, turns, elapsed, duration, token, resolve }
  const pivot = useRef();

  useImperativeHandle(ref, () => ({
    getState: () => state,
    setStateNow: (s) => { anim.current = null; if (pivot.current) pivot.current.rotation.set(0, 0, 0); setState(s); },
    apply: (token, duration = 320) =>
      new Promise((resolve) => {
        const { geom, turns } = parseMove(token);
        anim.current = {
          axisIndex: geom.axisIndex, layer: geom.layer, sign: geom.dir,
          turns: Math.abs(turns), signMul: turns < 0 ? -1 : 1,
          elapsed: 0, duration, token, resolve,
        };
      }),
  }), [state]);

  useFrame((_, delta) => {
    const a = anim.current;
    if (!a || !pivot.current) return;
    a.elapsed += delta * 1000;
    const t = Math.min(1, a.elapsed / a.duration);
    const total = a.sign * a.signMul * HALF_PI * a.turns;
    const angle = total * easeInOut(t);
    pivot.current.rotation.set(0, 0, 0);
    if (a.axisIndex === 0) pivot.current.rotation.x = angle;
    else if (a.axisIndex === 1) pivot.current.rotation.y = angle;
    else pivot.current.rotation.z = angle;
    if (t >= 1) {
      const next = new Cube(state.split('')).move(a.token).toString();
      const resolve = a.resolve;
      anim.current = null;
      pivot.current.rotation.set(0, 0, 0);
      setState(next);
      if (onStep) onStep(next);
      resolve && resolve(next);
    }
  });

  const stickerMap = useMemo(() => stickersFor(state, colorMap || COLORS), [state, colorMap]);
  const a = anim.current;
  const inLayer = (p) => a && p[a.axisIndex] === a.layer;

  const staticCubelets = [];
  const movingCubelets = [];
  for (const p of CUBELETS) {
    const stickers = stickerMap.get(p.join(',')) || [];
    const el = <Cubelet key={p.join(',')} pos={p} stickers={stickers} paint={paint} />;
    if (inLayer(p)) movingCubelets.push(el);
    else staticCubelets.push(el);
  }

  return (
    <group>
      {staticCubelets}
      <group ref={pivot}>{movingCubelets}</group>
    </group>
  );
});

const Cube3D = forwardRef(function Cube3D({ initialState, onStep, paintMode = false, onPaintSticker, colorMap = null }, ref) {
  const rigRef = useRef();
  const downRef = useRef(null);

  // Bundle the paint wiring only when paint mode is on, so normal viewing keeps
  // the stickers non-interactive (no hover cursor, no pointer handlers).
  const paint = useMemo(
    () => (paintMode && onPaintSticker ? { onPaint: onPaintSticker, downRef } : null),
    [paintMode, onPaintSticker],
  );

  // r3f's initial ResizeObserver pass doesn't always trigger the first draw
  // (StrictMode / context timing, or a parent whose size — e.g. an aspect-ratio
  // box — settles a frame or two after mount), leaving the canvas blank until
  // the user interacts. Nudge a resize on the next frames AND a few times over
  // the first ~half second so late layout still forces r3f to paint.
  useEffect(() => {
    const kick = () => window.dispatchEvent(new Event('resize'));
    const raf1 = requestAnimationFrame(kick);
    const raf2 = requestAnimationFrame(() => requestAnimationFrame(kick));
    const timers = [80, 200, 450].map((ms) => setTimeout(kick, ms));
    return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2); timers.forEach(clearTimeout); };
  }, []);

  useImperativeHandle(ref, () => ({
    apply: (t, d) => (rigRef.current ? rigRef.current.apply(t, d) : Promise.resolve()),
    setStateNow: (s) => rigRef.current?.setStateNow(s),
    getState: () => rigRef.current?.getState(),
  }));

  return (
    <Canvas
      className="canvas-touch"
      shadows
      frameloop="always"
      camera={{ position: [4.2, 4.4, 5.6], fov: 42 }}
      gl={{ antialias: true, alpha: true }}
      dpr={[1, 2]}
    >
      <ambientLight intensity={0.7} />
      <directionalLight position={[6, 9, 6]} intensity={1.15} castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[-6, -3, -6]} intensity={0.35} />
      <group scale={1}>
        <CubeRig ref={rigRef} initialState={initialState} onStep={onStep} paint={paint} colorMap={colorMap} />
      </group>
      <OrbitControls enablePan={false} minDistance={5} maxDistance={12} enableDamping dampingFactor={0.08} />
    </Canvas>
  );
});

export default Cube3D;
