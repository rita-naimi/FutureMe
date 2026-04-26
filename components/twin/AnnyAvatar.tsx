'use client';
import { useRef, useEffect, Suspense, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

function SceneSetup() {
  const { scene, gl } = useThree();
  useEffect(() => {
    scene.background = new THREE.Color('#e2e1e0');
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 1.2;
  }, [scene, gl]);
  return null;
}

interface MorphParams {
  age: number;        // 0=young, 1=old
  gender: number;     // 0=female, 1=male
  muscle: number;     // 0=thin, 1=muscular
  weight: number;     // 0=slim, 1=heavy
  health: number;     // 0=sick, 1=healthy
}

function AnnyModel({ params }: { params: MorphParams }) {
  const { scene } = useGLTF('/models/anny.glb');
  const groupRef = useRef<THREE.Group>(null);
  const meshesRef = useRef<THREE.Mesh[]>([]);

  useEffect(() => {
    meshesRef.current = [];
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        meshesRef.current.push(child);
      }
    });

    // Log available morph targets
    meshesRef.current.forEach((mesh) => {
      if (mesh.morphTargetDictionary) {
        console.log('Morph targets:', Object.keys(mesh.morphTargetDictionary));
      }
    });
  }, [scene]);

  // Apply morph targets based on params
  useEffect(() => {
    meshesRef.current.forEach((mesh) => {
      if (!mesh.morphTargetDictionary || !mesh.morphTargetInfluences) return;

      const dict = mesh.morphTargetDictionary;
      const inf = mesh.morphTargetInfluences;

      // Reset all
      for (let i = 0; i < inf.length; i++) inf[i] = 0;

      // Age-related morphs
      const ageKeys = ['old', 'age', 'elder', 'senior', 'aged'];
      ageKeys.forEach(key => {
        const variations = [key, key.toUpperCase(), `${key}_shape`, `shape_${key}`];
        variations.forEach(v => {
          if (dict[v] !== undefined) inf[dict[v]] = params.age;
        });
      });

      // Gender morphs
      const maleKeys = ['male', 'man', 'masculine'];
      const femaleKeys = ['female', 'woman', 'feminine'];
      maleKeys.forEach(key => {
        if (dict[key] !== undefined) inf[dict[key]] = params.gender;
      });
      femaleKeys.forEach(key => {
        if (dict[key] !== undefined) inf[dict[key]] = 1 - params.gender;
      });

      // Muscle morphs
      const muscleKeys = ['muscle', 'muscular', 'athletic', 'fit', 'strong'];
      muscleKeys.forEach(key => {
        if (dict[key] !== undefined) inf[dict[key]] = params.muscle;
      });

      // Weight/fat morphs
      const weightKeys = ['fat', 'overweight', 'heavy', 'obese', 'chubby'];
      const thinKeys = ['thin', 'slim', 'skinny'];
      weightKeys.forEach(key => {
        if (dict[key] !== undefined) inf[dict[key]] = params.weight;
      });
      thinKeys.forEach(key => {
        if (dict[key] !== undefined) inf[dict[key]] = 1 - params.weight;
      });

      // Health/fatigue morphs
      const sickKeys = ['sick', 'tired', 'fatigue', 'ill', 'weak'];
      sickKeys.forEach(key => {
        if (dict[key] !== undefined) inf[dict[key]] = 1 - params.health;
      });

      mesh.morphTargetInfluences = [...inf];
    });
  }, [params]);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    groupRef.current.position.y = Math.sin(clock.getElapsedTime() * 0.5) * 0.01;
  });
  const fatFactor = 1 + (params.weight * 0.3); // 1.0 à 1.3 selon le poids
  const muscleFactor = 1 + (params.muscle * 0.1); // légèrement plus grand si musclé
  const scaleX = fatFactor * muscleFactor;
  const scaleY = 1 - (params.weight * 0.05); // légèrement plus court si gros
  const scaleZ = fatFactor;

  return (
    <group ref={groupRef} position={[0, -1.2, 0]} scale={[scaleX, scaleY, scaleZ]}>
      <primitive object={scene} />
    </group>
    );
  }

interface SliderProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  leftLabel: string;
  rightLabel: string;
  color?: string;
}

function Slider({ label, value, onChange, leftLabel, rightLabel, color = '#38bdf8' }: SliderProps) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#1a1a2e' }}>{label}</span>
        <span style={{ fontSize: 11, color: '#666' }}>{Math.round(value * 100)}%</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 10, color: '#999', minWidth: 40 }}>{leftLabel}</span>
        <div style={{ flex: 1, position: 'relative' }}>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(value * 100)}
            onChange={(e) => onChange(Number(e.target.value) / 100)}
            style={{
              width: '100%',
              appearance: 'none',
              height: 4,
              borderRadius: 2,
              background: `linear-gradient(90deg, ${color} ${value * 100}%, rgba(0,0,0,0.1) ${value * 100}%)`,
              outline: 'none',
              cursor: 'pointer',
            }}
          />
        </div>
        <span style={{ fontSize: 10, color: '#999', minWidth: 40, textAlign: 'right' }}>{rightLabel}</span>
      </div>
    </div>
  );
}

