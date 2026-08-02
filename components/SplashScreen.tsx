'use client'
import { useEffect, useState } from 'react'

export default function SplashScreen({ onFinish }: { onFinish: () => void }) {
  const [fadeOut, setFadeOut] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setFadeOut(true), 3500)
    const end = setTimeout(() => onFinish(), 4200)
    return () => { clearTimeout(timer); clearTimeout(end) }
  }, [onFinish])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'linear-gradient(180deg, #171717 0%, #1C1917 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
      opacity: fadeOut ? 0 : 1,
      transition: 'opacity 0.7s ease',
    }}>
      <style>{`
        @keyframes pulse-bg {
          0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.3; }
          50% { transform: translate(-50%, -50%) scale(1.15); opacity: 0.5; }
        }
        @keyframes letter-in {
          0% { transform: translateY(40px); opacity: 0; }
          60% { transform: translateY(-5px); opacity: 1; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes zoom-slow {
          from { transform: scale(1); }
          to { transform: scale(1.08); }
        }
        @keyframes glow-pulse {
          0%, 100% { opacity: 0.06; }
          50% { opacity: 0.12; }
        }
      `}</style>

      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        width: 500, height: 500, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(251,191,36,0.06) 0%, transparent 70%)',
        animation: 'pulse-bg 4s ease-in-out infinite',
      }} />

      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        width: 200, height: 200, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(251,191,36,0.08) 0%, transparent 60%)',
        animation: 'pulse-bg 3s ease-in-out infinite',
        animationDelay: '0.5s',
      }} />

      <div style={{
        animation: 'zoom-slow 4s ease-out forwards',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {'novacash'.split('').map((char, i) => (
          <span key={i} style={{
            fontFamily: 'system-ui, sans-serif',
            fontSize: 72, fontWeight: 700,
            color: '#FDE68A',
            letterSpacing: '-3px',
            display: 'inline-block',
            animation: `letter-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) ${0.2 + i * 0.12}s both`,
            textShadow: '0 0 40px rgba(253,230,138,0.15)',
          }}>
            {char}
          </span>
        ))}
      </div>
    </div>
  )
}
