import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { getTranslations } from 'next-intl/server'

export const metadata: Metadata = {
  title: 'Authentication - Flow-IO',
  description: 'Sign in to your Flow-IO account',
}

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const t = await getTranslations('authLayout')
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#fafafa] selection:bg-amber-500/30 overflow-hidden">
      {/* Subtle grain texture overlay */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.02]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Ambient glow - top right */}
      <div
        className="fixed w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{
          top: '-10%',
          right: '-5%',
          background: 'radial-gradient(circle, rgba(180,100,40,0.08) 0%, rgba(120,60,30,0.03) 40%, transparent 70%)',
        }}
      />

      {/* Ambient glow - bottom left */}
      <div
        className="fixed w-[400px] h-[400px] rounded-full pointer-events-none"
        style={{
          bottom: '-5%',
          left: '-5%',
          background: 'radial-gradient(circle, rgba(150,80,40,0.05) 0%, transparent 60%)',
        }}
      />

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-xl tracking-tight font-medium hover:text-amber-400 transition-colors duration-300">
            <Image
              src="/flow-io-logomark-gold.svg"
              alt="Flow-IO"
              width={28}
              height={28}
              className="w-7 h-7"
            />
            {t('brandName')}
          </Link>
        </div>
      </header>

      {/* Content */}
      <div className="min-h-screen flex items-center justify-center p-6 pt-24">
        <div className="w-full max-w-md relative z-10">
          {children}
        </div>
      </div>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-center">
          <p className="text-xs text-[#444]">
            {t('copyright', { year: new Date().getFullYear() })}
          </p>
        </div>
      </footer>
    </div>
  )
}
