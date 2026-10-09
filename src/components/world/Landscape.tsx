import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { getCourse, terrainHeight } from "@/lib/course";

function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function Terrain() {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(2800, 2400, 180, 160);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes["position"] as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    const grassA = new THREE.Color("#7ba94e");
    const grassB = new THREE.Color("#9cc05e");
    const field = new THREE.Color("#d9c46a");
    const verge = new THREE.Color("#5d8f3c");
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const { h, d } = terrainHeight(x, z);
      pos.setY(i, h);
      const patch = Math.sin(x * 0.006 + 2) * Math.cos(z * 0.007) + 0.4 * Math.sin(x * 0.02 - z * 0.017);
      c.copy(grassA).lerp(grassB, 0.5 + 0.5 * Math.sin(x * 0.015 + z * 0.01));
      if (patch > 0.75 && d > 30) c.lerp(field, 0.85);
      if (d < 14) c.lerp(verge, 0.5);
      colors.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return g;
  }, []);

  const tex = useMemo(() => {
    const loader = new THREE.TextureLoader();
    const t = loader.load("/textures/grass_color.jpg");
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(220, 190);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  }, []);

  return (
    <mesh geometry={geo} receiveShadow>
      <meshStandardMaterial map={tex} vertexColors roughness={0.95} />
    </mesh>
  );
}

function roadTexture() {
  const cv = document.createElement("canvas");
  cv.width = 256;
  cv.height = 512;
  const ctx = cv.getContext("2d")!;
  ctx.fillStyle = "#54565a";
  ctx.fillRect(0, 0, 256, 512);
  const rnd = mulberry32(7);
  for (let i = 0; i < 9000; i++) {
    const v = 60 + rnd() * 60;
    ctx.fillStyle = `rgb(${v},${v},${v + 3})`;
    ctx.fillRect(rnd() * 256, rnd() * 512, 2, 2);
  }
  // worn centre band
  ctx.fillStyle = "rgba(0,0,0,0.08)";
  ctx.fillRect(70, 0, 116, 512);
  ctx.fillStyle = "#f1efe6";
  ctx.fillRect(10, 0, 6, 512);
  ctx.fillRect(240, 0, 6, 512);
  ctx.fillRect(124, 0, 8, 260);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function Road() {
  const { geo, tex } = useMemo(() => {
    const c = getCourse();
    const W = 4.5;
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    for (let i = 0; i <= c.n; i++) {
      const j = Math.min(i + 1, c.n);
      const k = i === c.n ? 1 : j;
      const base = i === c.n ? 0 : i;
      const dx = c.x[k]! - c.x[base]!;
      const dz = c.z[k]! - c.z[base]!;
      const l = Math.hypot(dx, dz) || 1;
      const nx = -dz / l;
      const nz = dx / l;
      const y = c.y[i]! + 0.06;
      pos.push(c.x[i]! + nx * W, y, c.z[i]! + nz * W, c.x[i]! - nx * W, y, c.z[i]! - nz * W);
      uv.push(0, c.dist[i]! / 16, 1, c.dist[i]! / 16);
      if (i < c.n) {
        const a = i * 2;
        idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return { geo: g, tex: roadTexture() };
  }, []);
  return (
    <mesh geometry={geo} receiveShadow>
      <meshStandardMaterial map={tex} roughness={0.9} side={THREE.DoubleSide} />
    </mesh>
  );
}

type Placement = { x: number; y: number; z: number; s: number; rot: number };

// Scatter placements along the course, biased near the road but off it.
function scatter(count: number, seed: number, minOff: number, maxOff: number, maxCount?: number): Placement[] {
  const c = getCourse();
  const rnd = mulberry32(seed);
  const out: Placement[] = [];
  let guard = 0;
  while (out.length < (maxCount ?? count) && guard++ < count * 8) {
    const i = Math.floor(rnd() * c.n);
    const dx = c.x[i + 1]! - c.x[i]!;
    const dz = c.z[i + 1]! - c.z[i]!;
    const l = Math.hypot(dx, dz) || 1;
    const side = rnd() < 0.5 ? -1 : 1;
    const off = minOff + rnd() ** 2 * (maxOff - minOff);
    const x = c.x[i]! + (-dz / l) * off * side;
    const z = c.z[i]! + (dx / l) * off * side;
    const { h, d } = terrainHeight(x, z);
    if (d < minOff - 2) continue;
    out.push({ x, y: h, z, s: 0.8 + rnd() * 0.9, rot: rnd() * Math.PI * 2 });
  }
  return out;
}

// Renders every mesh of a GLB as an InstancedMesh at the given placements.
function GLBInstances({ url, places, castShadow = true }: { url: string; places: Placement[]; castShadow?: boolean }) {
  const { scene } = useGLTF(url);
  const meshes = useMemo(() => {
    const out: THREE.Mesh[] = [];
    scene.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) out.push(o as THREE.Mesh);
    });
    return out;
  }, [scene]);
  const refs = useRef<(THREE.InstancedMesh | null)[]>([]);

  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const v = new THREE.Vector3();
    places.forEach((p, i) => {
      q.setFromEuler(e.set(0, p.rot, 0));
      m.compose(v.set(p.x, p.y, p.z), q, new THREE.Vector3(p.s, p.s, p.s));
      refs.current.forEach((r) => r?.setMatrixAt(i, m));
    });
    refs.current.forEach((r) => {
      if (!r) return;
      r.instanceMatrix.needsUpdate = true;
      r.computeBoundingSphere();
    });
  }, [places, meshes]);

  return (
    <>
      {meshes.map((mesh, k) => (
        <instancedMesh
          key={k}
          ref={(r) => {
            refs.current[k] = r;
          }}
          args={[mesh.geometry, mesh.material, places.length]}
          castShadow={castShadow}
          receiveShadow
        />
      ))}
    </>
  );
}

export function Vegetation() {
  const oaks = useMemo(() => scatter(220, 42, 14, 240), []);
  const detailed = useMemo(() => scatter(120, 43, 14, 200), []);
  const pines = useMemo(() => scatter(160, 77, 16, 260), []);
  const pinesB = useMemo(() => scatter(120, 78, 18, 260), []);
  const bushes = useMemo(() => scatter(180, 91, 8, 60), []);
  const rocks = useMemo(() => scatter(60, 133, 10, 120), []);
  const grassTufts = useMemo(() => scatter(400, 555, 6, 25), []);

  return (
    <>
      <GLBInstances url="/models/tree_oak.glb" places={oaks} />
      <GLBInstances url="/models/tree_detailed.glb" places={detailed} />
      <GLBInstances url="/models/tree_pineTallA.glb" places={pines} />
      <GLBInstances url="/models/tree_pineDefaultA.glb" places={pinesB} />
      <GLBInstances url="/models/plant_bushLarge.glb" places={bushes} castShadow={false} />
      <GLBInstances url="/models/rock_largeA.glb" places={rocks} />
      <GLBInstances url="/models/grass_large.glb" places={grassTufts} castShadow={false} />
    </>
  );
}

useGLTF.preload("/models/tree_oak.glb");
useGLTF.preload("/models/tree_detailed.glb");
useGLTF.preload("/models/tree_pineTallA.glb");
useGLTF.preload("/models/tree_pineDefaultA.glb");
useGLTF.preload("/models/plant_bushLarge.glb");
useGLTF.preload("/models/rock_largeA.glb");
useGLTF.preload("/models/grass_large.glb");
