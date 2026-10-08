import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { sampleAt } from "@/lib/course";
import { sim } from "@/lib/session";
import { useDevices, useRide, useSettings } from "@/lib/store";
import { setSimGrade, setTargetPower, trainerHasControl } from "@/lib/ble";
import { targetAt } from "@/lib/workouts";
import { Rider } from "./Rider";

const G = 9.81;
const CRR = 0.004;
const CDA = 0.32;
const RHO = 1.225;
const LANE = 1.8;

const tmpPos = new THREE.Vector3();
const tmpLook = new THREE.Vector3();

export function SimLoop() {
  const rider = useRef<THREE.Group>(null);
  const sun = useRef<THREE.DirectionalLight>(null);
  const camera = useThree((s) => s.camera);
  const camInit = useRef(false);

  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.05);
    const dev = useDevices.getState();
    const st = useSettings.getState();
    const usingTrainer = !st.simMode && dev.trainer.status === "connected";

    const wk = sim.workout ? targetAt(sim.workout, sim.elapsed) : null;
    const target = wk ? wk.frac * st.ftp : null;

    let power = 0;
    let cadence = 0;
    if (!sim.paused) {
      if (usingTrainer) {
        power = performance.now() - dev.lastPowerAt < 3000 ? dev.power : 0;
        cadence = dev.cadence;
      } else {
        if (target !== null) sim.simPower += (target - sim.simPower) * (1 - Math.exp(-2 * dt));
        power = sim.simPower;
        cadence = power > 0 ? 88 : 0;
      }
    }

    const here = sampleAt(sim.s);
    const mass = st.weight + st.bikeWeight;
    if (!sim.paused) {
      const theta = Math.atan(here.grade);
      const drive = Math.min(power / Math.max(sim.v, 0.5), 600);
      const resist = mass * G * Math.sin(theta) + CRR * mass * G * Math.cos(theta) + 0.5 * RHO * CDA * sim.v * sim.v;
      sim.v = Math.max(0, sim.v + ((drive - resist) / mass) * dt);
      const ds = sim.v * dt;
      sim.s += ds;
      sim.dist += ds;
      sim.elapsed += dt;
      const h = sampleAt(sim.s).y;
      if (sim.lastH && h > sim.lastH) sim.elevGain += h - sim.lastH;
      sim.lastH = h;
      sim.crank += (cadence / 60) * Math.PI * 2 * dt;
      sim.wheel += (sim.v / 0.34) * dt;

      sim.secAcc += dt;
      if (sim.secAcc >= 1) {
        sim.secAcc -= 1;
        const hr = dev.heartRate;
        sim.samples.p.push(Math.round(power));
        sim.samples.h.push(hr);
        sim.samples.c.push(Math.round(cadence));
        sim.samples.v.push(+(sim.v * 3.6).toFixed(1));
        sim.samples.e.push(+h.toFixed(1));
        sim.powerHist.push(power);
        if (sim.powerHist.length > 3) sim.powerHist.shift();
        if (usingTrainer && trainerHasControl()) {
          if (target !== null) setTargetPower(target);
          else setSimGrade(here.grade * 100 * st.difficulty + (sim.gear - 12) * 0.6);
        }
      }
    }

    // Rider + camera
    const p = sampleAt(sim.s);
    const nx = -p.tz;
    const nz = p.tx;
    tmpPos.set(p.x - nx * LANE, p.y + 0.06, p.z - nz * LANE);
    if (rider.current) {
      rider.current.position.copy(tmpPos);
      tmpLook.set(tmpPos.x + p.tx, tmpPos.y + p.grade, tmpPos.z + p.tz);
      rider.current.lookAt(tmpLook);
    }
    const camTarget = new THREE.Vector3(tmpPos.x - p.tx * 6.5, tmpPos.y + 2.6, tmpPos.z - p.tz * 6.5);
    if (!camInit.current) {
      camera.position.copy(camTarget);
      camInit.current = true;
    }
    camera.position.lerp(camTarget, 1 - Math.exp(-4 * dt));
    camera.lookAt(tmpPos.x + p.tx * 8, tmpPos.y + 1.2, tmpPos.z + p.tz * 8);
    if (sun.current) {
      sun.current.position.set(tmpPos.x + 40, tmpPos.y + 70, tmpPos.z + 25);
      sun.current.target.position.copy(tmpPos);
      sun.current.target.updateMatrixWorld();
    }

    sim.hudAcc += dt;
    if (sim.hudAcc > 0.25) {
      sim.hudAcc = 0;
      const p3 = sim.powerHist.length ? sim.powerHist.reduce((a, b) => a + b, 0) / sim.powerHist.length : 0;
      useRide.setState({
        elapsed: sim.elapsed,
        distance: sim.dist,
        speed: sim.v * 3.6,
        power: Math.round(power),
        power3s: Math.round(p3),
        grade: here.grade * 100,
        elevation: here.y,
        elevGain: sim.elevGain,
        gear: sim.gear,
        s: sim.s,
        paused: sim.paused,
        target: target !== null ? Math.round(target) : null,
        segIndex: wk?.segIndex ?? 0,
        segRemaining: wk?.segRemaining ?? 0,
        workoutDone: !!sim.workout && !wk,
      });
    }
  });

  return (
    <>
      <directionalLight
        ref={sun}
        intensity={2.4}
        color="#fff1d6"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
        shadow-camera-far={200}
        shadow-bias={-0.0005}
      />
      <Rider ref={rider} />
    </>
  );
}