interface AnnyAvatarProps {
  initialHealthScore?: number;
  gender?: string;
  height?: number;
  showControls?: boolean;
}

export default function AnnyAvatar({
  initialHealthScore = 70,
  gender = 'male',
  height = 400,
  showControls = true,
}: AnnyAvatarProps) {
  const [params, setParams] = useState<MorphParams>({
    age: 0.3,
    gender: gender === 'male' ? 0.8 : 0.2,
    muscle: 0.4,
    weight: 0.3,
    health: initialHealthScore / 100,
  });

  const healthLabel = params.health >= 0.8 ? 'Thriving'
    : params.health >= 0.6 ? 'Healthy'
    : params.health >= 0.4 ? 'Aging'
    : params.health >= 0.2 ? 'At Risk'
    : 'Critical';

  const healthColor = params.health >= 0.6 ? '#34d399'
    : params.health >= 0.4 ? '#fbbf24'
    : '#f87171';

  const cssFilter = [
    `saturate(${0.6 + params.health * 0.6})`,
    `brightness(${0.85 + params.health * 0.25})`,
  ].join(' ');

  function update(key: keyof MorphParams, val: number) {
    setParams(prev => ({ ...prev, [key]: val }));
  }

  return (
  <div style={{ width: '100%', fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{
        width: '100%',
        height,
        borderRadius: 16,
        overflow: 'hidden',
        position: 'relative',
        background: '#e2e1e0',
        filter: cssFilter,
      }}>
        <Canvas camera={{ position: [0, 0.8, 3], fov: 50 }} gl={{ antialias: true }}>
          <SceneSetup />
          <ambientLight intensity={0.6} />
          <directionalLight position={[1, 2, 2]} intensity={1.8} color="#fff8f0" castShadow />
          <directionalLight position={[-1, 0, -1]} intensity={0.3} color="#334488" />
          <Suspense fallback={null}>
            <AnnyModel params={params} />
          </Suspense>
          <OrbitControls
            enablePan={false}
            minDistance={1.5}
            maxDistance={6}
            minPolarAngle={Math.PI / 6}
            maxPolarAngle={Math.PI * 0.8}
            target={[0, 0.3, 0]}
            autoRotate
            autoRotateSpeed={0.5}
          />
        </Canvas>

        {/* Health badge */}
        <div style={{
          position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
          border: `1px solid ${healthColor}44`, borderRadius: 20,
          padding: '4px 14px', color: healthColor, fontSize: 11, fontWeight: 700,
          whiteSpace: 'nowrap', pointerEvents: 'none',
        }}>
          {healthLabel}
        </div>

        {/* Health bar */}
        <div style={{
          position: 'absolute', bottom: 12, left: 16, right: 16,
          height: 3, background: 'rgba(255,255,255,0.2)', borderRadius: 2,
        }}>
          <div style={{
            height: '100%', width: `${params.health * 100}%`,
            background: `linear-gradient(90deg, ${healthColor}, ${healthColor}88)`,
            borderRadius: 2, transition: 'width 0.5s ease',
          }} />
        </div>
      </div>

      {showControls && (
        <div style={{
          background: '#fff',
          borderRadius: 14,
          padding: 20,
          marginTop: 12,
          border: '1px solid rgba(0,0,0,0.08)',
          boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2, color: '#999', marginBottom: 16 }}>
            Customize Avatar
          </div>

          <Slider label="Age" value={params.age} onChange={v => update('age', v)}
            leftLabel="Young" rightLabel="Elder" color="#a78bfa" />
          <Slider label="Gender" value={params.gender} onChange={v => update('gender', v)}
            leftLabel="Female" rightLabel="Male" color="#38bdf8" />
          <Slider label="Musculature" value={params.muscle} onChange={v => update('muscle', v)}
            leftLabel="Slim" rightLabel="Athletic" color="#34d399" />
          <Slider label="Body weight" value={params.weight} onChange={v => update('weight', v)}
            leftLabel="Light" rightLabel="Heavy" color="#fbbf24" />
          <Slider label="Health" value={params.health} onChange={v => update('health', v)}
            leftLabel="Critical" rightLabel="Thriving" color="#34d399" />
        </div>
      )}
    </div>
  );
}
