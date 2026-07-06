import React, {
  forwardRef, useImperativeHandle, useMemo, useRef, useState, useCallback,
} from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { Cube } from '../engine/cube.js';
import { stickersFor, CUBELETS, parseMove } from '../engine/geometry.js';

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

function Cubelet({ pos, stickers }) {
  return (
    <group position={pos}>
      <RoundedBox args={[0.96, 0.96, 0.96]} radius={0.08} smoothness={3} castShadow receiveShadow>
        <meshStandardMaterial color="#0c0c12" roughness={0.55} metalness={0.15} />
      </RoundedBox>
      {stickers.map((s, i) => (
        <mesh key={i} position={s.normal.map((v) => v * 0.5)} rotation={stickerRotation(s.normal)}>
          <planeGeometry args={[0.82, 0.82]} />
          <meshStandardMaterial color={s.color} roughness={0.35} metalness={0.05} />
        </mesh>
      ))}
    </group>
  );
}

// The rotating rig. Holds `state` (facelet string) and animates single moves.
const CubeRig = forwardRef(function CubeRig({ initialState, onStep }, ref) {
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

  const stickerMap = useMemo(() => stickersFor(state), [state]);
  const a = anim.current;
  const inLayer = (p) => a && p[a.axisIndex] === a.layer;

  const staticCubelets = [];
  const movingCubelets = [];
  for (const p of CUBELETS) {
    const stickers = stickerMap.get(p.join(',')) || [];
    const el = <Cubelet key={p.join(',')} pos={p} stickers={stickers} />;
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

const Cube3D = forwardRef(function Cube3D({ initialState, onStep }, ref) {
  const rigRef = useRef();
  useImperativeHandle(ref, () => ({
    apply: (t, d) => rigRef.current.apply(t, d),
    setStateNow: (s) => rigRef.current.setStateNow(s),
    getState: () => rigRef.current.getState(),
  }));

  return (
    <Canvas
      className="canvas-touch"
      shadows
      camera={{ position: [4.2, 4.4, 5.6], fov: 42 }}
      gl={{ antialias: true, alpha: true }}
      dpr={[1, 2]}
    >
      <ambientLight intensity={0.7} />
      <directionalLight position={[6, 9, 6]} intensity={1.15} castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[-6, -3, -6]} intensity={0.35} />
      <group scale={1}>
        <CubeRig ref={rigRef} initialState={initialState} onStep={onStep} />
      </group>
      <OrbitControls enablePan={false} minDistance={5} maxDistance={12} enableDamping dampingFactor={0.08} />
    </Canvas>
  );
});

export default Cube3D;
