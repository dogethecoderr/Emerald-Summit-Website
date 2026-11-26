// The six disciplines as detailed planets (three.js through React Three
// Fiber), drawn in one canvas over the orbit stage in OrbitalUniverses. The DOM
// wheel still owns the layout and the labels; this follows its turn each frame.
// Loaded lazily, so three.js never weighs on the landing page's first paint.
//
// Each planet is a painted surface (planetTextures.ts: shades of its palette
// plus details from its dashboard world), a soft atmosphere rim, and one
// extra that echoes that world: TechVerse's data ring, VentureVerse's gold
// ring, BioSphere's twin bead strands, NovaSphere's orbiting electrons,
// CivicVerse's colonnade ring, ImagineX's paint ring.
//
// Kept cheap: every texture is painted once per page load and shared,
// materials are MeshStandard (no clearcoat or transmission), the pixel ratio
// is capped at 1.5, the frame loop stops while the section is off screen, and
// nothing in the per-frame code allocates.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import type { MotionValue } from 'framer-motion';
import * as THREE from 'three';
import { VERSE_VIBES, type VerseMotif } from '../models/verseVibes';
import { paintPlanet, paintRing, type PlanetMaps } from './planetTextures';
import { SECTION_JUMP_EVENT, SECTION_JUMP_START_EVENT } from '../landing/jumpToSection';

export interface PlanetSpec {
  name: string;
  color: string;
}

interface Props {
  /** The wheel's turn in degrees (clockwise), as the DOM wheel uses it. */
  rotate: MotionValue<number>;
  active: number;
  planets: PlanetSpec[];
  /** Ring radius in percent of the stage, the same as the DOM slots. */
  radius: number;
  /** Called once the canvas has a WebGL renderer, so the flat dots can hide. */
  onReady: () => void;
}

/** Planet radius in px, and how much the planet at the top grows (matches the DOM dot in landing.css). */
export const PLANET_RADIUS = 26;
export const ACTIVE_SCALE = 1.7;

const TAU = Math.PI * 2;

// Painted once per page load; React re-renders and remounts reuse them.
const painted = new Map<string, { maps: PlanetMaps; ring: THREE.CanvasTexture }>();
function surfaceFor(spec: PlanetSpec, motif: VerseMotif | 'gem', index: number) {
  let s = painted.get(spec.name);
  if (!s) {
    const vibe = VERSE_VIBES[spec.name];
    const palette = vibe?.flowColors ?? [spec.color];
    const seed = 97 + index * 7919;
    s = { maps: paintPlanet(motif, spec.color, palette, vibe?.accent ?? spec.color, seed), ring: paintRing(palette, seed + 1) };
    painted.set(spec.name, s);
  }
  return s;
}

/** A soft rim of light, brighter at the planet's edge (one cheap fresnel shader, additive). */
const atmosphereVertex = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;
const atmosphereFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uStrength;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    float rim = pow(1.0 - abs(dot(vNormal, vView)), 2.6);
    gl_FragColor = vec4(uColor * rim * uStrength, rim * uStrength);
  }
