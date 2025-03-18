import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import * as THREE from 'three';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { Physics, useBox, usePlane, useSphere } from '@react-three/cannon';
import { OrbitControls } from '@react-three/drei';
import { create } from 'zustand';
import './index.css';

// Create a store to track which object is being dragged
const useStore = create((set) => ({
  // Tracks if we're currently dragging an object
  isDragging: false,
  setDragging: (isDragging) => set({ isDragging }),
}));

// Component to handle camera controls
function CameraControls() {
  const isDragging = useStore((state) => state.isDragging);
  const controlsRef = useRef();

  // Update controls when dragging state changes
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.enabled = !isDragging;
    }
  }, [isDragging]);

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.05}
      minDistance={5}
      maxDistance={25}
    />
  );
}

// Create a modified useBox hook that supports dragging with slingshot
function DraggableBox({ position, color, size = 1, exploding = false }) {
  const setDragging = useStore((state) => state.setDragging);
  const { camera, raycaster, mouse, viewport, clock } = useThree();
  const [ref, api] = useBox(() => ({
    args: [size, size, size],
    mass: 1,
    position,
    linearDamping: 0.1,
    angularDamping: 0.1,
  }));

  // For tracking drag state and velocity
  const [isDragging, setIsDragging] = useState(false);
  const dragPlaneRef = useRef(new THREE.Plane());
  const dragPointRef = useRef(new THREE.Vector3());
  const objPositionRef = useRef(new THREE.Vector3());
  const dragStartPointRef = useRef(new THREE.Vector3());
  const lastPositionsRef = useRef([]);
  const lastTimesRef = useRef([]);
  const positionHistoryMaxLength = 5; // Number of positions to track for velocity calculation

  // Handle mouse movement while dragging
  const onPointerMove = (event) => {
    if (isDragging) {
      // Get normalized mouse position
      const x = (event.clientX / window.innerWidth) * 2 - 1;
      const y = -(event.clientY / window.innerHeight) * 2 + 1;

      // Create a raycaster from the camera through the mouse position
      raycaster.setFromCamera({ x, y }, camera);

      // Calculate the intersection point on our drag plane
      raycaster.ray.intersectPlane(dragPlaneRef.current, dragPointRef.current);

      // Calculate how far the mouse has moved from the start of drag
      const dragDelta = new THREE.Vector3().subVectors(
        dragPointRef.current,
        dragStartPointRef.current
      );

      // Apply the movement to our original position
      const newPosition = new THREE.Vector3()
        .addVectors(objPositionRef.current, dragDelta);

      // Update the object's position
      api.position.set(newPosition.x, newPosition.y, newPosition.z);

      // Store position history for velocity calculation
      const currentTime = clock.getElapsedTime();
      lastPositionsRef.current.push(newPosition.clone());
      lastTimesRef.current.push(currentTime);

      // Keep arrays at maxLength
      if (lastPositionsRef.current.length > positionHistoryMaxLength) {
        lastPositionsRef.current.shift();
        lastTimesRef.current.shift();
      }
    }
  };

  // Calculate velocity based on recent position history
  const calculateReleaseVelocity = () => {
    if (lastPositionsRef.current.length < 2) return [0, 0, 0];

    // Get the most recent positions and times
    const positions = lastPositionsRef.current;
    const times = lastTimesRef.current;

    // Use the last two positions for velocity calculation
    const endPos = positions[positions.length - 1];
    const startPos = positions[0];
    const endTime = times[times.length - 1];
    const startTime = times[0];
    const timeDiff = endTime - startTime;

    if (timeDiff <= 0) return [0, 0, 0];

    // Calculate velocity vector
    const velocity = endPos.clone().sub(startPos).divideScalar(timeDiff);

    // Apply a multiplier for more dramatic effect
    const velocityMultiplier = 5;
    velocity.multiplyScalar(velocityMultiplier);

    // Cap maximum velocity
    const maxVelocity = 20;
    if (velocity.length() > maxVelocity) {
      velocity.normalize().multiplyScalar(maxVelocity);
    }

    return [velocity.x, velocity.y, velocity.z];
  };

  // Start dragging on pointer down
  const onPointerDown = (event) => {
    // Prevent event propagation to avoid conflicts
    event.stopPropagation();

    // Get object's position
    if (ref.current) {
      ref.current.getWorldPosition(objPositionRef.current);

      // Get normalized mouse position
      const x = (event.clientX / window.innerWidth) * 2 - 1;
      const y = -(event.clientY / window.innerHeight) * 2 + 1;

      // Create a raycaster from the camera through the mouse position
      raycaster.setFromCamera({ x, y }, camera);

      // Set up a drag plane perpendicular to the camera
      dragPlaneRef.current.setFromNormalAndCoplanarPoint(
        camera.getWorldDirection(new THREE.Vector3()).negate(),
        objPositionRef.current
      );

      // Calculate the starting point for our drag
      raycaster.ray.intersectPlane(dragPlaneRef.current, dragStartPointRef.current);

      // Store this point also as the current drag point
      dragPointRef.current.copy(dragStartPointRef.current);

      // Reset position history
      lastPositionsRef.current = [objPositionRef.current.clone()];
      lastTimesRef.current = [clock.getElapsedTime()];

      // Start dragging
      setIsDragging(true);
      setDragging(true);
      document.body.style.cursor = 'grabbing';

      // Capture events
      event.target.setPointerCapture(event.pointerId);

      // We don't reset velocity here, allowing the object to keep moving
      // while being grabbed, which keeps the simulation running
    }
  };

  // Apply movement directly via useFrame to allow physics to keep simulating
  useFrame(() => {
    if (isDragging && dragPointRef.current && ref.current) {
      // Only set position, don't disturb velocity while dragging
      api.position.copy(dragPointRef.current);
    }
  });

  // Stop dragging on pointer up
  const onPointerUp = (event) => {
    if (isDragging) {
      setIsDragging(false);
      setDragging(false);
      document.body.style.cursor = '';
      event.target.releasePointerCapture(event.pointerId);

      // Calculate and apply velocity for slingshot effect
      const releaseVelocity = calculateReleaseVelocity();
      api.velocity.set(...releaseVelocity);

      // Add some random rotation too
      const randomRotation = Math.random() * 2 - 1;
      api.angularVelocity.set(randomRotation, randomRotation, randomRotation);
    }
  };

  // Apply explosion force
  useEffect(() => {
    if (exploding && !isDragging) {
      const power = 15;
      const x = (Math.random() - 0.5) * power;
      const y = Math.random() * power;
      const z = (Math.random() - 0.5) * power;

      api.velocity.set(x, y, z);
      api.angularVelocity.set(
        Math.random() * 2 - 1,
        Math.random() * 2 - 1,
        Math.random() * 2 - 1
      );
    }
  }, [exploding, api, isDragging]);

  // Subtle rotation animation when not being dragged
  useFrame((state) => {
    if (ref.current && !isDragging) {
      ref.current.rotation.x = Math.sin(state.clock.getElapsedTime() * 0.2) * 0.1;
      ref.current.rotation.z = Math.sin(state.clock.getElapsedTime() * 0.3) * 0.1;
    }
  });

  return (
    <mesh
      ref={ref}
      castShadow
      receiveShadow
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerMove={onPointerMove}
      onPointerOver={() => { document.body.style.cursor = 'grab'; }}
      onPointerOut={() => { if (!isDragging) document.body.style.cursor = ''; }}
    >
      <boxGeometry args={[size, size, size]} />
      <meshStandardMaterial
        color={color}
        roughness={0.4}
        metalness={0.3}
      />
    </mesh>
  );
}

