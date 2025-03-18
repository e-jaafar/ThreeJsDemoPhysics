import { useState } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Box } from '@react-three/drei';
import { Physics, usePlane, useBox } from '@react-three/cannon';

function PhysicsBox({ position, color }) {
  const [ref, api] = useBox(() => ({
    mass: 1,
    position,
    args: [1, 1, 1],
  }));

  const handleClick = () => {
    const force = 5;
    const impulse = [
      (Math.random() - 0.5) * force,
      Math.random() * force,
      (Math.random() - 0.5) * force
    ];

    api.applyImpulse(impulse, [0, 0, 0]);
  };

  return (
    <Box
      ref={ref}
      args={[1, 1, 1]}
      onClick={handleClick}
    >
      <meshStandardMaterial color={color} />
    </Box>
  );
}

function Floor() {
  const [ref] = usePlane(() => ({
    rotation: [-Math.PI / 2, 0, 0],
    position: [0, -3, 0],
    type: 'static',
  }));

  return (
    <mesh ref={ref}>
      <planeGeometry args={[30, 30]} />
      <meshStandardMaterial color="#555" />
    </mesh>
  );
}

function PhysicsScene() {
  const boxes = Array.from({ length: 20 }).map((_, i) => ({
    id: i,
    position: [
      (Math.random() - 0.5) * 10,
      Math.random() * 10 + 1,
      (Math.random() - 0.5) * 10
    ],
    color: new THREE.Color().setHSL(Math.random(), 0.7, 0.5).getHexString()
  }));

  return (
    <>
      <Floor />
      {boxes.map((box) => (
        <PhysicsBox
          key={box.id}
          position={box.position}
          color={`#${box.color}`}
        />
      ))}
    </>
  );
}

function App() {
  return (
    <div className="w-full h-screen bg-black">
      <div className="absolute top-0 left-0 z-10 p-4 text-white bg-black bg-opacity-50 rounded m-4">
        <h1 className="text-lg font-bold mb-2">Physics Cube Demo</h1>
        <p className="mb-2">Click on cubes to apply forces</p>
      </div>

      <Canvas camera={{ position: [0, 5, 15], fov: 50 }}>
        <color attach="background" args={['#111']} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 10]} intensity={1} />

        <Physics gravity={[0, -9.8, 0]}>
          <PhysicsScene />
        </Physics>

        <OrbitControls />
      </Canvas>
    </div>
  );
}

export default App;
