import { Canvas } from "@react-three/fiber";
import { Environment, Lightformer, Sky } from "@react-three/drei";
import { Road, Terrain, Trees } from "./Landscape";
import { SimLoop } from "./SimLoop";

export function World() {
  return (
    <Canvas shadows dpr={[1, 1.75]} camera={{ fov: 62, near: 0.1, far: 3000 }}>
      <color attach="background" args={["#bfe0f2"]} />
      <fog attach="fog" args={["#cfe6ef", 120, 1300]} />
      <Sky sunPosition={[400, 300, 200]} turbidity={4} rayleigh={1.2} mieCoefficient={0.004} />
      <hemisphereLight args={["#dff1ff", "#5e7d3a", 0.9]} />
      <Environment resolution={64}>
        <Lightformer intensity={1.6} position={[0, 10, 0]} scale={[20, 20, 1]} rotation-x={Math.PI / 2} />
        <Lightformer intensity={0.8} color="#ffe2b0" position={[-10, 2, 0]} rotation-y={Math.PI / 2} scale={[20, 3, 1]} />
      </Environment>
      <Terrain />
      <Road />
      <Trees />
      <SimLoop />
    </Canvas>
  );
}
