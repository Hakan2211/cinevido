import { useId } from 'react'
import { motion } from 'framer-motion'

interface LogoProps {
  className?: string
  size?: number
  animate?: boolean
}

export function Logo({ className, size = 48, animate = true }: LogoProps) {
  // Generate unique IDs for gradients to support multiple instances
  const id = useId()
  const outerRingId = `outerRingGradient-${id}`
  const middleRingId = `middleRingGradient-${id}`
  const innerRingId = `innerRingGradient-${id}`
  const centerSphereId = `centerSphereGradient-${id}`
  const highlightId = `highlightGradient-${id}`
  const shineId = `shineGradient-${id}`
  const clipId = `logoClip-${id}`

  // Animation variants
  const ringRotation = animate
    ? {
        animate: { rotate: 720 },
        transition: { duration: 2.5, ease: 'easeInOut' as const },
      }
    : {}

  const centerPulse = animate
    ? {
        animate: { scale: [1, 1.08, 1, 1.08, 1] },
        transition: { duration: 2, ease: 'easeInOut' as const },
      }
    : {}

  const shineAnimation = animate
    ? {
        animate: { x: [-30, 130], opacity: [0, 0.6, 0] },
        transition: { duration: 1.5, delay: 0.5, ease: 'easeInOut' as const },
      }
    : { initial: { opacity: 0 } }

  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        {/* Clip path for shine effect */}
        <clipPath id={clipId}>
          <circle cx="50" cy="50" r="48" />
        </clipPath>

        {/* Outer ring gradient - dark navy with subtle shine */}
        <radialGradient
          id={outerRingId}
          cx="30%"
          cy="30%"
          r="70%"
          fx="30%"
          fy="30%"
        >
          <stop offset="0%" stopColor="#2D3E50" />
          <stop offset="50%" stopColor="#1B263B" />
          <stop offset="100%" stopColor="#0D1B2A" />
        </radialGradient>

        {/* Middle ring gradient - deep black */}
        <radialGradient
          id={middleRingId}
          cx="35%"
          cy="35%"
          r="65%"
          fx="35%"
          fy="35%"
        >
          <stop offset="0%" stopColor="#1A1A1A" />
          <stop offset="60%" stopColor="#0A0A0A" />
          <stop offset="100%" stopColor="#050505" />
        </radialGradient>

        {/* Inner ring gradient - deep navy blue */}
        <radialGradient
          id={innerRingId}
          cx="40%"
          cy="40%"
          r="60%"
          fx="40%"
          fy="40%"
        >
          <stop offset="0%" stopColor="#1B263B" />
          <stop offset="70%" stopColor="#0D1B2A" />
          <stop offset="100%" stopColor="#070D14" />
        </radialGradient>

        {/* Center sphere gradient - orange with glossy effect */}
        <radialGradient
          id={centerSphereId}
          cx="40%"
          cy="35%"
          r="60%"
          fx="40%"
          fy="35%"
        >
          <stop offset="0%" stopColor="#FFA726" />
          <stop offset="40%" stopColor="#FF8C00" />
          <stop offset="80%" stopColor="#E65100" />
          <stop offset="100%" stopColor="#BF360C" />
        </radialGradient>

        {/* Highlight spot for glossy effect */}
        <radialGradient
          id={highlightId}
          cx="50%"
          cy="50%"
          r="50%"
          fx="50%"
          fy="50%"
        >
          <stop offset="0%" stopColor="white" stopOpacity="0.6" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>

        {/* Shine sweep gradient */}
        <linearGradient id={shineId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="white" stopOpacity="0" />
          <stop offset="50%" stopColor="white" stopOpacity="0.8" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Outer ring - dark navy with rotation */}
      <motion.circle
        cx="50"
        cy="50"
        r="48"
        fill={`url(#${outerRingId})`}
        style={{ originX: '50px', originY: '50px' }}
        {...ringRotation}
      />

      {/* Middle ring - black with rotation */}
      <motion.circle
        cx="50"
        cy="50"
        r="40"
        fill={`url(#${middleRingId})`}
        style={{ originX: '50px', originY: '50px' }}
        {...(animate
          ? {
              animate: { rotate: -720 },
              transition: { duration: 2.5, ease: 'easeInOut' as const },
            }
          : {})}
      />

      {/* Inner ring - deep navy */}
      <motion.circle
        cx="50"
        cy="50"
        r="32"
        fill={`url(#${innerRingId})`}
        style={{ originX: '50px', originY: '50px' }}
        {...ringRotation}
      />

      {/* Center orange sphere with pulse */}
      <motion.circle
        cx="50"
        cy="50"
        r="22"
        fill={`url(#${centerSphereId})`}
        style={{ originX: '50px', originY: '50px' }}
        {...centerPulse}
      />

      {/* Glossy highlight on sphere */}
      <motion.ellipse
        cx="44"
        cy="44"
        rx="8"
        ry="6"
        fill={`url(#${highlightId})`}
        style={{ originX: '50px', originY: '50px' }}
        {...centerPulse}
      />

      {/* Shine sweep effect */}
      <motion.rect
        x="-30"
        y="10"
        width="30"
        height="80"
        fill={`url(#${shineId})`}
        clipPath={`url(#${clipId})`}
        initial={{ x: -30, opacity: 0 }}
        {...shineAnimation}
      />
    </motion.svg>
  )
}