// Create a modified useSphere hook that supports dragging with slingshot
function DraggableBall({ position, color, exploding = false }) {
  const setDragging = useStore((state) => state.setDragging);
  const { camera, raycaster, mouse, viewport, clock } = useThree();
  const [ref, api] = useSphere(() => ({
    args: [0.7],
    mass: 0.5,
    position,
    linearDamping: 0.1,
    angularDamping: 0.1,
  }));

  // For tracking drag state and velocity
  const [isDragging, setIsDragging] = useState(false);
  const dragPlaneRef = useRef(new THREE.Plane());
  const dragPointRef = useRef(new THREE.Vector3());
  const objPositionRef = useRef(new THREE.Vector3());
  const dragStartPointRef = useRef(new THREE.Vector3());
  const lastPositionsRef = useRef([]);
  const lastTimesRef = useRef([]);
  const positionHistoryMaxLength = 5; // Number of positions to track for velocity calculation

  // Handle mouse movement while dragging
  const onPointerMove = (event) => {
    if (isDragging) {
      // Get normalized mouse position
      const x = (event.clientX / window.innerWidth) * 2 - 1;
      const y = -(event.clientY / window.innerHeight) * 2 + 1;

      // Create a raycaster from the camera through the mouse position
      raycaster.setFromCamera({ x, y }, camera);

      // Calculate the intersection point on our drag plane
      raycaster.ray.intersectPlane(dragPlaneRef.current, dragPointRef.current);

      // Calculate how far the mouse has moved from the start of drag
      const dragDelta = new THREE.Vector3().subVectors(
        dragPointRef.current,
        dragStartPointRef.current
      );

      // Apply the movement to our original position
      const newPosition = new THREE.Vector3()
        .addVectors(objPositionRef.current, dragDelta);

      // Update the object's position
      api.position.set(newPosition.x, newPosition.y, newPosition.z);

      // Store position history for velocity calculation
      const currentTime = clock.getElapsedTime();
      lastPositionsRef.current.push(newPosition.clone());
      lastTimesRef.current.push(currentTime);

      // Keep arrays at maxLength
      if (lastPositionsRef.current.length > positionHistoryMaxLength) {
        lastPositionsRef.current.shift();
        lastTimesRef.current.shift();
      }
    }
  };

  // Calculate velocity based on recent position history
  const calculateReleaseVelocity = () => {
    if (lastPositionsRef.current.length < 2) return [0, 0, 0];

    // Get the most recent positions and times
    const positions = lastPositionsRef.current;
    const times = lastTimesRef.current;

    // Use the last two positions for velocity calculation
    const endPos = positions[positions.length - 1];
    const startPos = positions[0];
    const endTime = times[times.length - 1];
    const startTime = times[0];
    const timeDiff = endTime - startTime;

    if (timeDiff <= 0) return [0, 0, 0];

    // Calculate velocity vector
    const velocity = endPos.clone().sub(startPos).divideScalar(timeDiff);

    // Apply a multiplier for more dramatic effect
    const velocityMultiplier = 7; // Higher multiplier for balls to make them bouncier
    velocity.multiplyScalar(velocityMultiplier);

    // Cap maximum velocity
    const maxVelocity = 25;
    if (velocity.length() > maxVelocity) {
      velocity.normalize().multiplyScalar(maxVelocity);
    }

    return [velocity.x, velocity.y, velocity.z];
  };

  // Start dragging on pointer down
  const onPointerDown = (event) => {
    // Prevent event propagation to avoid conflicts
    event.stopPropagation();

    // Get object's position
    if (ref.current) {
      ref.current.getWorldPosition(objPositionRef.current);

      // Get normalized mouse position
      const x = (event.clientX / window.innerWidth) * 2 - 1;
      const y = -(event.clientY / window.innerHeight) * 2 + 1;

      // Create a raycaster from the camera through the mouse position
      raycaster.setFromCamera({ x, y }, camera);

      // Set up a drag plane perpendicular to the camera
      dragPlaneRef.current.setFromNormalAndCoplanarPoint(
        camera.getWorldDirection(new THREE.Vector3()).negate(),
        objPositionRef.current
      );

      // Calculate the starting point for our drag
      raycaster.ray.intersectPlane(dragPlaneRef.current, dragStartPointRef.current);

      // Store this point also as the current drag point
      dragPointRef.current.copy(dragStartPointRef.current);

      // Reset position history
      lastPositionsRef.current = [objPositionRef.current.clone()];
      lastTimesRef.current = [clock.getElapsedTime()];

      // Start dragging
      setIsDragging(true);
      setDragging(true);
      document.body.style.cursor = 'grabbing';

      // Capture events
      event.target.setPointerCapture(event.pointerId);

      // We don't reset velocity here, allowing the ball to keep moving
      // while being grabbed, which keeps the simulation running
    }
  };

  // Apply movement directly via useFrame to allow physics to keep simulating
  useFrame(() => {
    if (isDragging && dragPointRef.current && ref.current) {
      // Only set position, don't disturb velocity while dragging
      api.position.copy(dragPointRef.current);
    }
  });

  // Stop dragging on pointer up
  const onPointerUp = (event) => {
    if (isDragging) {
      setIsDragging(false);
      setDragging(false);
      document.body.style.cursor = '';
      event.target.releasePointerCapture(event.pointerId);

      // Calculate and apply velocity for slingshot effect
      const releaseVelocity = calculateReleaseVelocity();
      api.velocity.set(...releaseVelocity);

      // Add a random spin for more dynamic movement
      const randomSpin = Math.random() * 3;
      api.angularVelocity.set(randomSpin, randomSpin, randomSpin);
    }
  };

  // Apply explosion force
  useEffect(() => {
    if (exploding && !isDragging) {
      const power = 15;
      const x = (Math.random() - 0.5) * power;
      const y = Math.random() * power;
      const z = (Math.random() - 0.5) * power;

      api.velocity.set(x, y, z);
      api.angularVelocity.set(
        Math.random() * 2 - 1,
        Math.random() * 2 - 1,
        Math.random() * 2 - 1
      );
    }
  }, [exploding, api, isDragging]);

  return (
    <mesh
      ref={ref}
      castShadow
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerMove={onPointerMove}
      onPointerOver={() => { document.body.style.cursor = 'grab'; }}
      onPointerOut={() => { if (!isDragging) document.body.style.cursor = ''; }}
    >
      <sphereGeometry args={[0.7, 32, 32]} />
      <meshStandardMaterial
        color={color}
        roughness={0.2}
        metalness={0.5}
      />
    </mesh>
  );
}

