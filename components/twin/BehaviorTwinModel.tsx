'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { HealthInputs } from '@/lib/fhir';
import { getBmi } from '@/lib/fhir';

interface BehaviorTwinModelProps {
  baselineInputs: HealthInputs;
  simulatedInputs: HealthInputs;
  biologicalAge: number;
  healthScore: number;
}

interface BodyState {
  sex: 'female' | 'male';
  ageFactor: number;
  bmi: number;
  bodyMass: number;
  muscle: number;
  posture: number;
  risk: number;
  vitality: number;
}

export default function BehaviorTwinModel({
  baselineInputs,
  simulatedInputs,
  biologicalAge,
  healthScore
}: BehaviorTwinModelProps) {
  const body = useMemo(
    () => getBodyState(baselineInputs, simulatedInputs, biologicalAge, healthScore),
    [baselineInputs, biologicalAge, healthScore, simulatedInputs]
  );
  const riskColor = getRiskColor(body.risk);

  return (
    <article className="relative min-h-[28rem] overflow-hidden rounded-[1.5rem] border border-black/10 bg-slate-950 shadow-[0_18px_70px_rgba(15,23,42,0.14)] dark:border-white/10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_28%,rgba(0,201,167,0.18),transparent_42%),linear-gradient(to_bottom,#0b1223,#050816)]" />
      <Canvas camera={{ position: [0, 1.05, 7.1], fov: 38 }} gl={{ antialias: true, alpha: true }}>
        <ambientLight intensity={0.74} />
        <directionalLight position={[3, 5, 4]} intensity={2.3} color="#fff4e6" />
        <directionalLight position={[-4, 1.5, -3]} intensity={1.2} color={riskColor} />
        <TwinBody body={body} riskColor={riskColor} />
        <OrbitControls enablePan={false} enableZoom={false} minPolarAngle={Math.PI / 3.2} maxPolarAngle={Math.PI / 1.75} autoRotate autoRotateSpeed={0.35} />
      </Canvas>

      <div className="pointer-events-none absolute left-4 top-4 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/80 backdrop-blur-xl">
        Digital twin · {body.sex}
      </div>
      <div className="pointer-events-none absolute bottom-4 left-4 right-4 grid grid-cols-3 gap-2">
        <Metric label="Age" value={`${biologicalAge}`} />
        <Metric label="Muscle" value={`${Math.round(body.muscle * 100)}%`} />
        <Metric label="BMI" value={body.bmi.toFixed(1)} />
      </div>
    </article>
  );
}

