'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Html, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import type {
  AvatarAnimationState,
  AvatarPreset,
  BackgroundOption,
  CameraAngle,
} from '@/hooks/useAvatarEngine';

interface AvatarPreviewProps {
  face: AvatarPreset;
  animation: AvatarAnimationState;
  background: BackgroundOption;
  camera: CameraAngle;
  showHud?: boolean;
  onCanvasReady?: (canvas: HTMLCanvasElement | null) => void;
}

const ease = (current: number, target: number, factor: number) =>
  current + (target - current) * factor;

const CameraRig = ({ camera }: { camera: CameraAngle }) => {
  const three = useThree();
  const targetRef = useRef({
    position: new THREE.Vector3(...camera.position),
    lookAt: new THREE.Vector3(...camera.target),
  });

  useEffect(() => {
    targetRef.current.position.set(...camera.position);
    targetRef.current.lookAt.set(...camera.target);
  }, [camera]);

  useFrame(() => {
    three.camera.position.lerp(targetRef.current.position, 0.08);
    three.camera.lookAt(targetRef.current.lookAt);
  });

  return null;
};

const AvatarRig = ({
  face,
  animation,
}: {
  face: AvatarPreset;
  animation: AvatarAnimationState;
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const leftEyeRef = useRef<THREE.Mesh>(null);
  const rightEyeRef = useRef<THREE.Mesh>(null);
  const mouthRef = useRef<THREE.Mesh>(null);
  const leftHandRef = useRef<THREE.Mesh>(null);
  const rightHandRef = useRef<THREE.Mesh>(null);
  const cheekRef = useRef<THREE.Mesh>(null);

  const rawTexture = useTexture(face.faceTexture);
  const texture = useMemo(() => {
    if (rawTexture) {
      rawTexture.colorSpace = THREE.SRGBColorSpace;
      rawTexture.flipY = false;
      rawTexture.needsUpdate = true;
    }
    return rawTexture;
  }, [rawTexture]);

  const baseSkin = useMemo(() => new THREE.Color(face.accent).multiplyScalar(0.35), [face.accent]);

  useFrame((_, delta) => {
    const lerpAmount = 1 - Math.pow(0.09, delta * 60);
    if (groupRef.current) {
      const [x, y, z] = animation.headRotation;
      groupRef.current.rotation.x = ease(groupRef.current.rotation.x, x, lerpAmount);
      groupRef.current.rotation.y = ease(groupRef.current.rotation.y, y, lerpAmount);
      groupRef.current.rotation.z = ease(groupRef.current.rotation.z, z, lerpAmount / 2);
      groupRef.current.position.y = ease(groupRef.current.position.y, animation.intensity * 0.18, lerpAmount);
    }
    if (leftEyeRef.current && rightEyeRef.current) {
      const lookX = animation.eyeDirection[0] * 0.18;
      const lookY = animation.eyeDirection[1] * 0.12;
      leftEyeRef.current.position.x = ease(leftEyeRef.current.position.x, -0.32 + lookX, lerpAmount);
      rightEyeRef.current.position.x = ease(rightEyeRef.current.position.x, 0.32 + lookX, lerpAmount);
      leftEyeRef.current.position.y = ease(leftEyeRef.current.position.y, 0.28 + lookY, lerpAmount);
      rightEyeRef.current.position.y = ease(rightEyeRef.current.position.y, 0.28 + lookY, lerpAmount);

      const blinkScale = Math.max(0.1, 1 - animation.blink * 1.5);
      leftEyeRef.current.scale.y = ease(leftEyeRef.current.scale.y, blinkScale, lerpAmount * 1.4);
      rightEyeRef.current.scale.y = ease(rightEyeRef.current.scale.y, blinkScale, lerpAmount * 1.4);
    }
    if (mouthRef.current) {
      const open = 0.28 + animation.mouthOpen * 0.65 + animation.emotionMix.happy * 0.2;
      mouthRef.current.scale.y = ease(mouthRef.current.scale.y, open, lerpAmount * 1.2);
      mouthRef.current.scale.x = ease(
        mouthRef.current.scale.x,
        0.85 + animation.emotionMix.surprised * 0.4 - animation.emotionMix.angry * 0.2,
        lerpAmount,
      );
      mouthRef.current.position.y = ease(
        mouthRef.current.position.y,
        -0.05 - animation.mouthOpen * 0.2,
        lerpAmount,
      );
    }
    if (leftHandRef.current && rightHandRef.current) {
      const wave = animation.handWave;
      leftHandRef.current.rotation.z = ease(leftHandRef.current.rotation.z, 0.4 + wave * 0.4, lerpAmount);
      rightHandRef.current.rotation.z = ease(
        rightHandRef.current.rotation.z,
        -0.4 + wave * 0.4,
        lerpAmount,
      );
      leftHandRef.current.rotation.x = ease(
        leftHandRef.current.rotation.x,
        -0.3 + animation.emotionMix.happy * 0.4,
        lerpAmount,
      );
      rightHandRef.current.rotation.x = ease(
        rightHandRef.current.rotation.x,
        -0.3 + animation.emotionMix.happy * 0.4,
        lerpAmount,
      );
    }
    if (cheekRef.current) {
      const glow = 0.15 + animation.emotionMix.happy * 0.3 + animation.intensity * 0.25;
      cheekRef.current.material.opacity = ease(cheekRef.current.material.opacity, glow, lerpAmount);
    }
  });

  return (
    <group ref={groupRef} position={[0, 0.15, 0]}>
      <mesh castShadow>
        <capsuleGeometry args={[0.75, 1.9, 16, 32]} />
        <meshStandardMaterial color={baseSkin} roughness={0.7} metalness={0.05} />
      </mesh>
      <mesh position={[0, 1.1, 0]} castShadow>
        <sphereGeometry args={[0.95, 128, 128]} />
        <meshStandardMaterial
          map={texture}
          metalness={0.25}
          roughness={0.45}
          emissive={face.accent}
          emissiveIntensity={0.08 + animation.intensity * 0.2}
        />
      </mesh>
      <mesh ref={mouthRef} position={[0, -0.02, 0.87]}>
        <planeGeometry args={[1, 0.4, 32, 32]} />
        <meshStandardMaterial
          color={new THREE.Color('#ff6b6b').lerp(new THREE.Color(face.accent), animation.emotionMix.happy)}
          emissive={new THREE.Color(face.accent).multiplyScalar(0.2 + animation.intensity * 0.5)}
          emissiveIntensity={0.6}
          roughness={0.15}
          transparent
          opacity={0.92}
        />
      </mesh>
      <mesh ref={leftEyeRef} position={[-0.32, 0.32, 0.92]}>
        <sphereGeometry args={[0.12, 32, 32]} />
        <meshStandardMaterial
          color="#0b1016"
          emissive={new THREE.Color(face.accent).multiplyScalar(0.9 + animation.intensity * 0.6)}
          emissiveIntensity={0.8}
          roughness={0.3}
        />
      </mesh>
      <mesh ref={rightEyeRef} position={[0.32, 0.32, 0.92]}>
        <sphereGeometry args={[0.12, 32, 32]} />
        <meshStandardMaterial
          color="#0b1016"
          emissive={new THREE.Color(face.accent).multiplyScalar(0.9 + animation.intensity * 0.6)}
          emissiveIntensity={0.8}
          roughness={0.3}
        />
      </mesh>
      <mesh ref={cheekRef} position={[0, 0.1, 0.84]}>
        <planeGeometry args={[1.4, 0.9]} />
        <meshBasicMaterial
          color={new THREE.Color(face.accent).multiplyScalar(1.2)}
          transparent
          opacity={0.2}
        />
      </mesh>
      <group position={[0, -0.6, 0]}>
        <mesh position={[-0.9, -0.4, 0]} ref={leftHandRef} castShadow>
          <boxGeometry args={[0.35, 1.2, 0.35]} />
          <meshStandardMaterial
            color={new THREE.Color(face.accent).lerp(baseSkin, 0.4)}
            metalness={0.2}
            roughness={0.5}
          />
        </mesh>
        <mesh position={[0.9, -0.4, 0]} ref={rightHandRef} castShadow>
          <boxGeometry args={[0.35, 1.2, 0.35]} />
          <meshStandardMaterial
            color={new THREE.Color(face.accent).lerp(baseSkin, 0.4)}
            metalness={0.2}
            roughness={0.5}
          />
        </mesh>
      </group>
      <mesh position={[0, -1.6, 0]} receiveShadow>
        <circleGeometry args={[2.2, 48]} />
        <meshStandardMaterial color="#05080f" roughness={1} metalness={0} />
      </mesh>
    </group>
  );
};

const HudOverlay = ({ animation }: { animation: AvatarAnimationState }) => (
  <Html position={[0, 2.5, 0]} transform occlude={false}>
    <div className="rounded-full border border-white/10 bg-black/60 px-4 py-2 text-xs font-medium text-white/80 backdrop-blur">
      <span className="mr-1 text-white">Energy</span>
      <span>{Math.round(animation.energy * 100)}%</span>
    </div>
  </Html>
);

export const AvatarPreview = ({
  face,
  animation,
  background,
  camera,
  showHud = true,
  onCanvasReady,
}: AvatarPreviewProps) => {
  useEffect(
    () => () => {
      onCanvasReady?.(null);
    },
    [onCanvasReady],
  );

  return (
    <div
      className={`relative overflow-hidden rounded-3xl border border-white/10 shadow-2xl transition-all duration-700 ${background.className}`}
    >
      <Canvas
        shadows
        camera={{ position: [...camera.position], fov: 40 }}
        onCreated={({ gl }) => {
          gl.setClearColor(new THREE.Color('#02030e'), 0.7);
          onCanvasReady?.(gl.domElement);
        }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight
          position={[5, 6, 4]}
          intensity={1.2}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        <spotLight position={[-6, 5, 2]} angle={0.7} intensity={0.6} penumbra={0.6} />
        <pointLight position={[0, 5, -4]} intensity={0.4} />
        <Environment preset="studio" />
        <CameraRig camera={camera} />
        <AvatarRig face={face} animation={animation} />
        {showHud ? <HudOverlay animation={animation} /> : null}
      </Canvas>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(148,163,255,0.45),transparent_60%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
    </div>
  );
};

export default AvatarPreview;
