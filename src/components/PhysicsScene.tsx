import { useEffect, useState, useRef, RefObject, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import { Box, useHelper } from '@react-three/drei';
import { useBox, usePlane, PublicApi } from '@react-three/cannon';
import * as THREE from 'three';

const CUBE_COUNT = 20;

// Create a physical floor
function Floor() {
  const [ref] = usePlane(() => ({
    rotation: [-Math.PI / 2, 0, 0],
    position: [0, -3, 0],
    type: 'static',
  }), useRef(null));

  return (
    <mesh ref={ref} receiveShadow>
      <planeGeometry args={[30, 30]} />
      <meshStandardMaterial color="#555" />
    </mesh>
  );
}

interface PhysicsCubeProps {
  position: [number, number, number];
  color: string;
  explodeFlag?: boolean;
}

// Create an interactive cube with physics
function PhysicsCube({ position, color, explodeFlag }: PhysicsCubeProps) {
  const [ref, api] = useBox(() => ({
    mass: 1,
    position,
    args: [1, 1, 1],
    rotation: [Math.random(), Math.random(), Math.random()],
    linearDamping: 0.1,
    angularDamping: 0.1,
  }), useRef(null));

  // Apply random force on click
  const handleClick = () => {
    applyRandomForce(api);
  };

  // Apply explosion force when explodeFlag changes
  useEffect(() => {
    if (explodeFlag) {
      applyRandomForce(api, 10); // stronger force for explosion
    }
  }, [explodeFlag, api]);

  // Helper function to apply forces
  const applyRandomForce = (api: PublicApi, forceMagnitude = 5) => {
    const impulse = [
      (Math.random() - 0.5) * forceMagnitude,
      Math.random() * forceMagnitude,
      (Math.random() - 0.5) * forceMagnitude
    ];

    api.applyImpulse(impulse, [0, 0, 0]);
    api.angularVelocity.set(
      Math.random() - 0.5,
      Math.random() - 0.5,
      Math.random() - 0.5
    );
  };

  return (
    <Box
      ref={ref}
      castShadow
      receiveShadow
      onClick={handleClick}
      args={[1, 1, 1]}
    >
      <meshStandardMaterial color={color} roughness={0.5} metalness={0.5} />
    </Box>
  );
}

interface CubeData {
  id: number;
  position: [number, number, number];
  color: string;
}

interface PhysicsSceneProps {
  resetFlag?: boolean;
  explodeFlag?: boolean;
}

export default function PhysicsScene({ resetFlag = false, explodeFlag = false }: PhysicsSceneProps) {
  const [cubes, setCubes] = useState<CubeData[]>([]);
  const prevExplodeFlag = useRef(explodeFlag);

  // Generate random positions for initial cube placement
  useEffect(() => {
    const newCubes = Array.from({ length: CUBE_COUNT }).map((_, i) => ({
      id: i,
      position: [
        (Math.random() - 0.5) * 10, // x
        Math.random() * 10 + 1,     // y - start from above
        (Math.random() - 0.5) * 10  // z
      ] as [number, number, number],
      color: new THREE.Color().setHSL(Math.random(), 0.7, 0.5).getHexString()
    }));

    setCubes(newCubes);
  }, [resetFlag]); // Re-run when resetFlag changes

  // Add some ambient motion
  useFrame(({ clock }) => {
    // Add gentle forces over time to keep things moving
    if (clock.elapsedTime % 5 < 0.1) {
      // Every 5 seconds, apply a small random force to add motion
      const randomCubeIndex = Math.floor(Math.random() * CUBE_COUNT);
      const targetCube = cubes[randomCubeIndex];
      if (targetCube) {
        // Nothing to actually do here as the real physics is handled by cannon
      }
    }
  });

  return (
    <>
      <Floor />
      {cubes.map((cube) => (
        <PhysicsCube
          key={`${cube.id}-${resetFlag}`}
          position={cube.position}
          color={`#${cube.color}`}
          explodeFlag={explodeFlag}
        />
      ))}
    </>
  );
}