function TwinBody({ body, riskColor }: { body: BodyState; riskColor: string }) {
  const groupRef = useRef<THREE.Group>(null);
  const shoulder = body.sex === 'male' ? 0.92 + body.muscle * 0.24 : 0.76 + body.muscle * 0.14;
  const hip = body.sex === 'female' ? 0.78 + body.bodyMass * 0.22 : 0.66 + body.bodyMass * 0.18;
  const waist = body.sex === 'female' ? 0.46 + body.bodyMass * 0.22 : 0.52 + body.bodyMass * 0.24;
  const chest = body.sex === 'male' ? shoulder * 0.92 : shoulder * 0.78;
  const limb = 0.105 + body.muscle * 0.055 + body.bodyMass * 0.026;
  const heightScale = THREE.MathUtils.clamp(body.vitality + 0.84, 0.86, 1.08);
  const slump = body.posture * 0.18;
  const skin = body.ageFactor > 0.55 ? '#c99b83' : '#d7ad92';
  const suit = new THREE.Color('#1f6f67').lerp(new THREE.Color(riskColor), body.risk * 0.38).getStyle();
  const hair = body.ageFactor > 0.62 ? '#6f6a66' : '#2a1f1a';

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y = Math.sin(clock.getElapsedTime() * 0.35) * 0.08;
    groupRef.current.position.y = Math.sin(clock.getElapsedTime() * 0.75) * 0.018;
  });

  return (
    <group ref={groupRef} position={[0, -1.28, 0]} scale={[heightScale, heightScale, heightScale]}>
      <mesh position={[0, 2.72, 0]} rotation={[slump, 0, 0]} scale={[0.82, 1, 0.78]}>
        <sphereGeometry args={[0.34 + body.ageFactor * 0.012, 48, 48]} />
        <meshStandardMaterial color={skin} roughness={0.68} />
      </mesh>

      <mesh position={[0, 2.9, -0.04]} rotation={[slump + 0.18, 0, 0]} scale={[0.86, 0.34, 0.78]}>
        <sphereGeometry args={[0.35, 32, 18]} />
        <meshStandardMaterial color={hair} roughness={0.78} />
      </mesh>

      <mesh position={[-0.12, 2.73, 0.28]} scale={[1, 0.7, 0.32]}>
        <sphereGeometry args={[0.028, 12, 8]} />
        <meshStandardMaterial color="#1b1f2a" roughness={0.45} />
      </mesh>
      <mesh position={[0.12, 2.73, 0.28]} scale={[1, 0.7, 0.32]}>
        <sphereGeometry args={[0.028, 12, 8]} />
        <meshStandardMaterial color="#1b1f2a" roughness={0.45} />
      </mesh>

      <mesh position={[0, 2.25, 0]} rotation={[slump, 0, 0]}>
        <capsuleGeometry args={[0.115, 0.26, 18, 32]} />
        <meshStandardMaterial color={skin} roughness={0.7} />
      </mesh>

      <mesh position={[0, 1.72, 0]} scale={[chest, 0.62, 0.32]} rotation={[slump, 0, 0]}>
        <sphereGeometry args={[1, 48, 32]} />
        <meshStandardMaterial color={suit} roughness={0.82} metalness={0.05} />
      </mesh>

      <mesh position={[0, 1.16, 0]} scale={[waist, 0.66, 0.28]} rotation={[slump * 0.9, 0, 0]}>
        <sphereGeometry args={[1, 48, 32]} />
        <meshStandardMaterial color={suit} roughness={0.84} metalness={0.04} />
      </mesh>

      <mesh position={[0, 0.58, 0]} scale={[hip, 0.34, 0.3]} rotation={[slump * 0.45, 0, 0]}>
        <sphereGeometry args={[1, 48, 24]} />
        <meshStandardMaterial color={suit} roughness={0.86} metalness={0.03} />
      </mesh>

      <mesh position={[-shoulder * 0.86, 1.75, 0]} rotation={[0.12 + slump, 0.02, -0.22]}>
        <capsuleGeometry args={[limb * 1.12, 0.72, 18, 28]} />
        <meshStandardMaterial color={skin} roughness={0.66} />
      </mesh>
      <mesh position={[shoulder * 0.86, 1.75, 0]} rotation={[0.12 + slump, -0.02, 0.22]}>
        <capsuleGeometry args={[limb * 1.12, 0.72, 18, 28]} />
        <meshStandardMaterial color={skin} roughness={0.66} />
      </mesh>

      <mesh position={[-shoulder * 1.04, 1.1, 0.03]} rotation={[0.08 + slump, 0.04, -0.08]}>
        <capsuleGeometry args={[limb * 0.92, 0.72, 18, 28]} />
        <meshStandardMaterial color={skin} roughness={0.7} />
      </mesh>
      <mesh position={[shoulder * 1.04, 1.1, 0.03]} rotation={[0.08 + slump, -0.04, 0.08]}>
        <capsuleGeometry args={[limb * 0.92, 0.72, 18, 28]} />
        <meshStandardMaterial color={skin} roughness={0.7} />
      </mesh>

      <mesh position={[-shoulder * 1.06, 0.64, 0.04]} scale={[1, 0.82, 0.58]}>
        <sphereGeometry args={[limb * 1.08, 18, 12]} />
        <meshStandardMaterial color={skin} roughness={0.68} />
      </mesh>
      <mesh position={[shoulder * 1.06, 0.64, 0.04]} scale={[1, 0.82, 0.58]}>
        <sphereGeometry args={[limb * 1.08, 18, 12]} />
        <meshStandardMaterial color={skin} roughness={0.68} />
      </mesh>

      <mesh position={[-hip * 0.32, -0.1, 0]} rotation={[0.04 + slump * 0.3, 0, 0.03]}>
        <capsuleGeometry args={[limb * 1.3, 0.82, 20, 28]} />
        <meshStandardMaterial color={skin} roughness={0.7} />
      </mesh>
      <mesh position={[hip * 0.32, -0.1, 0]} rotation={[0.04 + slump * 0.3, 0, -0.03]}>
        <capsuleGeometry args={[limb * 1.3, 0.82, 20, 28]} />
        <meshStandardMaterial color={skin} roughness={0.7} />
      </mesh>

      <mesh position={[-hip * 0.34, -0.9, 0]} rotation={[0.02 + slump * 0.22, 0, 0.02]}>
        <capsuleGeometry args={[limb * 1.03, 0.78, 20, 28]} />
        <meshStandardMaterial color={skin} roughness={0.72} />
      </mesh>
      <mesh position={[hip * 0.34, -0.9, 0]} rotation={[0.02 + slump * 0.22, 0, -0.02]}>
        <capsuleGeometry args={[limb * 1.03, 0.78, 20, 28]} />
        <meshStandardMaterial color={skin} roughness={0.72} />
      </mesh>

      <mesh position={[-hip * 0.34, -1.38, 0.16]} scale={[1.55, 0.42, 0.8]}>
        <sphereGeometry args={[limb * 1.05, 18, 12]} />
        <meshStandardMaterial color={skin} roughness={0.72} />
      </mesh>
      <mesh position={[hip * 0.34, -1.38, 0.16]} scale={[1.55, 0.42, 0.8]}>
        <sphereGeometry args={[limb * 1.05, 18, 12]} />
        <meshStandardMaterial color={skin} roughness={0.72} />
      </mesh>

      <mesh position={[0, 1.25, -0.12]} scale={[shoulder * 0.82, 0.035, 0.035]}>
        <sphereGeometry args={[1, 32, 12]} />
        <meshStandardMaterial color="#e7fff9" roughness={0.55} emissive="#00c9a7" emissiveIntensity={0.06 + body.vitality * 0.08} />
      </mesh>

      <mesh position={[0, 0.72, -0.18]} scale={[1.05 + body.risk * 0.18, 1.45 + body.risk * 0.1, 0.25]}>
        <sphereGeometry args={[1, 48, 24]} />
        <meshBasicMaterial color={riskColor} transparent opacity={0.055 + body.risk * 0.05} depthWrite={false} />
      </mesh>
    </group>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-center backdrop-blur-xl">
      <p className="font-mono text-sm font-semibold text-white">{value}</p>
      <p className="mt-0.5 text-[10px] uppercase tracking-[0.16em] text-white/40">{label}</p>
    </div>
  );
}

