'use client'

import { createContext, useContext } from 'react'
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from '@xyflow/react'
import { Pencil } from 'lucide-react'

/** Context to pass the key-assignment callback into the custom edge component.
 *  x/y are screen coordinates of the badge (for positioning the keypad wheel). */
export const DTMFEdgeClickContext = createContext<(edgeId: string, currentLabel: string, x: number, y: number) => void>(() => {})

export function DTMFMenuEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  label,
  style,
  markerEnd,
}: EdgeProps) {
  const openDialog = useContext(DTMFEdgeClickContext)

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  const hasKey = label !== undefined && label !== null && label !== ''

  return (
    <>
      <BaseEdge
        path={edgePath}
        style={{ ...style, stroke: hasKey ? '#a855f7' : '#f59e0b', strokeWidth: 2 }}
        markerEnd={markerEnd}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}
          className="absolute nodrag nopan"
        >
          <button
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect()
              openDialog(id, String(label ?? ''), rect.left + rect.width / 2, rect.top + rect.height / 2)
            }}
            title={hasKey ? `Taste: ${label} — klicken zum Ändern` : 'Taste zuweisen'}
            className={`
              min-w-6 h-6 px-1.5 rounded flex items-center justify-center
              text-xs font-mono font-bold shadow-sm cursor-pointer transition-colors
              ${hasKey
                ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-700 hover:bg-purple-200 dark:hover:bg-purple-900'
                : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700 hover:bg-amber-200 dark:hover:bg-amber-900 animate-pulse'
              }
            `}
          >
            {hasKey ? String(label) : <Pencil className="h-3 w-3" />}
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  )
}
