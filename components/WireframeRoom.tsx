"use client";

import { useRef, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import * as THREE from "three";

function Room() {
  const groupRef = useRef<THREE.Group>(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const isTouchDevice = useRef(false);

  useEffect(() => {
    isTouchDevice.current = "ontouchstart" in window;
    if (isTouchDevice.current) return;

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouseRef.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    const maxTilt = 0.14;
    const lerpSpeed = 3;

    const targetX = isTouchDevice.current ? 0 : -mouseRef.current.y * maxTilt;
    const targetY = isTouchDevice.current ? 0 : mouseRef.current.x * maxTilt;

    groupRef.current.rotation.x = THREE.MathUtils.lerp(
      groupRef.current.rotation.x,
      targetX + 0.2,
      delta * lerpSpeed
    );
    groupRef.current.rotation.y = THREE.MathUtils.lerp(
      groupRef.current.rotation.y,
      targetY - 0.35,
      delta * lerpSpeed
    );

    groupRef.current.position.y = Math.sin(Date.now() * 0.001) * 0.02;
  });

  const w = 1.6;
  const h = 1.0;
  const d = 1.2;

  const hw = w / 2;
  const hh = h / 2;
  const hd = d / 2;

  const floorBL: [number, number, number] = [-hw, -hh, hd];
  const floorBR: [number, number, number] = [hw, -hh, hd];
  const floorTL: [number, number, number] = [-hw, -hh, -hd];
  const floorTR: [number, number, number] = [hw, -hh, -hd];

  const ceilBL: [number, number, number] = [-hw, hh, hd];
  const ceilBR: [number, number, number] = [hw, hh, hd];
  const ceilTL: [number, number, number] = [-hw, hh, -hd];
  const ceilTR: [number, number, number] = [hw, hh, -hd];

  const doorW = 0.3;
  const doorH = 0.6;
  const doorLeft = -doorW / 2;
  const doorRight = doorW / 2;
  const doorTop = -hh + doorH;

  const indigo = "#818cf8";
  const indigoFaint = "#6366f1";

  return (
    <group ref={groupRef}>
      {/* Floor */}
      <Line
        points={[floorBL, floorBR, floorTR, floorTL, floorBL]}
        color={indigoFaint}
        lineWidth={1.5}
        opacity={0.3}
        transparent
      />

      {/* Ceiling */}
      <Line
        points={[ceilBL, ceilBR, ceilTR, ceilTL, ceilBL]}
        color={indigoFaint}
        lineWidth={1}
        opacity={0.15}
        transparent
      />

      {/* Vertical edges */}
      <Line points={[floorBL, ceilBL]} color={indigoFaint} lineWidth={1.5} opacity={0.25} transparent />
      <Line points={[floorBR, ceilBR]} color={indigoFaint} lineWidth={1.5} opacity={0.15} transparent />
      <Line points={[floorTL, ceilTL]} color={indigoFaint} lineWidth={1.5} opacity={0.4} transparent />
      <Line points={[floorTR, ceilTR]} color={indigoFaint} lineWidth={1.5} opacity={0.35} transparent />

      {/* Back wall */}
      <Line points={[floorTL, floorTR]} color={indigo} lineWidth={1.5} opacity={0.5} transparent />
      <Line points={[ceilTL, ceilTR]} color={indigo} lineWidth={1} opacity={0.3} transparent />

      {/* Door frame on back wall */}
      <Line
        points={[
          [doorLeft, -hh, -hd],
          [doorLeft, doorTop, -hd],
          [doorRight, doorTop, -hd],
          [doorRight, -hh, -hd],
        ]}
        color={indigo}
        lineWidth={1}
        opacity={0.25}
        transparent
      />

      {/* Semi-transparent back wall face */}
      <mesh position={[0, 0, -hd]}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial color="#6366f1" transparent opacity={0.03} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

export function WireframeRoom() {
  return (
    <div className="w-[80px] h-[65px] sm:w-[90px] sm:h-[75px] flex-shrink-0">
      <Canvas
        camera={{ position: [0, 0, 3], fov: 35 }}
        style={{ background: "transparent" }}
        gl={{ alpha: true, antialias: true }}
      >
        <Room />
      </Canvas>
    </div>
  );
}
