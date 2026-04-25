'use client';

import { motion } from 'framer-motion';

export type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error';

interface AIOrbProps {
  state: OrbState;
  size?: 'sm' | 'md' | 'lg';
}

const STATE_TONE: Record<OrbState, { glow: string; halo: string; tempo: number; opacity: number }> = {
  idle: { glow: 'rgba(34, 211, 238, 0.26)', halo: 'rgba(45, 212, 191, 0.48)', tempo: 3.2, opacity: 0.82 },
  listening: { glow: 'rgba(45, 212, 191, 0.46)', halo: 'rgba(103, 232, 249, 0.78)', tempo: 1.65, opacity: 0.96 },
  thinking: { glow: 'rgba(96, 165, 250, 0.38)', halo: 'rgba(129, 140, 248, 0.62)', tempo: 2.1, opacity: 0.9 },
  speaking: { glow: 'rgba(16, 185, 129, 0.52)', halo: 'rgba(52, 211, 153, 0.86)', tempo: 1.05, opacity: 1 },
  error: { glow: 'rgba(248, 113, 113, 0.42)', halo: 'rgba(251, 113, 133, 0.78)', tempo: 1.4, opacity: 0.94 }
};

const SIZE_CLASS = {
  sm: 'h-14 w-14',
  md: 'h-[4.5rem] w-[4.5rem]',
  lg: 'h-24 w-24'
};

const BAR_HEIGHTS = [11, 18, 27, 35, 27, 18, 11];

export function AIOrb({ state, size = 'md' }: AIOrbProps) {
  const tone = STATE_TONE[state];
  const active = state !== 'idle';

  return (
    <motion.div
      role="status"
      aria-label={`AI voice orb ${state}`}
      className={`relative ${SIZE_CLASS[size]} rounded-full`}
      initial={false}
      animate={{
        opacity: tone.opacity,
        scale: state === 'speaking' ? [0.92, 1.08, 0.94, 1.04, 0.92] : [0.92, 1.08, 0.92]
      }}
      transition={{ duration: tone.tempo, repeat: Infinity, ease: 'easeInOut' }}
    >
      <motion.span
        className="absolute inset-[-18%] rounded-full blur-xl"
        style={{ background: tone.glow }}
        animate={{ opacity: active ? [0.5, 0.95, 0.5] : [0.28, 0.58, 0.28], scale: active ? [0.92, 1.28, 0.92] : [0.96, 1.12, 0.96] }}
        transition={{ duration: tone.tempo, repeat: Infinity, ease: 'easeInOut' }}
      />

      <motion.span
        className="absolute inset-[-5%] rounded-full"
        style={{
          background: `conic-gradient(from 0deg, transparent 0deg, ${tone.halo} 70deg, rgba(167, 243, 208, 0.22) 120deg, transparent 170deg, rgba(125, 211, 252, 0.55) 250deg, transparent 320deg)`
        }}
        animate={{ rotate: state === 'listening' ? -360 : 360 }}
        transition={{ duration: state === 'thinking' ? 3.4 : 6.8, repeat: Infinity, ease: 'linear' }}
      />

      <div className="absolute inset-[3px] overflow-hidden rounded-full border border-white/15 bg-navy-950 shadow-[inset_0_0_22px_rgba(255,255,255,0.12),0_12px_34px_rgba(2,6,23,0.28)]">
        <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_34%_24%,rgba(255,255,255,0.88),transparent_18%),radial-gradient(circle_at_55%_58%,rgba(20,184,166,0.5),transparent_45%),radial-gradient(circle_at_70%_74%,rgba(96,165,250,0.36),transparent_42%)]" />

        <motion.span
          className="absolute left-[-20%] top-[8%] h-2/3 w-2/3 rounded-full bg-cyan-300/55 blur-lg"
          animate={{ x: active ? ['0%', '44%', '10%', '0%'] : ['0%', '18%', '0%'], y: active ? ['0%', '18%', '-8%', '0%'] : ['0%', '8%', '0%'], opacity: active ? [0.28, 0.68, 0.32] : [0.18, 0.34, 0.18] }}
          transition={{ duration: state === 'speaking' ? 2.2 : 6.2, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.span
          className="absolute right-[-22%] top-[-12%] h-3/4 w-3/4 rounded-full bg-violet-400/35 blur-lg"
          animate={{ rotate: [0, 180, 360], x: active ? ['0%', '-30%', '0%'] : ['0%', '-10%', '0%'], opacity: active ? [0.18, 0.46, 0.18] : [0.12, 0.24, 0.12] }}
          transition={{ duration: 7.8, repeat: Infinity, ease: 'linear' }}
        />
        <motion.span
          className="absolute bottom-[-20%] left-[22%] h-2/3 w-2/3 rounded-full bg-emerald-300/48 blur-lg"
          animate={{ x: active ? ['0%', '18%', '-18%', '0%'] : ['0%', '-8%', '0%'], y: active ? ['0%', '-24%', '-6%', '0%'] : ['0%', '-8%', '0%'], opacity: active ? [0.22, 0.56, 0.24] : [0.14, 0.28, 0.14] }}
          transition={{ duration: state === 'speaking' ? 1.9 : 5.8, repeat: Infinity, ease: 'easeInOut' }}
        />

        <motion.span
          className="absolute inset-[18%] rounded-full border border-white/15"
          animate={{ rotate: -360, opacity: active ? [0.24, 0.54, 0.24] : [0.12, 0.26, 0.12] }}
          transition={{ duration: 5.6, repeat: Infinity, ease: 'linear' }}
        />

        <div className="absolute inset-0 flex items-center justify-center gap-[2px]">
          {BAR_HEIGHTS.map((height, index) => (
            <motion.span
              key={height + index}
              className="w-[2px] rounded-full bg-cyan-50/90 shadow-[0_0_10px_rgba(165,243,252,0.75)]"
              animate={{
                height:
                  state === 'speaking'
                    ? [height * 0.6, height, height * 0.48, height * 0.86]
                    : state === 'listening'
                      ? [height * 0.42, height * 0.92, height * 0.54]
                      : state === 'thinking'
                        ? [height * 0.32, height * 0.66, height * 0.32]
                        : [height * 0.22, height * 0.32, height * 0.22]
              }}
              transition={{ duration: state === 'speaking' ? 0.58 : 1.2, repeat: Infinity, delay: index * 0.045, ease: 'easeInOut' }}
            />
          ))}
        </div>
      </div>

      {state === 'speaking'
        ? [0, 1, 2].map((index) => (
            <motion.span
              key={index}
              className="absolute inset-[-8%] rounded-full border border-emerald-200/45"
              animate={{ opacity: [0.42, 0], scale: [0.78, 1.45] }}
              transition={{ duration: 1.45, repeat: Infinity, delay: index * 0.28, ease: 'easeOut' }}
            />
          ))
        : null}
    </motion.div>
  );
}