// Create boundary walls to keep objects inside
function BoundaryWalls({ size = 20 }) {
  const halfSize = size / 2;

  // Floor
  const [floorRef] = usePlane(() => ({
    rotation: [-Math.PI / 2, 0, 0],
    position: [0, -5, 0],
    type: 'Static',
  }));

  // Ceiling
  const [ceilingRef] = usePlane(() => ({
    rotation: [Math.PI / 2, 0, 0],
    position: [0, halfSize, 0],
    type: 'Static',
  }));

  // Back wall
  const [backWallRef] = usePlane(() => ({
    rotation: [0, 0, 0],
    position: [0, 0, -halfSize],
    type: 'Static',
  }));

  // Front wall
  const [frontWallRef] = usePlane(() => ({
    rotation: [0, Math.PI, 0],
    position: [0, 0, halfSize],
    type: 'Static',
  }));

  // Left wall
  const [leftWallRef] = usePlane(() => ({
    rotation: [0, Math.PI / 2, 0],
    position: [-halfSize, 0, 0],
    type: 'Static',
  }));

  // Right wall
  const [rightWallRef] = usePlane(() => ({
    rotation: [0, -Math.PI / 2, 0],
    position: [halfSize, 0, 0],
    type: 'Static',
  }));

  return (
    <>
      <mesh ref={floorRef} receiveShadow>
        <planeGeometry args={[size, size]} />
        <meshStandardMaterial color="#555" />
      </mesh>

      <mesh ref={ceilingRef} visible={false}>
        <planeGeometry args={[size, size]} />
        <meshStandardMaterial color="#333" transparent opacity={0.2} />
      </mesh>

      <mesh ref={backWallRef} receiveShadow>
        <planeGeometry args={[size, size]} />
        <meshStandardMaterial color="#333" transparent opacity={0.2} />
      </mesh>

      <mesh ref={frontWallRef} visible={false}>
        <planeGeometry args={[size, size]} />
        <meshStandardMaterial color="#333" transparent opacity={0.2} />
      </mesh>

      <mesh ref={leftWallRef} receiveShadow>
        <planeGeometry args={[size, size]} />
        <meshStandardMaterial color="#333" transparent opacity={0.2} />
      </mesh>

      <mesh ref={rightWallRef} receiveShadow>
        <planeGeometry args={[size, size]} />
        <meshStandardMaterial color="#333" transparent opacity={0.2} />
      </mesh>

      {/* Wireframe box to visualize the boundary */}
      <mesh position={[0, halfSize/2 - 5/2, 0]}>
        <boxGeometry args={[size, size, size]} />
        <meshBasicMaterial color="#ffffff" wireframe={true} opacity={0.1} transparent />
      </mesh>
    </>
  );
}

