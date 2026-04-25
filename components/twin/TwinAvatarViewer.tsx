'use client';
import { useRef, useEffect, useMemo, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { HealthInputs } from '@/lib/fhir';
import { getBmi } from '@/lib/fhir';

// After the export script's -90° X rotation Anny's Z-up body is Y-up:
//   feet ≈ y = −1.02, head ≈ y = 0.89, geometric centre ≈ y = −0.07

function getVisualState(healthScore: number) {
  if (healthScore >= 90) return { saturation:0.2,   brightness:0.08,  contrast:0.0,  lightInt:2.4, lightColor:'#fff8f0', lightColor2:'#223366', ambientInt:0.6  };
  if (healthScore >= 80) return { saturation:0.1,   brightness:0.05,  contrast:0.01, lightInt:2.2, lightColor:'#fff5e8', lightColor2:'#223366', ambientInt:0.55 };
  if (healthScore >= 70) return { saturation:0.0,   brightness:0.02,  contrast:0.02, lightInt:2.0, lightColor:'#fff0d8', lightColor2:'#223366', ambientInt:0.5  };
  if (healthScore >= 60) return { saturation:-0.05, brightness:0.0,   contrast:0.04, lightInt:1.8, lightColor:'#ffecc8', lightColor2:'#112255', ambientInt:0.45 };
  if (healthScore >= 50) return { saturation:-0.1,  brightness:-0.02, contrast:0.06, lightInt:1.6, lightColor:'#ffe8b8', lightColor2:'#112255', ambientInt:0.4  };
  if (healthScore >= 40) return { saturation:-0.2,  brightness:0.02,  contrast:0.07, lightInt:1.65,lightColor:'#aabbdd', lightColor2:'#223388', ambientInt:0.4  };
  if (healthScore >= 30) return { saturation:-0.35, brightness:0.03,  contrast:0.09, lightInt:1.7, lightColor:'#8899cc', lightColor2:'#223388', ambientInt:0.45 };
  if (healthScore >= 20) return { saturation:-0.5,  brightness:0.0,   contrast:0.12, lightInt:2.0, lightColor:'#4466aa', lightColor2:'#112266', ambientInt:0.55 };
  if (healthScore >= 10) return { saturation:-0.6,  brightness:-0.05, contrast:0.16, lightInt:2.2, lightColor:'#334488', lightColor2:'#112266', ambientInt:0.6  };
  return                        { saturation:-0.72, brightness:-0.1,  contrast:0.20, lightInt:2.4, lightColor:'#223366', lightColor2:'#0a1144', ambientInt:0.65 };
}

function pickAnnyUrl(inputs?: HealthInputs, biologicalAge?: number): string {
  const sex = inputs?.sex === 'female' ? 'female' : 'male';
  const age = biologicalAge ?? inputs?.age ?? 40;
  const ageBand = age < 40 ? 'young' : age <= 60 ? 'mature' : 'older';
  const bmi = inputs ? getBmi(inputs) : 24;
  const weightBand = bmi < 22 ? 'lean' : bmi < 28 ? 'average' : 'heavy';
  const exerciseDays = inputs?.exerciseDaysPerWeek ?? 3;
  const muscleBand = exerciseDays >= 5 ? 'high' : exerciseDays >= 3 ? 'medium' : 'low';
  return `/models/anny/${sex}-${ageBand}-${weightBand}-${muscleBand}.glb`;
}

const BG = '#eceae6';

function SceneSetup({ transparent }: { transparent: boolean }) {
  const { scene, gl } = useThree();
  useEffect(() => {
    scene.background = transparent ? null : new THREE.Color(BG);
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.outputColorSpace = THREE.SRGBColorSpace;
    gl.toneMappingExposure = 1.1;
  }, [scene, gl, transparent]);
  return null;
}

function BodyModel({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  const cloned = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mat = (mesh.material as THREE.MeshStandardMaterial).clone();
      mat.color.set('#c2e4f5');
      mat.roughness = 0.22;
      mat.metalness = 0.04;
      mat.transparent = true;
      mat.opacity = 0.88;
      mesh.material = mat;
    });
    return clone;
  }, [scene]);
  const ref = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.position.y = Math.sin(clock.getElapsedTime() * 0.5) * 0.012;
  });

  return (
    <group ref={ref}>
      <primitive object={cloned} />
    </group>
  );
}

