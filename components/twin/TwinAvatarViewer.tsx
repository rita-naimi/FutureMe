'use client';
import { useRef, useEffect, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

function getVisualState(healthScore: number) {
  if (healthScore >= 90) return { saturation:0.2,   brightness:0.08,  contrast:0.0,  vignette:0.15, ageMap:1, ageMix:0.0,  lightInt:2.4, lightColor:'#fff8f0', lightColor2:'#223366', ambientInt:0.6  };
  if (healthScore >= 80) return { saturation:0.1,   brightness:0.05,  contrast:0.01, vignette:0.2,  ageMap:1, ageMix:0.25, lightInt:2.2, lightColor:'#fff5e8', lightColor2:'#223366', ambientInt:0.55 };
  if (healthScore >= 70) return { saturation:0.0,   brightness:0.02,  contrast:0.02, vignette:0.28, ageMap:2, ageMix:0.45, lightInt:2.0, lightColor:'#fff0d8', lightColor2:'#223366', ambientInt:0.5  };
  if (healthScore >= 60) return { saturation:-0.05, brightness:0.0,   contrast:0.04, vignette:0.33, ageMap:3, ageMix:0.55, lightInt:1.8, lightColor:'#ffecc8', lightColor2:'#112255', ambientInt:0.45 };
  if (healthScore >= 50) return { saturation:-0.1,  brightness:-0.02, contrast:0.06, vignette:0.4,  ageMap:3, ageMix:0.65, lightInt:1.6, lightColor:'#ffe8b8', lightColor2:'#112255', ambientInt:0.4  };
  if (healthScore >= 40) return { saturation:-0.2,  brightness:0.02,  contrast:0.07, vignette:0.5,  ageMap:4, ageMix:0.72, lightInt:1.65, lightColor:'#aabbdd', lightColor2:'#223388', ambientInt:0.4  };
  if (healthScore >= 30) return { saturation:-0.35, brightness:0.03,  contrast:0.09, vignette:0.58, ageMap:4, ageMix:0.80, lightInt:1.7, lightColor:'#8899cc', lightColor2:'#223388', ambientInt:0.45 };
  if (healthScore >= 20) return { saturation:-0.5,  brightness:0.0,   contrast:0.12, vignette:0.68, ageMap:4, ageMix:0.88, lightInt:2.0, lightColor:'#4466aa', lightColor2:'#112266', ambientInt:0.55 };
  if (healthScore >= 10) return { saturation:-0.6,  brightness:-0.05, contrast:0.16, vignette:0.78, ageMap:4, ageMix:0.94, lightInt:2.2, lightColor:'#334488', lightColor2:'#112266', ambientInt:0.6  };
  return                        { saturation:-0.72, brightness:-0.1,  contrast:0.20, vignette:0.88, ageMap:4, ageMix:1.0,  lightInt:2.4, lightColor:'#223366', lightColor2:'#0a1144', ambientInt:0.65 };
}

function getLightColor(healthScore: number): string {
  if (healthScore >= 65) return '#000000';
  if (healthScore >= 50) return '#000000';
  if (healthScore >= 35) return '#000000';
  return '#223366';
}

function SceneSetup() {
  const { scene, gl } = useThree();
  useEffect(() => {
    scene.background = new THREE.Color('#e2e1e0');
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.outputColorSpace = THREE.SRGBColorSpace;
    gl.toneMappingExposure = 1.4;
  }, [scene, gl]);
  return null;
}

function HeadModel({ healthScore }: { healthScore: number }) {
  const { scene } = useGLTF('/models/LeePerrySmith.glb');
  const groupRef = useRef<THREE.Group>(null);
  const vs = getVisualState(healthScore);

  useEffect(() => {
    const loader = new THREE.TextureLoader();

    const baseTexture = loader.load('/models/Map-COL.jpg', () => doBlend());
    baseTexture.colorSpace = THREE.SRGBColorSpace;

    const ageTexture = loader.load(`/models/Map-AGE-male-${vs.ageMap}.png`, () => doBlend());
    ageTexture.colorSpace = THREE.SRGBColorSpace;

    const normalTexture = loader.load('/models/Map-NOR.jpg');

    // Canvas to blend base + age
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d')!;
    const blended = new THREE.CanvasTexture(canvas);
    blended.colorSpace = THREE.SRGBColorSpace;

    function applyToScene() {
      scene.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.castShadow = true;
          const mat = new THREE.MeshStandardMaterial({
            map: blended,
            normalMap: normalTexture,
            roughness: 0.75,
            metalness: 0.0,
          });
          mat.needsUpdate = true;
          mesh.material = mat;
        }
      });
    }

    function doBlend() {
      const baseImg = baseTexture.image as HTMLImageElement | null;
      const ageImg = ageTexture.image as HTMLImageElement | null;
      if (!baseImg) return;

      ctx.clearRect(0, 0, 1024, 1024);
      ctx.globalAlpha = 1.0;
      ctx.drawImage(baseImg, 0, 0, 1024, 1024);

      if (vs.ageMix > 0 && ageImg) {
        ctx.globalAlpha = Math.min(vs.ageMix * 1.2, 1.0);
        ctx.drawImage(ageImg, 0, 0, 1024, 1024);
      }

      blended.needsUpdate = true;
      applyToScene();
    }

    const t1 = setTimeout(doBlend, 500);
    const t2 = setTimeout(doBlend, 1500);
    const t3 = setTimeout(doBlend, 4000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [scene, healthScore, vs.ageMap, vs.ageMix]);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    groupRef.current.position.y = -1.5 + Math.sin(clock.getElapsedTime() * 0.5) * 0.008;
  });

  return (
    <group ref={groupRef} position={[0, -1.5, 0]}>
      <primitive object={scene} />
    </group>
  );
}