function Scene() {
  const [exploding, setExploding] = useState(false);
  const [gravity, setGravity] = useState(true);
  const [items, setItems] = useState([]);
  const BOUNDARY_SIZE = 20;

  // Create initial items
  useEffect(() => {
    const newItems = [];

    // Create 15 cubes
    for (let i = 0; i < 15; i++) {
      // Keep initial positions within the boundary
      const maxCoord = BOUNDARY_SIZE / 2 - 2; // 2 units buffer from walls
      const x = (Math.random() - 0.5) * maxCoord;
      const y = Math.random() * 8;  // Start items above the floor
      const z = (Math.random() - 0.5) * maxCoord;

      const h = i / 15;
      const s = 0.8;
      const l = 0.5;
      const color = new THREE.Color().setHSL(h, s, l);

      newItems.push({
        id: 'cube-' + i,
        type: 'box',
        position: [x, y, z],
        color: '#' + color.getHexString(),
        size: Math.random() * 0.5 + 0.7
      });
    }

    // Create 5 balls
    for (let i = 0; i < 5; i++) {
      const maxCoord = BOUNDARY_SIZE / 2 - 2; // 2 units buffer from walls
      const x = (Math.random() - 0.5) * maxCoord;
      const y = Math.random() * 8 + 2;  // Start items above the floor
      const z = (Math.random() - 0.5) * maxCoord;

      newItems.push({
        id: 'ball-' + i,
        type: 'ball',
        position: [x, y, z],
        color: ['red', 'blue', 'green', 'purple', 'orange'][i]
      });
    }

    setItems(newItems);

    // Add info about controls
    const helpText = document.createElement('div');
    helpText.className = 'drag-help';
    helpText.innerHTML = `<strong>Slingshot Controls:</strong> Drag and release objects to launch them!`;
    document.body.appendChild(helpText);

    return () => {
      if (helpText.parentNode) {
        document.body.removeChild(helpText);
      }
    };
  }, []);

  const toggleGravity = () => {
    setGravity(!gravity);
  };

  const triggerExplode = () => {
    setExploding(true);
    setTimeout(() => setExploding(false), 100);
  };

  const resetScene = () => {
    const newItems = [...items];
    const maxCoord = BOUNDARY_SIZE / 2 - 2; // 2 units buffer from walls

    for (let i = 0; i < newItems.length; i++) {
      const x = (Math.random() - 0.5) * maxCoord;
      const y = Math.random() * 8 + 2;
      const z = (Math.random() - 0.5) * maxCoord;

      newItems[i] = {
        ...newItems[i],
        position: [x, y, z],
        id: newItems[i].type + '-' + i + '-' + Date.now() // Force re-creation
      };
    }
    setItems(newItems);
  };

  // Camera position
  const cameraPosition = [0, 5, 15];

  return (
    <>
      <Canvas
        shadows
        camera={{ position: cameraPosition, fov: 45 }}
        gl={{ antialias: true }}
        dpr={[1, 2]} // Optimize for performance and quality
      >
        <color attach="background" args={['#111']} />
        <ambientLight intensity={0.5} />
        <directionalLight
          position={[10, 10, 5]}
          intensity={1}
          castShadow
          shadow-mapSize={[2048, 2048]}
        />

        <Physics
          gravity={gravity ? [0, -9.8, 0] : [0, 0, 0]}
          defaultContactMaterial={{
            friction: 0.2,
            restitution: 0.7
          }}
          // Allow physics to continue running while dragging
          allowSleep={false}
          iterations={8} // More solver iterations for better stability
        >
          <BoundaryWalls size={BOUNDARY_SIZE} />
          {items.map((item) =>
            item.type === 'box' ? (
              <DraggableBox
                key={item.id}
                position={item.position}
                color={item.color}
                size={item.size}
                exploding={exploding}
              />
            ) : (
              <DraggableBall
                key={item.id}
                position={item.position}
                color={item.color}
                exploding={exploding}
              />
            )
          )}
        </Physics>

        {/* Add the orbit controls */}
        <CameraControls />
      </Canvas>

      <div className="instructions">
        <h1>Physics Demo</h1>
        <p><span className="highlighting">Drag and release</span> objects to slingshot them</p>
        <p><span className="highlighting">Right-click and drag</span> to rotate camera</p>
        <p>Scroll to zoom in/out</p>

        <div className="controls">
          <button onClick={resetScene}>Reset Scene</button>
          <button onClick={triggerExplode}>Explode All!</button>
          <button onClick={toggleGravity}>{gravity ? "Disable Gravity" : "Enable Gravity"}</button>
        </div>
      </div>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<Scene />);
