import { forwardRef, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { sim } from "@/lib/session";

const JERSEY = "#e8622c";
const SKIN = "#e0b08a";
const BIB = "#1f2a24";

function Wheel({ z, wheelRef }: { z: number; wheelRef: React.RefObject<THREE.Group | null> }) {
  return (
    <group position={[0, 0.34, z]}>
      <group ref={wheelRef}>
        <mesh rotation-y={Math.PI / 2} castShadow>
          <torusGeometry args={[0.33, 0.028, 8, 28]} />
          <meshStandardMaterial color="#181818" roughness={0.6} />
        </mesh>
        {[0, 1, 2].map((k) => (
          <mesh key={k} rotation-x={(k * Math.PI) / 3}>
            <boxGeometry args={[0.01, 0.64, 0.02]} />
            <meshStandardMaterial color="#c9c9c9" metalness={0.6} roughness={0.3} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function Tube({ a, b, r = 0.022, color = "#f4efe4" }: { a: [number, number, number]; b: [number, number, number]; r?: number; color?: string }) {
  const va = new THREE.Vector3(...a);
  const vb = new THREE.Vector3(...b);
  const mid = va.clone().add(vb).multiplyScalar(0.5);
  const len = va.distanceTo(vb);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
  return (
    <mesh position={mid} quaternion={q} castShadow>
      <cylinderGeometry args={[r, r, len, 8]} />
      <meshStandardMaterial color={color} roughness={0.4} metalness={0.2} />
    </mesh>
  );
}

export type RiderMotion = { crank: number; wheel: number };

export const Rider = forwardRef<THREE.Group, { color?: string; motion?: RiderMotion }>(function Rider({ color = JERSEY, motion }, ref) {
  const front = useRef<THREE.Group>(null);
  const back = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);

  useFrame(() => {
    const m = motion ?? sim;
    if (front.current) front.current.rotation.x = m.wheel;
    if (back.current) back.current.rotation.x = m.wheel;
    if (legL.current) legL.current.rotation.x = Math.sin(m.crank) * 0.55 - 0.2;
    if (legR.current) legR.current.rotation.x = Math.sin(m.crank + Math.PI) * 0.55 - 0.2;
  });

  // local +Z is forward
  return (
    <group ref={ref}>
      <Wheel z={0.5} wheelRef={front} />
      <Wheel z={-0.5} wheelRef={back} />
      <Tube a={[0, 0.34, -0.5]} b={[0, 0.38, -0.05]} color={color} />
      <Tube a={[0, 0.38, -0.05]} b={[0, 0.85, -0.18]} color={color} />
      <Tube a={[0, 0.85, -0.18]} b={[0, 0.92, 0.38]} color={color} />
      <Tube a={[0, 0.38, -0.05]} b={[0, 0.9, 0.38]} r={0.028} color={color} />
      <Tube a={[0, 0.34, 0.5]} b={[0, 0.98, 0.4]} />
      <Tube a={[-0.2, 1.0, 0.43]} b={[0.2, 1.0, 0.43]} r={0.016} color="#222" />
      {/* saddle */}
      <mesh position={[0, 0.9, -0.2]} castShadow>
        <boxGeometry args={[0.1, 0.04, 0.24]} />
        <meshStandardMaterial color="#222" />
      </mesh>
      {/* legs pivot at hip */}
      {[legL, legR].map((r, k) => (
        <group key={k} ref={r} position={[k ? 0.1 : -0.1, 0.95, -0.18]}>
          <mesh position={[0, -0.28, 0.08]} rotation-x={0.3} castShadow>
            <capsuleGeometry args={[0.065, 0.42, 4, 8]} />
            <meshStandardMaterial color={BIB} />
          </mesh>
          <mesh position={[0, -0.62, 0.05]} castShadow>
            <capsuleGeometry args={[0.05, 0.36, 4, 8]} />
            <meshStandardMaterial color={SKIN} />
          </mesh>
        </group>
      ))}
      {/* torso */}
      <mesh position={[0, 1.15, 0.05]} rotation-x={1.05} castShadow>
        <capsuleGeometry args={[0.16, 0.42, 6, 12]} />
        <meshStandardMaterial color={color} roughness={0.7} />
      </mesh>
      {/* arms */}
      {[-0.17, 0.17].map((x) => (
        <Tube key={x} a={[x, 1.3, 0.2]} b={[x * 1.1, 1.02, 0.43]} r={0.045} color={SKIN} />
      ))}
      {/* head + helmet */}
      <mesh position={[0, 1.42, 0.4]} castShadow>
        <sphereGeometry args={[0.11, 16, 12]} />
        <meshStandardMaterial color={SKIN} />
      </mesh>
      <mesh position={[0, 1.47, 0.38]} scale={[1, 0.8, 1.25]} castShadow>
        <sphereGeometry args={[0.13, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#f7f4ec" roughness={0.3} />
      </mesh>
    </group>
  );
});
