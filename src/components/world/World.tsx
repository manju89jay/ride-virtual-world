import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment, Lightformer, Sky } from "@react-three/drei";
import * as THREE from "three";
import { Road, Terrain, Vegetation } from "./Landscape";
import { SimLoop } from "./SimLoop";
import { Peloton } from "./Peloton";

export function World() {
  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      camera={{ fov: 62, near: 0.1, far: 3000 }}
      gl={{ toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
    >
      <color attach="background" args={["#bfe0f2"]} />
      <fog attach="fog" args={["#cfe6ef", 150, 1400]} />
      <Sky sunPosition={[400, 260, 200]} turbidity={5} rayleigh={1.4} mieCoefficient={0.005} />
      <hemisphereLight args={["#dff1ff", "#5e7d3a", 0.7]} />
      <directionalLight
        position={[400, 260, 200]}
        intensity={2.2}
        color="#fff2dd"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={50}
        shadow-camera-far={1200}
        shadow-camera-left={-120}
        shadow-camera-right={120}
        shadow-camera-top={120}
        shadow-camera-bottom={-120}
        shadow-bias={-0.0004}
      />
      <Environment resolution={64}>
        <Lightformer intensity={1.6} position={[0, 10, 0]} scale={[20, 20, 1]} rotation-x={Math.PI / 2} />
        <Lightformer intensity={0.8} color="#ffe2b0" position={[-10, 2, 0]} rotation-y={Math.PI / 2} scale={[20, 3, 1]} />
      </Environment>
      <Terrain />
      <Road />
      <Suspense fallback={null}>
        <Vegetation />
      </Suspense>
      <SimLoop />
      <Peloton />
    </Canvas>
  );
}