function getBodyState(
  baselineInputs: HealthInputs,
  simulatedInputs: HealthInputs,
  biologicalAge: number,
  healthScore: number
): BodyState {
  const bmi = getBmi(simulatedInputs);
  const baselineBmi = getBmi(baselineInputs);
  const exercise = simulatedInputs.exerciseDaysPerWeek / 7;
  const sleepRecovery = THREE.MathUtils.clamp((simulatedInputs.sleepHours - 4) / 5, 0, 1);
  const diet = (simulatedInputs.dietQuality - 1) / 4;
  const stress = (simulatedInputs.stressLevel - 1) / 4;
  const alcoholDrag = THREE.MathUtils.clamp(simulatedInputs.alcoholDrinksPerWeek / 21, 0, 1);
  const smokingDrag = simulatedInputs.smokingStatus === 'current' ? 0.26 : simulatedInputs.smokingStatus === 'former' ? 0.1 : 0;

  return {
    sex: baselineInputs.sex === 'female' ? 'female' : 'male',
    ageFactor: THREE.MathUtils.clamp((biologicalAge - 22) / 58, 0, 1),
    bmi,
    bodyMass: THREE.MathUtils.clamp((bmi - 19) / 16, 0, 1),
    muscle: THREE.MathUtils.clamp(0.18 + exercise * 0.52 + diet * 0.18 + sleepRecovery * 0.12 - stress * 0.08, 0.12, 0.92),
    posture: THREE.MathUtils.clamp(stress * 0.65 + (1 - sleepRecovery) * 0.28 + smokingDrag * 0.2, 0, 1),
    risk: THREE.MathUtils.clamp((100 - healthScore) / 100 + alcoholDrag * 0.08 + smokingDrag * 0.1 + Math.max(0, bmi - baselineBmi) / 80, 0, 1),
    vitality: THREE.MathUtils.clamp(healthScore / 100, 0, 1)
  };
}

function getRiskColor(risk: number) {
  if (risk < 0.34) return '#00c9a7';
  if (risk < 0.62) return '#f59e0b';
  return '#ef4444';
}
