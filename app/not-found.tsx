'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useTranslations } from 'next-intl'

const WAVE_BARS = 28

export default function NotFound() {
  const t = useTranslations('notFound')
  const [step, setStep] = useState(0)
  const [seconds, setSeconds] = useState(0)

  const transcript = useMemo(
    () => [
      { speaker: 'caller', text: t('line1') },
      { speaker: 'agent', text: t('line2') },
      { speaker: 'agent', text: t('line3') },
      { speaker: 'agent', text: t('line4') },
    ],
    [t],
  )

  const dropped = step >= transcript.length

  useEffect(() => {
    if (dropped) return
    const timer = setTimeout(() => setStep((s) => s + 1), step === 0 ? 350 : 1200)
    return () => clearTimeout(timer)
  }, [step, dropped])

  useEffect(() => {
    if (dropped) return
    const tick = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(tick)
  }, [dropped])

  const mm = String(Math.floor(seconds / 60)).padStart(2, '0')
  const ss = String(seconds % 60).padStart(2, '0')

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#fafafa] selection:bg-amber-500/30 overflow-hidden relative">
      {/* Grain texture */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.02]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Ambient glow — turns red when call drops */}
      <div
        className="fixed top-1/2 left-1/2 w-[700px] h-[700px] rounded-full pointer-events-none -translate-x-1/2 -translate-y-1/2 transition-all duration-1000"
        style={{
          background: dropped
            ? 'radial-gradient(circle, rgba(180,40,40,0.10) 0%, rgba(120,30,30,0.04) 40%, transparent 70%)'
            : 'radial-gradient(circle, rgba(180,100,40,0.12) 0%, rgba(120,60,30,0.04) 40%, transparent 70%)',
        }}
      />

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-sm bg-[#0a0a0a]/80">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 py-5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-xl tracking-tight font-medium">
            <Image
              src="/flow-io-logomark-gold.svg"
              alt="Flow-IO"
              width={28}
              height={28}
              className="w-7 h-7"
            />
            {t('brandName')}
          </Link>
          <div className="flex items-center gap-3 text-xs font-mono text-[#666]">
            <span
              className={`w-2 h-2 rounded-full transition-colors duration-500 ${
                dropped ? 'bg-red-500/90' : 'bg-amber-500 animate-pulse'
              }`}
            />
            <span className="tracking-[0.2em] uppercase">
              {dropped ? t('callEnded') : t('liveCall')}
            </span>
            <span className="tabular-nums text-[#444]">
              {mm}:{ss}
            </span>
          </div>
        </div>
      </header>

      <main className="relative min-h-screen flex items-center">
        <div className="max-w-5xl mx-auto px-6 lg:px-12 pt-28 pb-16 w-full">
          <div className="grid lg:grid-cols-[1fr_1.1fr] gap-12 lg:gap-20 items-center">
            {/* Left: 404 + copy */}
            <div className="space-y-8">
              <span className="text-xs tracking-[0.2em] uppercase text-amber-500 font-medium">
                {t('eyebrow')}
              </span>

              {/* Big 404 with subtle glitch */}
              <h1 className="font-serif text-[8rem] sm:text-[10rem] lg:text-[12rem] leading-none tracking-tight relative select-none">
                <span className={dropped ? 'glitch-on' : ''}>404</span>
              </h1>

              <h2 className="font-serif text-3xl sm:text-4xl leading-tight">
                {t('headline1')}
                <br />
                <span className="text-[#444]">{t('headline2')}</span>
              </h2>

              <p className="text-base text-[#999] max-w-md leading-relaxed">
                {t('description')}
              </p>

              <div className="flex flex-wrap items-center gap-4 pt-2">
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 px-6 py-3.5 bg-[#fafafa] text-[#0a0a0a] rounded-full font-medium hover:bg-amber-400 transition-all duration-300 hover:scale-105"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                  {t('redial')}
                </Link>
                <button
                  type="button"
                  onClick={() => history.back()}
                  className="text-sm text-[#666] hover:text-[#fafafa] transition-colors duration-300 underline underline-offset-4"
                >
                  {t('goBack')}
                </button>
              </div>
            </div>

            {/* Right: Waveform + transcript card */}
            <div className="relative">
              <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-2xl p-6 lg:p-8 space-y-6">
                {/* Waveform */}
                <div className="flex items-end justify-between h-20 gap-[3px]">
                  {Array.from({ length: WAVE_BARS }).map((_, i) => (
                    <span
                      key={i}
                      className={`flex-1 rounded-full transition-all duration-700 ease-out ${
                        dropped ? 'bg-red-500/60' : 'bg-amber-500/70 wave-bar'
                      }`}
                      style={{
                        height: dropped ? '2px' : undefined,
                        animationDelay: `${i * 60}ms`,
                      }}
                    />
                  ))}
                </div>

                <div className="h-px bg-[#1a1a1a]" />

                {/* Transcript */}
                <div className="space-y-3 font-mono text-sm min-h-[180px]">
                  {transcript.slice(0, step).map((line, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 fade-in"
                    >
                      <span
                        className={`text-xs tracking-[0.15em] uppercase mt-0.5 flex-shrink-0 w-16 ${
                          line.speaker === 'agent' ? 'text-amber-500' : 'text-[#555]'
                        }`}
                      >
                        {line.speaker === 'agent' ? t('agent') : t('caller')}
                      </span>
                      <span className="text-[#aaa] leading-relaxed">
                        {line.text}
                        {i === step - 1 && !dropped && (
                          <span className="inline-block w-1.5 h-4 bg-amber-500 ml-1 align-middle animate-pulse" />
                        )}
                      </span>
                    </div>
                  ))}

                  {dropped && (
                    <div className="pt-2 text-xs text-red-400/80 font-mono fade-in">
                      {t('disconnectedAt', { time: `${mm}:${ss}` })}
                    </div>
                  )}
                </div>
              </div>

              {/* Tag */}
              <div className="absolute -top-3 left-6 bg-[#0a0a0a] px-3 py-1 rounded-full border border-[#1a1a1a] text-[10px] font-mono tracking-[0.15em] uppercase text-[#666]">
                {t('transcriptLabel')}
              </div>
            </div>
          </div>
        </div>
      </main>

      <style jsx>{`
        @keyframes wave {
          0%, 100% { height: 6px; opacity: 0.6; }
          50% { height: 100%; opacity: 1; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes glitch {
          0%, 100% { transform: translate(0); text-shadow: none; }
          20% { transform: translate(-2px, 1px); text-shadow: 2px 0 rgba(239,68,68,0.6), -2px 0 rgba(245,158,11,0.4); }
          40% { transform: translate(2px, -1px); text-shadow: -2px 0 rgba(239,68,68,0.5), 2px 0 rgba(245,158,11,0.3); }
          60% { transform: translate(0, 1px); text-shadow: 1px 0 rgba(239,68,68,0.4); }
          80% { transform: translate(-1px, 0); text-shadow: none; }
        }
        .wave-bar {
          height: 6px;
          animation: wave 1.4s ease-in-out infinite;
        }
        .fade-in {
          animation: fadeIn 0.4s ease-out;
        }
        .glitch-on {
          display: inline-block;
          animation: glitch 1.6s steps(2, end) 1;
        }
      `}</style>
    </div>
  )
}
