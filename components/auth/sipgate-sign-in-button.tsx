'use client'

import { useState } from 'react'
import { signInWithSipgate } from '@/app/(auth)/actions'

interface SipgateSignInButtonProps {
  label: string
  loadingLabel: string
}

export function SipgateSignInButton({ label, loadingLabel }: SipgateSignInButtonProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handleClick = async () => {
    setIsLoading(true)
    try {
      await signInWithSipgate()
    } catch {
      setIsLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isLoading}
      className="w-full py-3.5 bg-[#1a1a1a] border border-[#2a2a2a] text-[#fafafa] rounded-xl font-medium hover:bg-[#222] hover:border-[#333] transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-3"
    >
      {/* sipgate logo */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/sipgate-logo.svg"
        alt=""
        aria-hidden="true"
        className="h-5 w-auto"
        style={{ filter: 'invert(1)' }}
      />
      {isLoading ? loadingLabel : label}
    </button>
  )
}