`;

/** RingGeometry with its UVs remapped so u runs from the inner to the outer edge (for a strip texture). */
function ringGeometry(inner: number, outer: number) {
  const g = new THREE.RingGeometry(inner, outer, 96, 1);
  const pos = g.attributes.position;
  const uv = g.attributes.uv;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    uv.setXY(i, (v.length() - inner) / (outer - inner), 0.5);
  }
  return g;
}

/** Many copies of one small mesh in a single draw call; their transforms are set once. */
function Instances({ count, place, color, children }: {
  count: number;
  place: (i: number, o: THREE.Object3D) => void;
  color: (i: number) => string;
  children: React.ReactNode;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D();
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      o.position.set(0, 0, 0);
      o.rotation.set(0, 0, 0);
      place(i, o);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      m.setColorAt(i, c.set(color(i)));
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    // place/color are fixed per planet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);
  return <instancedMesh ref={ref} args={[undefined, undefined, count]}>{children}</instancedMesh>;
}

function Extra({ motif, accent, palette, ring }: { motif: VerseMotif | 'gem'; accent: string; palette: string[]; ring: THREE.CanvasTexture }) {
  const spin = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (spin.current) spin.current.rotation.z += delta * (motif === 'stars' ? 0.9 : 0.25);
  });
  const r = PLANET_RADIUS;

  if (motif === 'stars') {
    // NovaSphere: two tilted orbits, each with a glowing electron.
    return (
      <>
        {[0.5, -0.9].map((tilt, i) => (
          <group key={i} rotation={[1.2, tilt, 0]}>
            <mesh>
              <torusGeometry args={[r * 1.55, 0.35, 6, 96]} />
              <meshBasicMaterial color={accent} transparent opacity={0.45} />
            </mesh>
            <group ref={i === 0 ? spin : undefined} rotation={[0, 0, i * 2.2]}>
              <mesh position={[r * 1.55, 0, 0]}>
                <sphereGeometry args={[1.8, 12, 8]} />
                <meshBasicMaterial color={palette[3] ?? accent} />
              </mesh>
            </group>
          </group>
        ))}
      </>
    );
  }

  if (motif === 'cells') {
    // BioSphere: two strands of beads winding round it, like the helix in its world.
    const beads = 22;
    return (
      <group rotation={[1.25, 0.35, 0]}>
        <group ref={spin}>
          <Instances
            count={beads * 2}
            place={(k, o) => {
              const strand = k % 2;
              const a = (Math.floor(k / 2) / beads) * TAU;
              const rr = r * 1.45;
              o.position.set(Math.cos(a) * rr, Math.sin(a) * rr, Math.sin(a * 3 + strand * Math.PI) * r * 0.18);
            }}
            color={(k) => palette[k % 2 ? 0 : 2] ?? accent}
          >
            <sphereGeometry args={[1.25, 8, 6]} />
            <meshStandardMaterial roughness={0.5} />
          </Instances>
        </group>
      </group>
    );
  }

  if (motif === 'ripples') {
    // CivicVerse: a ring of pale columns, a nod to its domed hall.
    const cols = 28;
    return (
      <group rotation={[1.3, 0.2, 0]}>
        <group ref={spin}>
          <Instances
            count={cols}
            place={(k, o) => {
              const a = (k / cols) * TAU;
              o.position.set(Math.cos(a) * r * 1.6, Math.sin(a) * r * 1.6, 0);
              o.rotation.set(Math.PI / 2, 0, 0);
            }}
            color={() => '#F4EEF6'}
          >
            <cylinderGeometry args={[0.9, 0.9, 5, 6]} />
            <meshStandardMaterial roughness={0.6} />
          </Instances>
        </group>
      </group>
    );
  }

  // TechVerse, VentureVerse, ImagineX (and later disciplines): a banded ring in the palette.
  // Tilted well off edge-on, so the ring reads as a ring and not a line.
  const tilt = motif === 'circuit' ? [1.05, 0.3, 0] : motif === 'ticker' ? [0.95, -0.4, 0] : [1.0, 0.5, 0];
  const width = motif === 'circuit' ? [1.35, 1.75] : [1.4, 2.05];
  return <RingMesh texture={ring} tilt={tilt as [number, number, number]} inner={r * width[0]} outer={r * width[1]} />;
}

function RingMesh({ texture, tilt, inner, outer }: { texture: THREE.Texture; tilt: [number, number, number]; inner: number; outer: number }) {
  const geometry = useMemo(() => ringGeometry(inner, outer), [inner, outer]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh rotation={tilt} geometry={geometry}>
      <meshBasicMaterial map={texture} transparent side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  );
}

function Planet({ spec, index, count, isActive, rotate, radius }: {
  spec: PlanetSpec;
  index: number;
  count: number;
  isActive: boolean;
  rotate: MotionValue<number>;
  radius: number;
}) {
  const group = useRef<THREE.Group>(null);
  const body = useRef<THREE.Mesh>(null);
  const vibe = VERSE_VIBES[spec.name];
  const motif: VerseMotif | 'gem' = vibe?.motif ?? 'gem';
  const { maps, ring } = surfaceFor(spec, motif, index);
  const accent = vibe?.accent ?? spec.color;
  const palette = vibe?.flowColors ?? [spec.color];
  const atmosphere = useMemo(
    () => ({ uColor: { value: new THREE.Color(accent) }, uStrength: { value: 0.9 } }),
    [accent],
  );
  // Each planet leans at its own angle, like real worlds.
  const lean = useMemo(() => [0.25 + (index % 3) * 0.12, 0, (index % 2 ? -1 : 1) * 0.22] as const, [index]);

  useFrame((state, delta) => {
    const g = group.current;
    if (!g) return;
    const { width, height } = state.size;
    // Same place as the DOM slot: its base angle plus the wheel's turn (screen y runs down, three's up).
    const a = (-index / count) * TAU - Math.PI / 2 + (rotate.get() * Math.PI) / 180;
    g.position.set((width * radius * Math.cos(a)) / 100, (-height * radius * Math.sin(a)) / 100, 0);
    // The planet at the top grows, eased like the old spring.
    const target = isActive ? ACTIVE_SCALE : 1;
    g.scale.setScalar(g.scale.x + (target - g.scale.x) * Math.min(1, delta * 8));
    if (body.current) body.current.rotation.y += delta * 0.35;
    atmosphere.uStrength.value += ((isActive ? 1.2 : 0.75) - atmosphere.uStrength.value) * Math.min(1, delta * 6);
  });

  return (
    <group ref={group}>
      <group rotation={lean as unknown as [number, number, number]}>
        <mesh ref={body}>
          <sphereGeometry args={[PLANET_RADIUS, 48, 32]} />
          <meshStandardMaterial
            map={maps.map}
            emissiveMap={maps.glow}
            emissive="#ffffff"
            emissiveIntensity={isActive ? 1.1 : 0.7}
            roughness={0.72}
            metalness={0.05}
          />
        </mesh>
        <Extra motif={motif} accent={accent} palette={palette} ring={ring} />
      </group>
      <mesh scale={1.14}>
        <sphereGeometry args={[PLANET_RADIUS, 32, 24]} />
        <shaderMaterial
          vertexShader={atmosphereVertex}
          fragmentShader={atmosphereFragment}
          uniforms={atmosphere}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.BackSide}
        />
      </mesh>
    </group>
  );
}

export default function OrbitPlanets3D({ rotate, active, planets, radius, onReady }: Props) {
  // Only draw while the section is on screen.
  const wrapRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);
  // A nav or footer scroll passing through: hold the last frame instead of rendering every frame of the trip.
  const [passing, setPassing] = useState(false);
  useEffect(() => {
    const start = () => setPassing(true);
    const land = () => setPassing(false);
    window.addEventListener(SECTION_JUMP_START_EVENT, start);
    window.addEventListener(SECTION_JUMP_EVENT, land);
    return () => {
      window.removeEventListener(SECTION_JUMP_START_EVENT, start);
      window.removeEventListener(SECTION_JUMP_EVENT, land);
    };
  }, []);

  return (
    <div ref={wrapRef} className="lp-orbit__planets3d" aria-hidden>
      <Canvas
        orthographic
        camera={{ position: [0, 0, 300], zoom: 1, near: 0.1, far: 1000 }}
        // Capped at 1.5: the planets are small, and a 2× buffer costs nearly twice the fill.
        dpr={[1, 1.5]}
        frameloop={visible && !passing ? 'always' : 'never'}
        gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
        onCreated={() => onReady()}
      >
        <ambientLight intensity={0.35} />
        {/* Key light from the upper left, and a soft emerald fill from the Summit logo at the centre. */}
        <directionalLight position={[-200, 260, 300]} intensity={2.6} />
        <pointLight position={[0, 0, 60]} intensity={0.9} distance={0} decay={0} color="#d1fae5" />
        {planets.map((p, i) => (
          <Planet
            key={p.name}
            spec={p}
            index={i}
            count={planets.length}
            isActive={i === active}
            rotate={rotate}
            radius={radius}
          />
        ))}
      </Canvas>
    </div>
  );
}
