import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
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
    const grassA = new THREE.Color("#6fa64a");
    const grassB = new THREE.Color("#8fbf55");
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
  return (
    <mesh geometry={geo} receiveShadow>
      <meshStandardMaterial vertexColors roughness={0.95} />
    </mesh>
  );
}

function roadTexture() {
  const cv = document.createElement("canvas");
  cv.width = 256;
  cv.height = 512;
  const ctx = cv.getContext("2d")!;
  ctx.fillStyle = "#5b5d60";
  ctx.fillRect(0, 0, 256, 512);
  const rnd = mulberry32(7);
  for (let i = 0; i < 6000; i++) {
    const v = 70 + rnd() * 50;
    ctx.fillStyle = `rgb(${v},${v},${v + 3})`;
    ctx.fillRect(rnd() * 256, rnd() * 512, 2, 2);
  }
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
      <meshStandardMaterial map={tex} roughness={0.85} side={THREE.DoubleSide} />
    </mesh>
  );
}

export function Trees() {
  const trunks = useRef<THREE.InstancedMesh>(null);
  const pines = useRef<THREE.InstancedMesh>(null);
  const oaks = useRef<THREE.InstancedMesh>(null);
  const COUNT = 700;
  const data = useMemo(() => {
    const c = getCourse();
    const rnd = mulberry32(42);
    const out: { x: number; y: number; z: number; s: number; pine: boolean; hue: number }[] = [];
    let guard = 0;
    while (out.length < COUNT && guard++ < 5000) {
      const i = Math.floor(rnd() * c.n);
      const dx = c.x[i + 1]! - c.x[i]!;
      const dz = c.z[i + 1]! - c.z[i]!;
      const l = Math.hypot(dx, dz) || 1;
      const side = rnd() < 0.5 ? -1 : 1;
      const off = 14 + rnd() ** 2 * 260;
      const x = c.x[i]! + (-dz / l) * off * side;
      const z = c.z[i]! + (dx / l) * off * side;
      const { h, d } = terrainHeight(x, z);
      if (d < 12) continue;
      out.push({ x, y: h, z, s: 0.7 + rnd() * 0.8, pine: rnd() < 0.35, hue: rnd() });
    }
    return out;
  }, []);

  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const col = new THREE.Color();
    let pi = 0;
    let oi = 0;
    data.forEach((t, i) => {
      m.compose(new THREE.Vector3(t.x, t.y + 1.5 * t.s, t.z), q, new THREE.Vector3(t.s, t.s, t.s));
      trunks.current!.setMatrixAt(i, m);
      if (t.pine) {
        m.compose(new THREE.Vector3(t.x, t.y + 5.5 * t.s, t.z), q, new THREE.Vector3(t.s, t.s * 1.2, t.s));
        pines.current!.setMatrixAt(pi, m);
        pines.current!.setColorAt(pi++, col.setHSL(0.33 + t.hue * 0.04, 0.45, 0.24 + t.hue * 0.08));
      } else {
        m.compose(new THREE.Vector3(t.x, t.y + 5 * t.s, t.z), q, new THREE.Vector3(t.s * 1.1, t.s, t.s * 1.1));
        oaks.current!.setMatrixAt(oi, m);
        oaks.current!.setColorAt(oi++, col.setHSL(0.24 + t.hue * 0.07, 0.5, 0.32 + t.hue * 0.1));
      }
    });
    pines.current!.count = pi;
    oaks.current!.count = oi;
    [trunks, pines, oaks].forEach((r) => {
      r.current!.instanceMatrix.needsUpdate = true;
      if (r.current!.instanceColor) r.current!.instanceColor.needsUpdate = true;
      r.current!.computeBoundingSphere();
    });
  }, [data]);

  return (
    <>
      <instancedMesh ref={trunks} args={[undefined, undefined, COUNT]} castShadow>
        <cylinderGeometry args={[0.18, 0.28, 3, 6]} />
        <meshStandardMaterial color="#6b4a2f" roughness={1} />
      </instancedMesh>
      <instancedMesh ref={pines} args={[undefined, undefined, COUNT]} castShadow>
        <coneGeometry args={[2, 7, 7]} />
        <meshStandardMaterial roughness={0.9} flatShading />
      </instancedMesh>
      <instancedMesh ref={oaks} args={[undefined, undefined, COUNT]} castShadow>
        <icosahedronGeometry args={[2.8, 0]} />
        <meshStandardMaterial roughness={0.9} flatShading />
      </instancedMesh>
    </>
  );
}
