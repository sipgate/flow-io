'use client'

export function VoiceOrb() {
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {/* Outer glow */}
      <div className="absolute w-64 h-64 rounded-full bg-amber-500/20 blur-3xl animate-pulse" />

      {/* Pulsing rings */}
      {[...Array(4)].map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full border border-amber-500/20"
          style={{
            width: `${180 + i * 60}px`,
            height: `${180 + i * 60}px`,
            animation: `ping ${3 + i * 0.5}s cubic-bezier(0, 0, 0.2, 1) infinite`,
            animationDelay: `${i * 0.4}s`,
          }}
        />
      ))}

      {/* Orbital rings */}
      <div
        className="absolute w-72 h-72 rounded-full border border-amber-500/30"
        style={{
          animation: 'spin 20s linear infinite',
          transform: 'rotateX(70deg)',
        }}
      />
      <div
        className="absolute w-80 h-80 rounded-full border border-amber-500/20"
        style={{
          animation: 'spin 25s linear infinite reverse',
          transform: 'rotateX(70deg) rotateY(20deg)',
        }}
      />
      <div
        className="absolute w-88 h-88 rounded-full border border-amber-500/10"
        style={{
          width: '340px',
          height: '340px',
          animation: 'spin 30s linear infinite',
          transform: 'rotateX(60deg) rotateY(-30deg)',
        }}
      />

      {/* Main orb */}
      <div className="relative">
        {/* Gradient sphere */}
        <div
          className="w-32 h-32 rounded-full relative overflow-hidden"
          style={{
            background: 'radial-gradient(circle at 30% 30%, #fbbf24, #d97706 50%, #1a1a1a 100%)',
            boxShadow: '0 0 60px rgba(251, 191, 36, 0.4), inset -20px -20px 40px rgba(0,0,0,0.6)',
          }}
        >
          {/* Highlight */}
          <div
            className="absolute top-4 left-4 w-8 h-8 rounded-full bg-white/30 blur-sm"
          />
        </div>

        {/* Outer glow ring */}
        <div
          className="absolute inset-0 rounded-full animate-ping"
          style={{
            background: 'radial-gradient(circle, rgba(251,191,36,0.3) 0%, transparent 70%)',
            animation: 'pulse 2s ease-in-out infinite',
          }}
        />
      </div>

      {/* Floating particles */}
      {[...Array(12)].map((_, i) => (
        <div
          key={`particle-${i}`}
          className="absolute w-1.5 h-1.5 rounded-full bg-amber-400"
          style={{
            top: `${50 + Math.sin(i * 30 * Math.PI / 180) * 40}%`,
            left: `${50 + Math.cos(i * 30 * Math.PI / 180) * 40}%`,
            animation: `float ${3 + (i % 3)}s ease-in-out infinite`,
            animationDelay: `${i * 0.2}s`,
            opacity: 0.6,
          }}
        />
      ))}

      {/* Sound wave bars */}
      <div className="absolute flex items-center justify-center gap-1">
        {[...Array(5)].map((_, i) => (
          <div
            key={`bar-${i}`}
            className="w-1 bg-amber-500/60 rounded-full"
            style={{
              animation: `soundBar 1s ease-in-out infinite`,
              animationDelay: `${i * 0.1}s`,
            }}
          />
        ))}
      </div>

      <style jsx>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0) scale(1);
            opacity: 0.6;
          }
          50% {
            transform: translateY(-10px) scale(1.2);
            opacity: 1;
          }
        }

        @keyframes soundBar {
          0%, 100% {
            height: 20px;
          }
          50% {
            height: 50px;
          }
        }

        @keyframes spin {
          from {
            transform: rotateX(70deg) rotateZ(0deg);
          }
          to {
            transform: rotateX(70deg) rotateZ(360deg);
          }
        }

        @keyframes ping {
          0% {
            transform: scale(1);
            opacity: 0.3;
          }
          75%, 100% {
            transform: scale(1.2);
            opacity: 0;
          }
        }

        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
            opacity: 0.5;
          }
          50% {
            transform: scale(1.1);
            opacity: 0.8;
          }
        }
      `}</style>
    </div>
  )
}