interface TwinAvatarViewerProps {
  healthScore?: number;
  gender?: string;
}

export default function TwinAvatarViewer({ healthScore = 70 }: TwinAvatarViewerProps) {
  const vs = getVisualState(healthScore);
  const lightColor = getLightColor(healthScore);
  const lightInt = healthScore >= 65 ? 2.4 : healthScore >= 35 ? 1.8 : 1.4;
  const ambientInt = healthScore >= 65 ? 0.6 : healthScore >= 35 ? 0.45 : 0.35;

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
      height: 300,
      borderRadius: 16,
      overflow: 'hidden',
      position: 'relative',
      background: '#0a0f1e',
      filter: cssFilter,
    }}>
      <Canvas
        camera={{ position: [0, 0, 10], fov: 92 }}
        gl={{ antialias: true }}
      >
        <SceneSetup />
        <ambientLight intensity={ambientInt} />
        <directionalLight position={[0.5, 1, 1]} intensity={lightInt} color={lightColor} castShadow />
        <directionalLight position={[-1, -0.5, -1]} intensity={0.3} color="#112266" />
        <Suspense fallback={null}>
          <HeadModel healthScore={healthScore} />
        </Suspense>
        <OrbitControls
          enablePan={false}
          minDistance={1.8}
          maxDistance={5}
          minPolarAngle={Math.PI / 4}
          maxPolarAngle={Math.PI * 0.75}
          target={[0, 0, 0]}
          autoRotate
          autoRotateSpeed={0.6}
        />
      </Canvas>

      <div style={{
        position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
        border: `1px solid ${col}44`, borderRadius: 20,
        padding: '4px 14px', color: col, fontSize: 11, fontWeight: 700,
        whiteSpace: 'nowrap', pointerEvents: 'none',
      }}>
        {label}
      </div>

      <div style={{
        position: 'absolute', bottom: 12, left: 16, right: 16,
        height: 3, background: 'rgba(255,255,255,0.1)', borderRadius: 2,
      }}>
        <div style={{
          height: '100%', width: `${healthScore}%`,
          background: `linear-gradient(90deg, ${col}, ${col}88)`,
          borderRadius: 2, transition: 'width 0.8s ease',
        }} />
      </div>
    </div>
  );
}
