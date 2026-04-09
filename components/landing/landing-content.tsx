'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { VoiceSphere } from './voice-sphere'
import { LanguageSwitcherCompact } from '@/components/language-switcher'

const GITHUB_URL = 'https://github.com/sipgate/flow-io'

export function LandingContent() {
  const t = useTranslations('landing')
  const [rotation, setRotation] = useState({ x: 0, y: 0 })

  const handleRotationChange = useCallback((newRotation: { x: number; y: number }) => {
    setRotation(newRotation)
  }, [])

  const glowOffsetX = -Math.sin(rotation.y) * 8
  const glowOffsetY = Math.sin(rotation.x) * 4
  const glowIntensity = 0.4 + Math.abs(Math.cos(rotation.y)) * 0.3

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#fafafa] selection:bg-amber-500/30 overflow-x-hidden">
      {/* Grain texture */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.02]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Ambient glow */}
      <div
        className="fixed w-[600px] h-[600px] rounded-full pointer-events-none transition-all duration-300"
        style={{
          top: `calc(50% + ${glowOffsetY}%)`,
          right: `calc(15% + ${glowOffsetX}%)`,
          transform: 'translate(50%, -50%)',
          background: `radial-gradient(circle, rgba(180,100,40,${0.12 * glowIntensity}) 0%, rgba(120,60,30,${0.04 * glowIntensity}) 40%, transparent 70%)`,
          opacity: glowIntensity,
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
          <nav className="flex items-center gap-6">
            <LanguageSwitcherCompact />
            <Link
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-[#888] hover:text-[#fafafa] transition-colors duration-300"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
              </svg>
              {t('github')}
            </Link>
            <Link
              href="/login"
              className="text-sm text-[#888] hover:text-[#fafafa] transition-colors duration-300"
            >
              {t('signIn')}
            </Link>
            <Link
              href="/signup"
              className="text-sm px-5 py-2.5 bg-[#fafafa] text-[#0a0a0a] rounded-full hover:bg-amber-400 transition-all duration-300 hover:scale-105"
            >
              {t('getStarted')}
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <main className="relative min-h-screen flex items-center">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 pt-28 pb-16 w-full">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
            {/* Left: Copy */}
            <div className="space-y-8 z-10">
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <span className="text-xs tracking-[0.2em] uppercase text-amber-500 font-medium">
                    {t('openSourceLabel')}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full border border-[#2a2a2a] text-[#666] font-mono">
                    {t('mitLicense')}
                  </span>
                </div>
                <h1 className="font-serif text-5xl sm:text-6xl lg:text-7xl leading-[1.05] tracking-tight">
                  {t('heroTitle1')}
                  <br />
                  <span className="text-[#444]">{t('heroTitle2')}</span>
                </h1>
              </div>
              <p className="text-lg text-[#999] max-w-md leading-relaxed">
                {t('heroDescription')}
              </p>
              <div className="flex flex-wrap items-center gap-4 pt-2">
                <Link
                  href={GITHUB_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-center gap-3"
                >
                  <span className="inline-flex items-center gap-2 px-6 py-3.5 bg-[#fafafa] text-[#0a0a0a] rounded-full font-medium group-hover:bg-amber-400 transition-all duration-300 group-hover:scale-105">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
                    </svg>
                    {t('viewOnGithub')}
                  </span>
                </Link>
                <Link
                  href="/signup"
                  className="text-sm text-[#666] hover:text-[#fafafa] transition-colors duration-300 underline underline-offset-4"
                >
                  {t('tryHosted')}
                </Link>
              </div>
            </div>

            {/* Right: Voice Visualization */}
            <div className="relative flex items-center justify-center lg:justify-end">
              <div className="w-[350px] h-[350px] sm:w-[450px] sm:h-[450px] lg:w-[500px] lg:h-[500px]">
                <VoiceSphere onRotationChange={handleRotationChange} />
              </div>
            </div>
          </div>

          {/* Core pillars */}
          <div className="grid md:grid-cols-3 gap-px bg-[#1a1a1a] mt-24 rounded-2xl overflow-hidden">
            {[
              {
                num: '01',
                title: t('pillar1Title'),
                description: t('pillar1Desc'),
              },
              {
                num: '02',
                title: t('pillar2Title'),
                description: t('pillar2Desc'),
              },
              {
                num: '03',
                title: t('pillar3Title'),
                description: t('pillar3Desc'),
              },
            ].map((pillar, i) => (
              <div
                key={i}
                className="bg-[#0a0a0a] p-8 lg:p-10 group hover:bg-[#0f0f0f] transition-all duration-500"
              >
                <div className="flex items-start justify-between mb-6">
                  <span className="text-xs text-[#444] font-mono">{pillar.num}</span>
                  <span className="w-2 h-2 rounded-full bg-[#222] group-hover:bg-amber-500 transition-all duration-500 group-hover:shadow-[0_0_10px_rgba(245,158,11,0.5)]" />
                </div>
                <h3 className="font-serif text-xl mb-3 group-hover:text-amber-50 transition-colors duration-500">{pillar.title}</h3>
                <p className="text-sm text-[#777] leading-relaxed group-hover:text-[#999] transition-colors duration-500">{pillar.description}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* How It Works */}
      <section className="relative py-32 border-t border-[#151515]">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="max-w-2xl mb-20">
            <p className="text-sm tracking-[0.2em] uppercase text-amber-500 font-medium mb-6">
              {t('howItWorks')}
            </p>
            <h2 className="font-serif text-4xl lg:text-5xl leading-tight">
              {t('liveInMinutes')}
              <br />
              <span className="text-[#444]">{t('notMonths')}</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-12 lg:gap-16">
            {[
              {
                step: '01',
                title: t('step1Title'),
                description: t('step1Desc'),
                detail: t('step1Detail'),
              },
              {
                step: '02',
                title: t('step2Title'),
                description: t('step2Desc'),
                detail: t('step2Detail'),
              },
              {
                step: '03',
                title: t('step3Title'),
                description: t('step3Desc'),
                detail: t('step3Detail'),
              },
            ].map((item, i) => (
              <div key={i} className="relative">
                <div className="text-6xl lg:text-7xl font-serif text-[#1a1a1a] mb-6">{item.step}</div>
                <h3 className="font-serif text-xl mb-3">{item.title}</h3>
                <p className="text-sm text-[#777] leading-relaxed mb-3">{item.description}</p>
                <p className="text-xs text-[#555] font-mono">{item.detail}</p>
                {i < 2 && (
                  <div className="hidden md:block absolute top-8 right-0 translate-x-1/2 w-16 h-px bg-gradient-to-r from-[#222] to-transparent" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Capabilities */}
      <section className="relative py-32 border-t border-[#151515]">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="max-w-2xl mb-20">
            <p className="text-sm tracking-[0.2em] uppercase text-amber-500 font-medium mb-6">
              {t('capabilities')}
            </p>
            <h2 className="font-serif text-4xl lg:text-5xl leading-tight mb-6">
              {t('everythingYouNeed')}
              <br />
              <span className="text-[#444]">{t('nothingYouDontNeed')} </span>
            </h2>
            <p className="text-[#888] leading-relaxed">
              {t('capabilitiesDesc')}
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {[
              {
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                ),
                title: t('cap1Title'),
                description: t('cap1Desc'),
              },
              {
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
                  </svg>
                ),
                title: t('cap2Title'),
                description: t('cap2Desc'),
              },
              {
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                ),
                title: t('cap3Title'),
                description: t('cap3Desc'),
              },
              {
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                ),
                title: t('cap4Title'),
                description: t('cap4Desc'),
              },
            ].map((cap, i) => (
              <div
                key={i}
                className="group relative bg-[#0f0f0f] border border-[#1a1a1a] rounded-2xl p-8 hover:border-[#2a2a2a] transition-all duration-500"
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-[#151515] border border-[#222] flex items-center justify-center flex-shrink-0 text-[#555] group-hover:text-amber-500 group-hover:border-amber-500/30 transition-all duration-500">
                    {cap.icon}
                  </div>
                  <div>
                    <h3 className="font-serif text-lg mb-2 group-hover:text-amber-50 transition-colors duration-500">{cap.title}</h3>
                    <p className="text-sm text-[#777] leading-relaxed">{cap.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Flow-IO - OSS positioning */}
      <section className="relative py-32 border-t border-[#151515]">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="max-w-2xl mb-20">
            <p className="text-sm tracking-[0.2em] uppercase text-amber-500 font-medium mb-6">
              {t('whyFlow-IO')}
            </p>
            <h2 className="font-serif text-4xl lg:text-5xl leading-tight mb-6">
              {t('notABlackBox')}
              <br />
              <span className="text-[#444]">{t('youOwnIt')}</span>
            </h2>
            <p className="text-[#888] leading-relaxed">
              {t('whyDescription')}
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {[
              {
                tag: t('vsTagSipgate'),
                title: t('vs1Title'),
                them: t('vs1Them'),
                us: t('vs1Us'),
              },
              {
                tag: t('vsTagPlatforms'),
                title: t('vs2Title'),
                them: t('vs2Them'),
                us: t('vs2Us'),
              },
              {
                tag: t('vsTagSelfHost'),
                title: t('vs3Title'),
                them: t('vs3Them'),
                us: t('vs3Us'),
              },
            ].map((item, i) => (
              <div key={i} className="group bg-[#0f0f0f] border border-[#1a1a1a] rounded-2xl p-8 hover:border-[#252525] transition-all duration-500">
                <div className="text-xs tracking-[0.15em] uppercase text-[#444] font-medium mb-6">{item.tag}</div>
                <h3 className="font-serif text-xl mb-6 group-hover:text-amber-50 transition-colors duration-500">{item.title}</h3>
                <div className="space-y-3">
                  <div className="flex items-start gap-3 text-sm">
                    <span className="text-[#555] mt-0.5 flex-shrink-0">✕</span>
                    <span className="text-[#666]">{item.them}</span>
                  </div>
                  <div className="flex items-start gap-3 text-sm">
                    <span className="text-amber-500 mt-0.5 flex-shrink-0">✓</span>
                    <span className="text-[#aaa]">{item.us}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative py-32 border-t border-[#151515]">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="font-serif text-4xl lg:text-5xl leading-tight mb-6">
              {t('ctaTitle1')}
              <br />
              <span className="text-[#444]">{t('ctaTitle2')}</span>
            </h2>
            <p className="text-[#888] leading-relaxed mb-10 max-w-lg mx-auto">
              {t('ctaDescription')}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-8 py-4 bg-[#fafafa] text-[#0a0a0a] rounded-full font-medium hover:bg-amber-400 transition-all duration-300 hover:scale-105"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
                </svg>
                {t('starOnGithub')}
              </Link>
              <Link
                href="/signup"
                className="px-8 py-4 text-[#888] hover:text-[#fafafa] transition-colors duration-300"
              >
                {t('tryHosted')}
              </Link>
            </div>
            <p className="text-xs text-[#555] mt-8 font-mono">
              {t('selfHostNote')}
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#151515]">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 py-8 flex items-center justify-between">
          <p className="text-xs text-[#666]">
            {t('builtWith')}
          </p>
          <p className="text-xs text-[#666]">
            {t('copyright', { year: new Date().getFullYear() })}
          </p>
        </div>
      </footer>
    </div>
  )
}
