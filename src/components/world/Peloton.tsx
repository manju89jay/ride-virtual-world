import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { sampleAt } from "@/lib/course";
import { remoteRiders, useRiders } from "@/lib/riders";
import { Rider, type RiderMotion } from "./Rider";

const tmp = new THREE.Vector3();

/** Remote riders (virtual peloton now, multiplayer later), dead-reckoned between 4 Hz snapshots. */
export function Peloton() {
  const ids = useRiders((s) => s.list.map((r) => r.id).join(","));
  return (
    <>
      {ids
        .split(",")
        .filter(Boolean)
        .map((id, i) => (
          <BotRider key={id} id={id} lane={-1.8 + ((i % 3) - 1) * 0.9} />
        ))}
    </>
  );
}

function BotRider({ id, lane }: { id: string; lane: number }) {
  const g = useRef<THREE.Group>(null);
  const motion = useRef<RiderMotion>({ crank: 0, wheel: 0 });
  const rs = useRef<number | null>(null);
  const r0 = remoteRiders.get(id);

  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.25);
    const r = remoteRiders.get(id);
    if (!r || !g.current) return;
    const target = r.s + (r.v * (performance.now() - r.at)) / 1000;
    if (rs.current === null || Math.abs(target - rs.current) > 50) rs.current = target;
    else rs.current += r.v * dt + (target - rs.current) * (1 - Math.exp(-3 * dt));
    const p = sampleAt(rs.current);
    tmp.set(p.x - -p.tz * lane, p.y + 0.06, p.z - p.tx * lane);
    g.current.position.copy(tmp);
    g.current.lookAt(tmp.x + p.tx, tmp.y + p.grade, tmp.z + p.tz);
    motion.current.wheel += (r.v / 0.34) * dt;
    if (r.power > 0) motion.current.crank += (88 / 60) * Math.PI * 2 * dt;
  });

  return (
    <group ref={g}>
      <Rider color={r0?.color ?? "#2b6cb0"} motion={motion.current} />
      <Html position={[0, 2.1, 0]} center distanceFactor={14} zIndexRange={[5, 0]}>
        <div className="whitespace-nowrap rounded bg-background/85 px-1.5 py-0.5 text-xs font-bold text-foreground">{r0?.name ?? id}</div>
      </Html>
    </group>
  );
}
