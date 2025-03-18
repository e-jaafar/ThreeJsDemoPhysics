import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'

import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Physics, usePlane, useBox } from '@react-three/cannon'
import * as THREE from 'three'

interface BoxProps {
  position: [number, number, number];
  color: string;
}

function Box({ position, color }: BoxProps) {
  const [ref, api] = useBox(() => ({
    mass: 1,
    position,
    rotation: [0, 0, 0]
  }))

  const handleClick = () => {
    api.velocity.set(0, 5, 0)
    api.angularVelocity.set(Math.random(), Math.random(), Math.random())
  }

  return (
    <mesh ref={ref} onClick={handleClick}>
      <boxGeometry />
      <meshLambertMaterial color={color} />
    </mesh>
  )
}

function Plane() {
  const [ref] = usePlane(() => ({
    rotation: [-Math.PI / 2, 0, 0],
    position: [0, -5, 0]
  }))

  return (
    <mesh ref={ref} receiveShadow>
      <planeGeometry args={[100, 100]} />
      <meshLambertMaterial color="#666" />
    </mesh>
  )
}

interface BoxData {
  id: number;
  position: [number, number, number];
  color: string;
}

function PhysicsDemo() {
  // Create 20 boxes with random positions and colors
  const boxes: BoxData[] = Array.from({ length: 20 }).map((_, i) => {
    const color = new THREE.Color();
    color.setHSL(Math.random(), 0.7, 0.5);

    return {
      id: i,
      position: [
        (Math.random() - 0.5) * 10,  // x
        10 + i,                      // y - stacked
        (Math.random() - 0.5) * 10   // z
      ] as [number, number, number],
      color: `#${color.getHexString()}`
    };
  });

  return (
    <Canvas camera={{ position: [0, 5, 15] }}>
      <color attach="background" args={['#111']} />
      <ambientLight intensity={0.3} />
      <directionalLight position={[10, 10, 10]} intensity={1} />
      <Physics>
        <Plane />
        {boxes.map((box) => (
          <Box key={box.id} position={box.position} color={box.color} />
        ))}
      </Physics>
      <OrbitControls />
    </Canvas>
  )
}

function App() {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <div className="instructions">
        <h1>Physics Cubes Demo</h1>
        <p>Click on cubes to make them jump!</p>
      </div>
      <PhysicsDemo />
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
