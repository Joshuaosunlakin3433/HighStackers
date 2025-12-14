"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

type GameState = "idle" | "action" | "win";

interface GameSceneProps {
  gameState?: GameState;
  onReady?: () => void;
}

// Floating Particles for Ambient Depth
function FloatingParticles({ gameState }: { gameState: GameState }) {
  const particlesRef = useRef<THREE.Points>(null);

  const particles = useMemo(() => {
    const count = 100;
    const positions = new Float32Array(count * 3);

    // Use seeded random for stable positions
    let seed = 98765;
    const seededRandom = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (seededRandom() - 0.5) * 30;
      positions[i * 3 + 1] = (seededRandom() - 0.5) * 20;
      positions[i * 3 + 2] = (seededRandom() - 0.5) * 30;
    }

    return positions;
  }, []);

  useFrame((state) => {
    if (!particlesRef.current) return;

    const positions = particlesRef.current.geometry.attributes.position
      .array as Float32Array;

    for (let i = 0; i < positions.length; i += 3) {
      // Slow gentle drift
      positions[i + 1] += Math.sin(state.clock.elapsedTime + i) * 0.002;

      // Wrap around
      if (positions[i + 1] > 10) positions[i + 1] = -10;
      if (positions[i + 1] < -10) positions[i + 1] = 10;
    }

    particlesRef.current.geometry.attributes.position.needsUpdate = true;

    // Rotate slowly for depth effect
    particlesRef.current.rotation.y = state.clock.elapsedTime * 0.05;
  });

  return (
    <points ref={particlesRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[particles, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.1}
        color={
          gameState === "win"
            ? "#00FF00"
            : gameState === "action"
            ? "#F7931A"
            : "#7F73FF"
        }
        transparent
        opacity={0.6}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

// Prize Orb - Represents the pot/stakes in the center
function StacksChips({ gameState }: { gameState: GameState }) {
  const orbRef = useRef<THREE.Group>(null);
  const innerOrbRef = useRef<THREE.Mesh>(null);
  const outerGlowRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!orbRef.current || !innerOrbRef.current || !outerGlowRef.current)
      return;
    const time = state.clock.elapsedTime;

    if (gameState === "idle") {
      // Gentle breathing pulse
      const scale = 1 + Math.sin(time * 1.5) * 0.15;
      innerOrbRef.current.scale.setScalar(scale);
      outerGlowRef.current.scale.setScalar(scale * 1.3);
      orbRef.current.rotation.y = time * 0.3;
    } else if (gameState === "action") {
      // Intense energy buildup
      const scale = 1 + Math.sin(time * 8) * 0.4;
      innerOrbRef.current.scale.setScalar(scale);
      outerGlowRef.current.scale.setScalar(scale * 2);
      orbRef.current.rotation.y = time * 3;
      orbRef.current.rotation.x = Math.sin(time * 2) * 0.3;
    } else if (gameState === "win") {
      // Victory explosion effect
      const scale = 1 + time * 0.8;
      innerOrbRef.current.scale.setScalar(scale);
      outerGlowRef.current.scale.setScalar(scale * 3);
      orbRef.current.rotation.y += 0.2;
    }
  });

  return (
    <group ref={orbRef} position={[0, 1.5, 0]}>
      {/* Inner core - represents STX value */}
      <mesh ref={innerOrbRef}>
        <icosahedronGeometry args={[0.8, 2]} />
        <meshStandardMaterial
          color={gameState === "action" ? "#F7931A" : "#7F73FF"}
          emissive={gameState === "action" ? "#F7931A" : "#7F73FF"}
          emissiveIntensity={gameState === "win" ? 4 : 2.5}
          metalness={0.9}
          roughness={0.1}
        />
      </mesh>

      {/* Energy rings orbiting the core */}
      {[0, 1, 2].map((i) => (
        <mesh key={i} rotation={[Math.PI / 2 + i * 0.5, i * 0.8, i * 1.2]}>
          <torusGeometry args={[1.2 + i * 0.2, 0.04, 8, 32]} />
          <meshBasicMaterial
            color={i % 2 === 0 ? "#7F73FF" : "#F7931A"}
            transparent
            opacity={0.6}
          />
        </mesh>
      ))}

      {/* Outer glow sphere */}
      <mesh ref={outerGlowRef}>
        <sphereGeometry args={[1.3, 32, 32]} />
        <meshBasicMaterial
          color={gameState === "win" ? "#05df72" : "#7F73FF"}
          transparent
          opacity={0.2}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Floating value particles around orb */}
      {Array.from({ length: 8 }).map((_, i) => {
        const angle = (i / 8) * Math.PI * 2;
        const radius = 1.8;
        return (
          <mesh
            key={`particle-${i}`}
            position={[
              Math.cos(angle) * radius,
              Math.sin(angle * 2) * 0.3,
              Math.sin(angle) * radius,
            ]}
          >
            <sphereGeometry args={[0.08, 8, 8]} />
            <meshBasicMaterial color="#FFD700" transparent opacity={0.8} />
          </mesh>
        );
      })}
    </group>
  );
}

// Main Scene Component
function Scene({ gameState }: { gameState: GameState }) {
  return (
    <>
      <color attach="background" args={["#000000"]} />
      <fog attach="fog" args={["#000000", 5, 50]} />
      {/* Lighting */}
      <ambientLight intensity={0.2} />
      <pointLight position={[0, 5, 0]} intensity={2} color="#7F73FF" />
      <pointLight position={[5, 2, 5]} intensity={1} color="#F7931A" />
      <pointLight position={[-5, 2, -5]} intensity={1} color="#7F73FF" />
      <spotLight
        position={[0, 10, 0]}
        angle={0.6}
        penumbra={1}
        intensity={1.5}
        color="#FFFFFF"
        castShadow
      />
      {/* Floating ambient particles for depth */}
      <FloatingParticles gameState={gameState} />
      {/* Prize Orb - Center focal point */}
      <StacksChips gameState={gameState} /> {/* Camera Controls */}
      <OrbitControls
        enableZoom={false}
        enablePan={false}
        minPolarAngle={Math.PI / 3}
        maxPolarAngle={Math.PI / 2}
        autoRotate
        autoRotateSpeed={0.5}
      />
    </>
  );
}

// Canvas Wrapper Component
export default function GameScene({
  gameState = "idle",
  onReady,
}: GameSceneProps) {
  return (
    <div
      className="w-full h-full bg-black"
      style={{ backgroundColor: "#000000" }}
    >
      <Canvas
        camera={{ position: [0, 4, 10], fov: 70 }}
        gl={{
          alpha: false,
          antialias: true,
          powerPreference: "high-performance",
        }}
        style={{ background: "#000000", display: "block" }}
        onCreated={({ gl, scene }) => {
          gl.setClearColor("#000000", 1);
          scene.background = new THREE.Color("#000000");
          // Signal that canvas is ready
          if (onReady) {
            setTimeout(onReady, 100);
          }
        }}
      >
        <Scene gameState={gameState} />
      </Canvas>
    </div>
  );
}
