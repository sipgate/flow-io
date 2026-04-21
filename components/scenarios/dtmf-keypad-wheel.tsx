'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '*', '#']
const RADIUS = 72

interface DTMFKeypadWheelProps {
  /** Screen X coordinate of the badge that was clicked */
  x: number
  /** Screen Y coordinate of the badge that was clicked */
  y: number
  /** Currently assigned key (highlighted in the wheel) */
  currentLabel: string
  /** Keys already assigned to other edges from the same node — shown disabled */
  usedKeys: string[]
  onSelect: (key: string) => void
  onClear: () => void
  onClose: () => void
}

export function DTMFKeypadWheel({ x, y, currentLabel, usedKeys, onSelect, onClear, onClose }: DTMFKeypadWheelProps) {
  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const outerR = RADIUS + 26

  return (
    // Full-screen backdrop — click outside closes without saving
    <div className="fixed inset-0 z-50" onMouseDown={onClose}>
      {/* Wheel container — stop propagation so clicks inside don't dismiss */}
      <div
        className="absolute"
        style={{ left: x, top: y }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Circular backdrop */}
        <div
          className="absolute rounded-full bg-white/90 dark:bg-neutral-900/90 backdrop-blur-sm border border-purple-200 dark:border-purple-800 shadow-2xl"
          style={{
            width: outerR * 2,
            height: outerR * 2,
            transform: 'translate(-50%, -50%)',
          }}
        />

        {/* Center — clear button */}
        <button
          className="absolute z-10 w-10 h-10 rounded-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 flex items-center justify-center hover:bg-red-50 dark:hover:bg-red-950 hover:border-red-300 transition-colors"
          style={{ transform: 'translate(-50%, -50%)' }}
          onClick={onClear}
          title="Taste entfernen"
        >
          <X className="h-4 w-4 text-neutral-400" />
        </button>

        {/* Keys arranged in a circle */}
        {KEYS.map((key, i) => {
          const angle = (i * (360 / 12) - 90) * (Math.PI / 180)
          const kx = Math.cos(angle) * RADIUS
          const ky = Math.sin(angle) * RADIUS
          const isActive = currentLabel === key
          const isUsed = usedKeys.includes(key)

          return (
            <button
              key={key}
              disabled={isUsed}
              className={cn(
                'absolute w-9 h-9 rounded-full font-mono font-bold text-sm shadow-md transition-all duration-100',
                isActive
                  ? 'bg-purple-600 dark:bg-purple-500 text-white border-2 border-purple-400 scale-115'
                  : isUsed
                    ? 'bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-300 dark:text-neutral-600 cursor-not-allowed shadow-none'
                    : 'bg-white dark:bg-neutral-800 border border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900 hover:scale-110'
              )}
              style={{ transform: `translate(calc(-50% + ${kx}px), calc(-50% + ${ky}px))` }}
              onClick={() => !isUsed && onSelect(key)}
            >
              {key}
            </button>
          )
        })}
      </div>
    </div>
  )
}
