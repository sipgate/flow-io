import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Flow-IO Design System",
  description: "Carbon + Lime — 2026 Design System Showcase",
}

export default function DesignLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