interface TwinAvatarViewerProps {
  healthScore?: number;
  inputs?: HealthInputs;
  biologicalAge?: number;
  gender?: string; // legacy prop, sex is read from inputs.sex
  interactive?: boolean;
  height?: number | string;
  minimal?: boolean;
  transparent?: boolean;
}

export default function TwinAvatarViewer({
  healthScore = 70,
  inputs,
  biologicalAge,
  interactive = true,
  height = 460,
  minimal = false,
  transparent = false,
}: TwinAvatarViewerProps) {
  const vs = getVisualState(healthScore);
  const url = useMemo(() => pickAnnyUrl(inputs, biologicalAge), [inputs, biologicalAge]);

  const label = healthScore >= 80 ? 'Thriving'
    : healthScore >= 65 ? 'Healthy'
    : healthScore >= 50 ? 'Aging'
    : healthScore >= 35 ? 'At Risk'
    : healthScore >= 20 ? 'Critical'
    : 'Severe';

  const col = healthScore >= 65 ? '#34d399'
    : healthScore >= 40 ? '#fbbf24'
    : '#f87171';

  const cssFilter = [
    `saturate(${1 + vs.saturation})`,
    `brightness(${1 + vs.brightness})`,
    `contrast(${1 + vs.contrast})`,
  ].join(' ');

  return (
    <div style={{
      width: '100%',
      height,
      borderRadius: transparent ? 0 : 16,
      overflow: 'hidden',
      position: 'relative',
      background: transparent ? 'transparent' : BG,
      filter: cssFilter,
    }}>
      <Canvas
        camera={{ position: [0, -0.1, 3.5], fov: 42 }}
        gl={{ antialias: true, alpha: transparent }}
      >
        <SceneSetup transparent={transparent} />
        <ambientLight intensity={0.75} color="#fff8f2" />
        <directionalLight position={[1.5, 3, 2.5]} intensity={vs.lightInt} color="#fff8f0" castShadow />
        <directionalLight position={[-2, 0.5, -1.5]} intensity={0.55} color="#c8dff0" />
        <Suspense fallback={null}>
          <BodyModel url={url} />
        </Suspense>
        <OrbitControls
          target={[0, -0.1, 0]}
          enablePan={false}
          enableRotate={interactive}
          enableZoom={interactive}
          minDistance={2}
          maxDistance={5.5}
          minPolarAngle={Math.PI / 4}
          maxPolarAngle={Math.PI * 0.8}
          autoRotate
          autoRotateSpeed={0.5}
        />
      </Canvas>

      {!minimal && (
        <div style={{
          position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(255,255,255,0.72)', backdropFilter: 'blur(8px)',
          border: `1px solid ${col}66`, borderRadius: 20,
          padding: '4px 14px', color: col, fontSize: 11, fontWeight: 700,
          whiteSpace: 'nowrap', pointerEvents: 'none',
        }}>
          {label}
        </div>
      )}

      {!minimal && (
        <div style={{
          position: 'absolute', bottom: 12, left: 16, right: 16,
          height: 3, background: 'rgba(0,0,0,0.1)', borderRadius: 2,
        }}>
          <div style={{
            height: '100%', width: `${healthScore}%`,
            background: `linear-gradient(90deg, ${col}, ${col}88)`,
            borderRadius: 2, transition: 'width 0.8s ease',
          }} />
        </div>
      )}
    </div>
  );
}
