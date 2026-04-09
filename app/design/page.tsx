"use client"

import { useState } from "react"
import {
  Moon, Sun, Bot, Phone, GitBranch, Layers, MessageSquare,
  FlaskConical, Cable, BarChart3, Settings, LayoutDashboard,
  Plus, Trash2, Pencil, Loader2, Activity, Clock, TrendingUp,
  Variable, Zap, CheckCircle2, XCircle, AlertTriangle,
  Search, Download, ArrowLeft, Star, Check, X,
} from "lucide-react"

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type Section = {
  id: string
  label: string
}

// ─────────────────────────────────────────────
// Minimal UI primitives (inline, no imports needed)
// ─────────────────────────────────────────────
function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(" ")
}

// ─────────────────────────────────────────────
// Design tokens (as JS constants for showcase)
// ─────────────────────────────────────────────
const BRAND_COLORS = [
  { name: "brand-50", light: "#f7fee7", dark: "#1a2e05", tailwind: "bg-lime-50 dark:bg-lime-950" },
  { name: "brand-100", light: "#ecfccb", dark: "#1e3a0a", tailwind: "bg-lime-100 dark:bg-lime-900" },
  { name: "brand-200", light: "#d9f99d", dark: "#2d5016", tailwind: "bg-lime-200 dark:bg-lime-800" },
  { name: "brand-300", light: "#bef264", dark: "#3f6b1e", tailwind: "bg-lime-300 dark:bg-lime-700" },
  { name: "brand-400", light: "#a3e635", dark: "#65a30d", tailwind: "bg-lime-400" },
  { name: "brand-500", light: "#84cc16", dark: "#84cc16", tailwind: "bg-lime-500" },
  { name: "brand-600", light: "#65a30d", dark: "#4d7c0f", tailwind: "bg-lime-600" },
  { name: "brand-700", light: "#4d7c0f", dark: "#365314", tailwind: "bg-lime-700 dark:bg-lime-800" },
]

const ACCENT_COLORS = [
  { name: "accent-300", light: "#d8b4fe", dark: "#d8b4fe", tailwind: "bg-purple-300" },
  { name: "accent-400", light: "#c084fc", dark: "#c084fc", tailwind: "bg-purple-400" },
  { name: "accent-500", light: "#a855f7", dark: "#a855f7", tailwind: "bg-purple-500" },
  { name: "accent-600", light: "#9333ea", dark: "#7e22ce", tailwind: "bg-purple-600" },
  { name: "accent-700", light: "#7e22ce", dark: "#6b21a8", tailwind: "bg-purple-700" },
]

const NEUTRAL_COLORS = [
  { name: "neutral-50", light: "#fafafa", dark: "#0a0a0a", tailwind: "bg-neutral-50 dark:bg-neutral-950" },
  { name: "neutral-100", light: "#f5f5f5", dark: "#171717", tailwind: "bg-neutral-100 dark:bg-neutral-900" },
  { name: "neutral-200", light: "#e5e5e5", dark: "#262626", tailwind: "bg-neutral-200 dark:bg-neutral-800" },
  { name: "neutral-300", light: "#d4d4d4", dark: "#404040", tailwind: "bg-neutral-300 dark:bg-neutral-700" },
  { name: "neutral-400", light: "#a3a3a3", dark: "#525252", tailwind: "bg-neutral-400 dark:bg-neutral-600" },
  { name: "neutral-500", light: "#737373", dark: "#737373", tailwind: "bg-neutral-500" },
  { name: "neutral-700", light: "#404040", dark: "#a3a3a3", tailwind: "bg-neutral-700 dark:bg-neutral-300" },
  { name: "neutral-900", light: "#171717", dark: "#e5e5e5", tailwind: "bg-neutral-900 dark:bg-neutral-100" },
  { name: "neutral-950", light: "#0a0a0a", dark: "#fafafa", tailwind: "bg-neutral-950 dark:bg-neutral-50" },
]

const SEMANTIC_COLORS = [
  { name: "success", label: "Active / Success", bg: "bg-lime-500/10", text: "text-lime-700 dark:text-lime-400" },
  { name: "warning", label: "Pending / Warning", bg: "bg-amber-500/10", text: "text-amber-700 dark:text-amber-400" },
  { name: "danger", label: "Error / Danger", bg: "bg-red-500/10", text: "text-red-600 dark:text-red-400" },
  { name: "info", label: "Info / Processing", bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400" },
  { name: "inactive", label: "Inactive / Muted", bg: "bg-neutral-100 dark:bg-neutral-800", text: "text-neutral-600 dark:text-neutral-400" },
]

const TYPE_SCALE = [
  { name: "display-lg", size: "48px / 3rem", weight: "700", lh: "1.10", ls: "-0.03em", cls: "text-5xl font-bold leading-[1.10] tracking-[-0.03em]", sample: "Display Large" },
  { name: "display-sm", size: "36px / 2.25rem", weight: "700", lh: "1.15", ls: "-0.025em", cls: "text-4xl font-bold leading-[1.15] tracking-[-0.025em]", sample: "Display Small" },
  { name: "heading-xl", size: "30px / 1.875rem", weight: "700", lh: "1.20", ls: "-0.02em", cls: "text-3xl font-bold tracking-tight", sample: "Heading XL" },
  { name: "heading-lg", size: "24px / 1.5rem", weight: "600", lh: "1.25", ls: "-0.015em", cls: "text-2xl font-semibold tracking-tight", sample: "Heading Large" },
  { name: "heading-md", size: "20px / 1.25rem", weight: "600", lh: "1.30", ls: "-0.01em", cls: "text-xl font-semibold", sample: "Heading Medium" },
  { name: "heading-sm", size: "18px / 1.125rem", weight: "600", lh: "1.35", ls: "-0.005em", cls: "text-lg font-semibold", sample: "Heading Small" },
  { name: "body-lg", size: "16px / 1rem", weight: "400", lh: "1.60", ls: "0", cls: "text-base", sample: "Body Large — standard reading text for paragraphs and descriptions." },
  { name: "body-md", size: "14px / 0.875rem", weight: "400", lh: "1.55", ls: "0", cls: "text-sm", sample: "Body Medium — most common text size in the UI." },
  { name: "body-sm", size: "13px / 0.8125rem", weight: "400", lh: "1.50", ls: "0.005em", cls: "text-[13px]", sample: "Body Small — dense information, secondary descriptions." },
  { name: "label-lg", size: "14px / 0.875rem", weight: "500", lh: "1.40", ls: "0.01em", cls: "text-sm font-medium", sample: "Label Large" },
  { name: "label-md", size: "13px / 0.8125rem", weight: "500", lh: "1.40", ls: "0.015em", cls: "text-[13px] font-medium", sample: "Label Medium" },
  { name: "label-sm", size: "12px / 0.75rem", weight: "500", lh: "1.35", ls: "0.02em", cls: "text-xs font-medium", sample: "Label Small" },
  { name: "caption", size: "11px / 0.6875rem", weight: "400", lh: "1.30", ls: "0.02em", cls: "text-[11px]", sample: "Caption — timestamps, meta info, footnotes" },
  { name: "mono", size: "13px / 0.8125rem", weight: "400", lh: "1.50", ls: "0", cls: "text-[13px] font-mono", sample: "Mono — code, IDs, metrics: A1B2-C3D4" },
]

const SPACING_TOKENS = [
  { token: "space-1", px: 4, tailwind: "p-1" },
  { token: "space-2", px: 8, tailwind: "p-2" },
  { token: "space-3", px: 12, tailwind: "p-3" },
  { token: "space-4", px: 16, tailwind: "p-4" },
  { token: "space-5", px: 20, tailwind: "p-5" },
  { token: "space-6", px: 24, tailwind: "p-6" },
  { token: "space-8", px: 32, tailwind: "p-8" },
  { token: "space-10", px: 40, tailwind: "p-10" },
  { token: "space-12", px: 48, tailwind: "p-12" },
  { token: "space-16", px: 64, tailwind: "p-16" },
]

const SECTIONS: Section[] = [
  { id: "colors", label: "Colors" },
  { id: "typography", label: "Typography" },
  { id: "spacing", label: "Spacing" },
  { id: "buttons", label: "Buttons" },
  { id: "badges", label: "Badges" },
  { id: "cards", label: "Cards" },
  { id: "forms", label: "Forms" },
  { id: "tables", label: "Tables" },
  { id: "empty-states", label: "Empty States" },
  { id: "navigation", label: "Navigation" },
  { id: "dashboard", label: "Dashboard" },
]

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────

function SectionTitle({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50 scroll-mt-20 mb-1"
    >
      {children}
    </h2>
  )
}

function SectionDesc({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[13px] text-neutral-500 dark:text-neutral-400 mb-6">
      {children}
    </p>
  )
}

function ShowcaseBlock({
  title,
  children,
  code,
}: {
  title?: string
  children: React.ReactNode
  code?: string
}) {
  const [showCode, setShowCode] = useState(false)
  return (
    <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden">
      {title && (
        <div className="px-4 py-2.5 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 flex items-center justify-between">
          <span className="text-[12px] font-medium text-neutral-500 dark:text-neutral-400">
            {title}
          </span>
          {code && (
            <button
              onClick={() => setShowCode(!showCode)}
              className="text-[11px] text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
            >
              {showCode ? "Hide code" : "View code"}
            </button>
          )}
        </div>
      )}
      <div className="p-6 bg-white dark:bg-neutral-950">{children}</div>
      {code && showCode && (
        <div className="border-t border-neutral-200 dark:border-neutral-800">
          <pre className="p-4 text-[12px] font-mono overflow-x-auto bg-neutral-50 dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 leading-relaxed">
            {code}
          </pre>
        </div>
      )}
    </div>
  )
}

function ColorSwatch({
  name,
  color,
  textColor = "text-white",
}: {
  name: string
  color: string
  textColor?: string
}) {
  return (
    <div
      className={cn("w-full h-12 rounded-lg flex items-end justify-between px-2.5 py-1.5", color)}
    >
      <span className={cn("text-[10px] font-medium opacity-80", textColor)}>{name}</span>
    </div>
  )
}

// ─────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────
export default function DesignSystemPage() {
  const [isDark, setIsDark] = useState(false)
  const [loadingBtn, setLoadingBtn] = useState(false)

  function handleLoadingDemo() {
    setLoadingBtn(true)
    setTimeout(() => setLoadingBtn(false), 2000)
  }

  return (
    <div className={isDark ? "dark" : ""}>
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-50">

        {/* ── HERO ── */}
        <div className="relative overflow-hidden bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">
          <div className="absolute inset-0 bg-gradient-to-br from-lime-500/5 via-transparent to-purple-600/5 pointer-events-none" />
          <div className="max-w-7xl mx-auto px-6 py-16 lg:py-20">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2.5 mb-5">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-lime-500 to-lime-600 flex items-center justify-center">
                    <Zap className="h-4 w-4 text-white" />
                  </div>
                  <span className="text-[13px] font-medium text-neutral-500 dark:text-neutral-400">
                    Flow-IO Design System
                  </span>
                </div>
                <h1 className="text-5xl font-bold tracking-[-0.03em] leading-[1.10] mb-3">
                  Carbon{" "}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-lime-500 to-lime-400">
                    + Lime
                  </span>
                </h1>
                <p className="text-[15px] text-neutral-500 dark:text-neutral-400 max-w-lg leading-relaxed">
                  A precision-crafted design system for the Flow-IO AI voice platform.
                  Clean, minimal, and fast — built for 2026 dashboards.
                </p>
                <div className="flex items-center gap-3 mt-6">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                    Next.js 15 · Tailwind v4 · shadcn/ui · Geist
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIsDark(!isDark)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-[13px] font-medium text-neutral-600 dark:text-neutral-300 hover:border-neutral-300 dark:hover:border-neutral-600 transition-all duration-[120ms] shrink-0"
              >
                {isDark ? (
                  <>
                    <Sun className="h-4 w-4" />
                    Light Mode
                  </>
                ) : (
                  <>
                    <Moon className="h-4 w-4" />
                    Dark Mode
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* ── LAYOUT: Sidebar + Content ── */}
        <div className="max-w-7xl mx-auto px-6 py-10 flex gap-10">

          {/* Sticky Sidebar Nav */}
          <nav className="hidden lg:block w-44 shrink-0">
            <div className="sticky top-8 space-y-0.5">
              <p className="text-[11px] font-medium uppercase tracking-wider text-neutral-400 dark:text-neutral-600 mb-3 px-2">
                Sections
              </p>
              {SECTIONS.map((section) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className="block px-2 py-1.5 text-[13px] text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors duration-[120ms]"
                >
                  {section.label}
                </a>
              ))}
            </div>
          </nav>

          {/* Main Content */}
          <main className="flex-1 min-w-0 space-y-16">

            {/* ══ COLORS ══ */}
            <section>
              <SectionTitle id="colors">Colors</SectionTitle>
              <SectionDesc>
                Carbon + Lime palette. Brand uses lime-green for actions and status.
                Accent uses violet for secondary highlights. Neutral for all structure.
              </SectionDesc>

              <div className="space-y-6">
                {/* Brand */}
                <div>
                  <p className="text-[12px] font-medium text-neutral-500 mb-2.5 uppercase tracking-wider">
                    Brand — Lime
                  </p>
                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
                    {BRAND_COLORS.map((c) => (
                      <div key={c.name} className="space-y-1">
                        <div
                          className="h-10 rounded-lg border border-black/5"
                          style={{ background: c.light }}
                        />
                        <p className="text-[10px] text-neutral-400">{c.name}</p>
                        <p className="text-[10px] font-mono text-neutral-400">{c.light}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Accent */}
                <div>
                  <p className="text-[12px] font-medium text-neutral-500 mb-2.5 uppercase tracking-wider">
                    Accent — Purple
                  </p>
                  <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5 max-w-sm">
                    {ACCENT_COLORS.map((c) => (
                      <div key={c.name} className="space-y-1">
                        <div
                          className="h-10 rounded-lg"
                          style={{ background: c.light }}
                        />
                        <p className="text-[10px] text-neutral-400">{c.name}</p>
                        <p className="text-[10px] font-mono text-neutral-400">{c.light}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Neutral */}
                <div>
                  <p className="text-[12px] font-medium text-neutral-500 mb-2.5 uppercase tracking-wider">
                    Neutral — Carbon
                  </p>
                  <div className="grid grid-cols-4 sm:grid-cols-9 gap-1.5">
                    {NEUTRAL_COLORS.map((c) => (
                      <div key={c.name} className="space-y-1">
                        <div
                          className="h-10 rounded-lg border border-black/5"
                          style={{ background: isDark ? c.dark : c.light }}
                        />
                        <p className="text-[10px] text-neutral-400 truncate">{c.name}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Semantic */}
                <div>
                  <p className="text-[12px] font-medium text-neutral-500 mb-2.5 uppercase tracking-wider">
                    Semantic
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {SEMANTIC_COLORS.map((c) => (
                      <div
                        key={c.name}
                        className={cn(
                          "px-3 py-2 rounded-lg border text-[12px] font-medium",
                          c.bg,
                          c.text,
                          c.bg.includes("lime") ? "border-lime-200 dark:border-lime-800" :
                          c.bg.includes("amber") ? "border-amber-200 dark:border-amber-800" :
                          c.bg.includes("red") ? "border-red-200 dark:border-red-800" :
                          c.bg.includes("blue") ? "border-blue-200 dark:border-blue-800" :
                          "border-neutral-200 dark:border-neutral-700"
                        )}
                      >
                        {c.label}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Gradients */}
                <div>
                  <p className="text-[12px] font-medium text-neutral-500 mb-2.5 uppercase tracking-wider">
                    Gradients
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="h-16 rounded-xl bg-gradient-to-br from-lime-500 to-lime-600 flex items-center justify-center">
                      <span className="text-[12px] font-medium text-white">gradient-brand</span>
                    </div>
                    <div className="h-16 rounded-xl bg-gradient-to-br from-lime-500 to-purple-600 flex items-center justify-center">
                      <span className="text-[12px] font-medium text-white">gradient-brand-accent</span>
                    </div>
                    <div className="h-16 rounded-xl bg-gradient-to-br from-lime-500/10 to-purple-600/10 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center">
                      <span className="text-[12px] font-medium text-neutral-600 dark:text-neutral-300">gradient-soft</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* ══ TYPOGRAPHY ══ */}
            <section>
              <SectionTitle id="typography">Typography</SectionTitle>
              <SectionDesc>
                Geist Sans for UI text, Geist Mono for code and metrics.
                Precision tracking and line-height for each role.
              </SectionDesc>

              <ShowcaseBlock title="Type Scale">
                <div className="space-y-0">
                  {TYPE_SCALE.map((t, i) => (
                    <div
                      key={t.name}
                      className={cn(
                        "flex items-baseline gap-4 py-3",
                        i < TYPE_SCALE.length - 1 && "border-b border-neutral-100 dark:border-neutral-800/50"
                      )}
                    >
                      <div className="w-24 shrink-0">
                        <p className="text-[11px] font-mono text-lime-600 dark:text-lime-400">{t.name}</p>
                        <p className="text-[10px] text-neutral-400 mt-0.5">{t.size}</p>
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <span className={cn(t.cls, "text-neutral-900 dark:text-neutral-50 truncate block")}>
                          {t.sample}
                        </span>
                      </div>
                      <div className="hidden sm:flex items-center gap-3 shrink-0">
                        <span className="text-[10px] font-mono text-neutral-400">{t.weight}w</span>
                        <span className="text-[10px] font-mono text-neutral-400">lh {t.lh}</span>
                        <span className="text-[10px] font-mono text-neutral-400">ls {t.ls}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </ShowcaseBlock>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <ShowcaseBlock title="Font: Geist Sans">
                  <div className="space-y-1">
                    <p className="text-[13px] text-neutral-500 mb-3 font-mono">var(--font-geist-sans)</p>
                    <p className="text-2xl font-bold">The quick brown fox</p>
                    <p className="text-sm text-neutral-600 dark:text-neutral-300">
                      jumps over the lazy dog. 0123456789
                    </p>
                    <p className="text-xs text-neutral-400">
                      ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz
                    </p>
                  </div>
                </ShowcaseBlock>
                <ShowcaseBlock title="Font: Geist Mono">
                  <div className="space-y-1">
                    <p className="text-[13px] text-neutral-500 mb-3 font-mono">var(--font-geist-mono)</p>
                    <p className="text-2xl font-bold font-mono">The quick brown fox</p>
                    <p className="text-sm font-mono text-neutral-600 dark:text-neutral-300">
                      ID: A1B2-C3D4-E5F6 · 14:32:01
                    </p>
                    <p className="text-xs font-mono text-neutral-400">
                      0123456789 · $99.95 · 100% · API_KEY
                    </p>
                  </div>
                </ShowcaseBlock>
              </div>
            </section>

            {/* ══ SPACING ══ */}
            <section>
              <SectionTitle id="spacing">Spacing</SectionTitle>
              <SectionDesc>
                4px base grid. All spacing tokens are multiples of 4.
                Use consistently to maintain visual rhythm.
              </SectionDesc>

              <ShowcaseBlock title="Spacing Scale">
                <div className="space-y-2">
                  {SPACING_TOKENS.map((s) => (
                    <div key={s.token} className="flex items-center gap-4">
                      <div className="w-20 shrink-0">
                        <span className="text-[12px] font-mono text-lime-600 dark:text-lime-400">{s.token}</span>
                      </div>
                      <div
                        className="bg-lime-500/20 dark:bg-lime-400/15 border border-lime-300 dark:border-lime-700 rounded-sm"
                        style={{ width: s.px, height: 16 }}
                      />
                      <span className="text-[12px] text-neutral-400 font-mono">{s.px}px</span>
                      <span className="text-[12px] text-neutral-400 font-mono">{s.tailwind}</span>
                    </div>
                  ))}
                </div>
              </ShowcaseBlock>
            </section>

            {/* ══ BUTTONS ══ */}
            <section>
              <SectionTitle id="buttons">Buttons</SectionTitle>
              <SectionDesc>
                Six variants for different action types. Size defaults to h-9.
                Always use &quot;New [Entity]&quot; for creation actions.
              </SectionDesc>

              <div className="space-y-4">
                <ShowcaseBlock
                  title="All Variants"
                  code={`<Button>New Assistant</Button>
<Button variant="outline" size="sm">Edit</Button>
<Button variant="outline" size="sm">
  <Trash2 className="h-4 w-4 mr-2 text-red-500" />Delete
</Button>
<Button variant="ghost">View all</Button>
<Button variant="destructive">Delete Permanently</Button>
<Button variant="link">Learn more</Button>`}
                >
                  <div className="flex flex-wrap gap-3 items-center">
                    <button className="inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium h-9 px-4 py-2 bg-neutral-900 dark:bg-neutral-50 text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors duration-[120ms]">
                      <Plus className="h-4 w-4" />
                      New Assistant
                    </button>
                    <button className="inline-flex items-center gap-2 rounded-md text-[13px] font-medium h-8 px-3 border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-transparent text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors duration-[120ms]">
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </button>
                    <button className="inline-flex items-center gap-2 rounded-md text-[13px] font-medium h-8 px-3 border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-transparent text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors duration-[120ms]">
                      <Trash2 className="h-3.5 w-3.5 text-red-500" />
                      Delete
                    </button>
                    <button className="inline-flex items-center gap-2 rounded-md text-sm font-medium h-9 px-4 py-2 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors duration-[120ms]">
                      View all
                    </button>
                    <button className="inline-flex items-center gap-2 rounded-md text-sm font-medium h-9 px-4 py-2 bg-red-600 text-white hover:bg-red-700 transition-colors duration-[120ms]">
                      Delete Permanently
                    </button>
                    <button className="inline-flex items-center gap-2 text-sm font-medium text-neutral-900 dark:text-neutral-50 underline-offset-4 hover:underline transition-all duration-[120ms]">
                      Learn more
                    </button>
                  </div>
                </ShowcaseBlock>

                <ShowcaseBlock title="Icon-only (Inline table actions)" code={`<Button variant="ghost" size="icon" className="h-7 w-7">
  <Pencil className="h-3.5 w-3.5" />
</Button>
<Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:bg-red-50">
  <Trash2 className="h-3.5 w-3.5" />
</Button>`}>
                  <div className="flex items-center gap-1">
                    <button className="inline-flex items-center justify-center rounded-md h-7 w-7 text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors duration-[120ms]">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button className="inline-flex items-center justify-center rounded-md h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors duration-[120ms]">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <button className="inline-flex items-center justify-center rounded-md h-7 w-7 text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors duration-[120ms]">
                      <Download className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </ShowcaseBlock>

                <ShowcaseBlock title="States">
                  <div className="flex flex-wrap gap-3 items-center">
                    {/* Normal */}
                    <button className="inline-flex items-center gap-2 rounded-md text-sm font-medium h-9 px-4 bg-neutral-900 dark:bg-neutral-50 text-white dark:text-neutral-900 transition-colors">
                      Save Changes
                    </button>
                    {/* Loading */}
                    <button
                      onClick={handleLoadingDemo}
                      disabled={loadingBtn}
                      className="inline-flex items-center gap-2 rounded-md text-sm font-medium h-9 px-4 bg-neutral-900 dark:bg-neutral-50 text-white dark:text-neutral-900 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                    >
                      {loadingBtn ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>Try loading state</>
                      )}
                    </button>
                    {/* Disabled */}
                    <button
                      disabled
                      className="inline-flex items-center gap-2 rounded-md text-sm font-medium h-9 px-4 bg-neutral-900 dark:bg-neutral-50 text-white dark:text-neutral-900 opacity-40 cursor-not-allowed"
                    >
                      Disabled
                    </button>
                  </div>
                </ShowcaseBlock>
              </div>
            </section>

            {/* ══ BADGES ══ */}
            <section>
              <SectionTitle id="badges">Badges</SectionTitle>
              <SectionDesc>
                Status badges are always capitalized. Use semantic colors consistently.
                Lime = Active/Success, Amber = Pending, Red = Error.
              </SectionDesc>

              <ShowcaseBlock title="Status Variants" code={`<Badge className="bg-lime-500/10 text-lime-700 border-lime-200 dark:bg-lime-400/10 dark:text-lime-400">Active</Badge>
<Badge variant="secondary">Inactive</Badge>
<Badge className="bg-amber-500/10 text-amber-700 border-amber-200 dark:text-amber-400">Pending</Badge>
<Badge className="bg-red-500/10 text-red-600 border-red-200 dark:text-red-400">Error</Badge>
<Badge className="bg-blue-500/10 text-blue-600 border-blue-200 dark:text-blue-400">Processing</Badge>
<Badge className="bg-purple-500/10 text-purple-600 border-purple-200 dark:text-purple-400">Entry Point</Badge>
<Badge variant="outline">OpenAI GPT-4o</Badge>`}>
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center rounded-[4px] border px-2 py-0.5 text-[11px] font-medium bg-lime-500/10 text-lime-700 border-lime-200 dark:bg-lime-400/10 dark:text-lime-400 dark:border-lime-800">Active</span>
                    <span className="inline-flex items-center rounded-[4px] border px-2 py-0.5 text-[11px] font-medium bg-neutral-100 text-neutral-600 border-transparent dark:bg-neutral-800 dark:text-neutral-400">Inactive</span>
                    <span className="inline-flex items-center rounded-[4px] border px-2 py-0.5 text-[11px] font-medium bg-amber-500/10 text-amber-700 border-amber-200 dark:bg-amber-400/10 dark:text-amber-400 dark:border-amber-800">Pending</span>
                    <span className="inline-flex items-center rounded-[4px] border px-2 py-0.5 text-[11px] font-medium bg-red-500/10 text-red-600 border-red-200 dark:bg-red-400/10 dark:text-red-400 dark:border-red-800">Error</span>
                    <span className="inline-flex items-center rounded-[4px] border px-2 py-0.5 text-[11px] font-medium bg-blue-500/10 text-blue-600 border-blue-200 dark:bg-blue-400/10 dark:text-blue-400 dark:border-blue-800">Processing</span>
                    <span className="inline-flex items-center rounded-[4px] border px-2 py-0.5 text-[11px] font-medium bg-purple-500/10 text-purple-600 border-purple-200 dark:bg-purple-400/10 dark:text-purple-400 dark:border-purple-800">Entry Point</span>
                    <span className="inline-flex items-center rounded-[4px] border border-neutral-200 dark:border-neutral-700 px-2 py-0.5 text-[11px] font-medium text-neutral-600 dark:text-neutral-400">OpenAI GPT-4o</span>
                    <span className="inline-flex items-center rounded-[4px] border px-2 py-0.5 text-[11px] font-medium bg-lime-500/10 text-lime-700 border-lime-200 dark:bg-lime-400/10 dark:text-lime-400 dark:border-lime-800">Healthy</span>
                    <span className="inline-flex items-center rounded-[4px] border px-2 py-0.5 text-[11px] font-medium bg-amber-500/10 text-amber-700 border-amber-200 dark:bg-amber-400/10 dark:text-amber-400 dark:border-amber-800">Degraded</span>
                    <span className="inline-flex items-center rounded-[4px] border px-2 py-0.5 text-[11px] font-medium bg-red-500/10 text-red-600 border-red-200 dark:bg-red-400/10 dark:text-red-400 dark:border-red-800">Down</span>
                    <span className="inline-flex items-center rounded-[4px] border px-2 py-0.5 text-[11px] font-medium bg-lime-500/10 text-lime-700 border-lime-200 dark:bg-lime-400/10 dark:text-lime-400 dark:border-lime-800">Completed</span>
                    <span className="inline-flex items-center rounded-[4px] border px-2 py-0.5 text-[11px] font-medium bg-blue-500/10 text-blue-600 border-blue-200 dark:bg-blue-400/10 dark:text-blue-400 dark:border-blue-800">Running</span>
                    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium bg-purple-500/10 text-purple-600 border border-purple-200 dark:bg-purple-400/10 dark:text-purple-400 dark:border-purple-800">
                      <Star className="h-2.5 w-2.5" />Beta
                    </span>
                  </div>
                </ShowcaseBlock>
              </section>

            {/* ══ CARDS ══ */}
            <section>
              <SectionTitle id="cards">Cards</SectionTitle>
              <SectionDesc>
                Four card types for different use cases.
                Item cards for entities, stat cards for metrics, feature cards for highlights.
              </SectionDesc>

              <div className="space-y-4">
                <ShowcaseBlock title="Item Card — Entity with actions">
                  <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl bg-white dark:bg-neutral-900 hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors duration-[120ms] cursor-pointer max-w-lg">
                    <div className="p-5 pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0">
                            <Bot className="h-[18px] w-[18px] text-indigo-500" />
                          </div>
                          <div>
                            <p className="text-[15px] font-semibold leading-snug text-neutral-900 dark:text-neutral-50">
                              Customer Support Bot
                            </p>
                            <p className="text-[13px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                              Handles tier-1 support queries in German and English.
                            </p>
                          </div>
                        </div>
                        <span className="inline-flex items-center rounded-[4px] border px-2 py-0.5 text-[11px] font-medium bg-lime-500/10 text-lime-700 border-lime-200 dark:bg-lime-400/10 dark:text-lime-400 dark:border-lime-800 shrink-0 ml-3">
                          Active
                        </span>
                      </div>
                    </div>
                    <div className="px-5 pb-5 pt-0">
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-neutral-400 mb-4">
                        <span>ElevenLabs · de-DE</span>
                        <span className="text-neutral-200 dark:text-neutral-700">·</span>
                        <span>OpenAI GPT-4o</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button className="inline-flex items-center gap-1.5 rounded-md text-[13px] font-medium h-8 px-3 border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-transparent text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">
                          <Pencil className="h-3.5 w-3.5" />Edit
                        </button>
                        <button className="inline-flex items-center gap-1.5 rounded-md text-[13px] font-medium h-8 px-3 border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-transparent text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">
                          <Trash2 className="h-3.5 w-3.5 text-red-500" />Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </ShowcaseBlock>

                <ShowcaseBlock title="Stat Cards — Metrics grid">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: "Active Calls", value: "3", icon: Activity, color: "text-lime-600 dark:text-lime-400", bg: "bg-lime-500/10", highlight: true },
                      { label: "Calls Today", value: "142", icon: Phone, color: "text-blue-500", bg: "bg-blue-500/10", highlight: false },
                      { label: "This Week", value: "1,204", icon: TrendingUp, color: "text-purple-500", bg: "bg-purple-500/10", highlight: false },
                      { label: "Avg Duration", value: "3m 14s", icon: Clock, color: "text-orange-500", bg: "bg-orange-500/10", highlight: false },
                    ].map((card) => (
                      <div
                        key={card.label}
                        className={cn(
                          "p-4 rounded-xl border bg-white dark:bg-neutral-900 transition-colors",
                          card.highlight
                            ? "border-lime-300 ring-2 ring-lime-500 ring-offset-2 dark:ring-lime-400 dark:ring-offset-neutral-950 dark:border-lime-700"
                            : "border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", card.bg)}>
                            <card.icon className={cn("h-[18px] w-[18px]", card.color)} />
                          </div>
                          <div>
                            <p className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 leading-none mb-1">
                              {card.label}
                            </p>
                            <p className={cn("text-xl font-bold tracking-tight leading-none tabular-nums", card.highlight && "text-lime-700 dark:text-lime-400")}>
                              {card.value}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ShowcaseBlock>

                <ShowcaseBlock title="Feature Cards">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[
                      { icon: Zap, color: "text-lime-600 dark:text-lime-400", bg: "from-lime-500/15 to-lime-600/5", title: "Real-time Extraction", desc: "Variables are extracted during the call, not after." },
                      { icon: Variable, color: "text-purple-600 dark:text-purple-400", bg: "from-purple-500/15 to-purple-600/5", title: "Smart Validation", desc: "Regex patterns and webhook endpoints for live validation." },
                      { icon: MessageSquare, color: "text-blue-600 dark:text-blue-400", bg: "from-blue-500/15 to-blue-600/5", title: "Natural Language", desc: "GPT-4o powered intent recognition from freeform speech." },
                    ].map((f) => (
                      <div key={f.title} className="p-5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex flex-col gap-3">
                        <div className={cn("w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center", f.bg)}>
                          <f.icon className={cn("h-5 w-5", f.color)} />
                        </div>
                        <div>
                          <p className="text-[14px] font-semibold mb-1">{f.title}</p>
                          <p className="text-[12px] text-neutral-500 dark:text-neutral-400 leading-relaxed">{f.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ShowcaseBlock>
              </div>
            </section>

            {/* ══ FORMS ══ */}
            <section>
              <SectionTitle id="forms">Forms</SectionTitle>
              <SectionDesc>
                Label + Input pattern. Show errors on submit, not on blur.
                Helper text in body-sm (13px, neutral-500).
              </SectionDesc>

              <ShowcaseBlock title="Form Fields">
                <div className="max-w-md space-y-5">
                  {/* Input */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                      Assistant Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Customer Support Bot"
                      defaultValue="Customer Support Bot"
                      className="w-full h-9 rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 text-sm text-neutral-900 dark:text-neutral-50 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-100 focus:ring-offset-0 transition-shadow"
                    />
                    <p className="text-[12px] text-neutral-400">
                      Displayed in the dashboard and call logs.
                    </p>
                  </div>

                  {/* Select */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                      LLM Provider
                    </label>
                    <select className="w-full h-9 rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 text-sm text-neutral-900 dark:text-neutral-50 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-100">
                      <option>OpenAI</option>
                      <option>Google Gemini</option>
                      <option>Mistral</option>
                    </select>
                  </div>

                  {/* Textarea */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                      System Prompt
                    </label>
                    <textarea
                      rows={4}
                      placeholder="You are a helpful assistant..."
                      className="w-full rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-[13px] font-mono text-neutral-900 dark:text-neutral-50 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-100 resize-none"
                    />
                  </div>

                  {/* Switch */}
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <p className="text-sm font-medium">Active</p>
                      <p className="text-[12px] text-neutral-400">Enable for incoming calls.</p>
                    </div>
                    <div className="w-9 h-5 bg-lime-500 rounded-full relative cursor-pointer">
                      <div className="absolute top-0.5 right-0.5 w-4 h-4 bg-white rounded-full shadow-sm" />
                    </div>
                  </div>

                  {/* Error state */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-red-600 dark:text-red-400">
                      API Key
                    </label>
                    <input
                      type="text"
                      placeholder="sk-..."
                      className="w-full h-9 rounded-md border border-red-300 dark:border-red-700 bg-white dark:bg-neutral-900 px-3 text-sm text-neutral-900 dark:text-neutral-50 focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                    <p className="text-[12px] text-red-600 dark:text-red-400 flex items-center gap-1">
                      <XCircle className="h-3 w-3" />
                      Invalid API key format.
                    </p>
                  </div>

                  {/* Success state */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                      Webhook URL
                    </label>
                    <input
                      type="text"
                      defaultValue="https://api.example.com/webhook"
                      className="w-full h-9 rounded-md border border-lime-400 dark:border-lime-700 bg-white dark:bg-neutral-900 px-3 text-sm text-neutral-900 dark:text-neutral-50 focus:outline-none focus:ring-2 focus:ring-lime-500"
                    />
                    <p className="text-[12px] text-lime-700 dark:text-lime-400 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Connection verified.
                    </p>
                  </div>
                </div>
              </ShowcaseBlock>

              <div className="mt-4 space-y-3">
                <p className="text-[12px] font-medium uppercase tracking-wider text-neutral-400">Inline Alerts</p>
                <div className="space-y-2 max-w-md">
                  <div className="p-3 rounded-lg text-[13px] bg-lime-50 dark:bg-lime-950/20 border border-lime-200 dark:border-lime-800 text-lime-700 dark:text-lime-400 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    Changes saved successfully.
                  </div>
                  <div className="p-3 rounded-lg text-[13px] bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 flex items-center gap-2">
                    <XCircle className="h-4 w-4 shrink-0" />
                    Failed to save. Please try again.
                  </div>
                  <div className="p-3 rounded-lg text-[13px] bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    This action cannot be undone.
                  </div>
                </div>
              </div>
            </section>

            {/* ══ TABLES ══ */}
            <section>
              <SectionTitle id="tables">Tables</SectionTitle>
              <SectionDesc>
                Always wrap in Card. Empty state outside the table.
                Ghost icon buttons for row actions (h-7 w-7).
              </SectionDesc>

              <ShowcaseBlock title="Data Table">
                <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50">
                        {["Name", "Status", "Provider", "Created", ""].map((h) => (
                          <th key={h} className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-neutral-500">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { name: "Support Bot DE", status: "Active", provider: "GPT-4o", created: "Mar 15" },
                        { name: "Sales Assistant", status: "Active", provider: "Gemini 2.0", created: "Mar 10" },
                        { name: "Fallback Bot", status: "Inactive", provider: "GPT-4o Mini", created: "Feb 28" },
                      ].map((row, i, arr) => (
                        <tr key={row.name} className={cn("hover:bg-neutral-50 dark:hover:bg-neutral-900/30 transition-colors", i < arr.length - 1 && "border-b border-neutral-100 dark:border-neutral-800/50")}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-6 h-6 rounded-md bg-indigo-500/10 flex items-center justify-center shrink-0">
                                <Bot className="h-3 w-3 text-indigo-500" />
                              </div>
                              <span className="text-[13px] font-medium">{row.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={cn(
                              "inline-flex items-center rounded-[4px] border px-2 py-0.5 text-[11px] font-medium",
                              row.status === "Active"
                                ? "bg-lime-500/10 text-lime-700 border-lime-200 dark:bg-lime-400/10 dark:text-lime-400 dark:border-lime-800"
                                : "bg-neutral-100 text-neutral-600 border-transparent dark:bg-neutral-800 dark:text-neutral-400"
                            )}>
                              {row.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-[13px] text-neutral-500">{row.provider}</td>
                          <td className="px-4 py-3 text-[12px] font-mono text-neutral-400">{row.created}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <button className="inline-flex items-center justify-center rounded-md h-7 w-7 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button className="inline-flex items-center justify-center rounded-md h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </ShowcaseBlock>
            </section>

            {/* ══ EMPTY STATES ══ */}
            <section>
              <SectionTitle id="empty-states">Empty States</SectionTitle>
              <SectionDesc>
                Rounded icon container, descriptive title, helpful subtitle, primary CTA.
                Consistent sizing: icon container 56×56, icon 28×28.
              </SectionDesc>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { icon: Bot, title: "No assistants yet", desc: "Create your first AI assistant to start handling calls automatically.", cta: "New Assistant" },
                  { icon: Phone, title: "No phone numbers connected", desc: "Connect a sipgate number to start receiving calls.", cta: null },
                  { icon: Search, title: "No results found", desc: "Try adjusting your search or filters.", cta: null },
                  { icon: FlaskConical, title: "No test suites yet", desc: "Create a test suite to automate quality testing.", cta: "New Test Suite" },
                ].map((e) => (
                  <div key={e.title} className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-center py-12 px-6">
                    <div className="w-14 h-14 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mx-auto mb-4">
                      <e.icon className="h-7 w-7 text-neutral-400" />
                    </div>
                    <h3 className="text-[14px] font-semibold mb-1.5">{e.title}</h3>
                    <p className="text-[12px] text-neutral-500 dark:text-neutral-400 mb-4 max-w-[200px] mx-auto leading-relaxed">
                      {e.desc}
                    </p>
                    {e.cta && (
                      <button className="inline-flex items-center gap-1.5 rounded-md text-[13px] font-medium h-8 px-3 bg-neutral-900 dark:bg-neutral-50 text-white dark:text-neutral-900">
                        <Plus className="h-3.5 w-3.5" />
                        {e.cta}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* ══ NAVIGATION ══ */}
            <section>
              <SectionTitle id="navigation">Navigation</SectionTitle>
              <SectionDesc>
                64px fixed sidebar, 13px font-medium, 4px rounded icon+text items.
                Active state: bg-neutral-100, inactive: text-neutral-500 with hover.
              </SectionDesc>

              <ShowcaseBlock title="Sidebar Navigation">
                <div className="flex gap-0 rounded-xl overflow-hidden border border-neutral-200 dark:border-neutral-800" style={{ height: 440 }}>
                  {/* Sidebar */}
                  <div className="w-56 border-r border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 flex flex-col shrink-0">
                    <div className="h-14 border-b border-neutral-200 dark:border-neutral-800 flex items-center px-4 gap-2">
                      <div className="w-6 h-6 rounded-md bg-gradient-to-br from-lime-500 to-lime-600 flex items-center justify-center">
                        <Zap className="h-3.5 w-3.5 text-white" />
                      </div>
                      <span className="text-[14px] font-semibold">Flow-IO</span>
                    </div>
                    <nav className="flex-1 p-2.5 space-y-0.5 overflow-y-auto">
                      {[
                        { icon: LayoutDashboard, label: "Dashboard", active: false },
                        { icon: Bot, label: "Assistants", active: true },
                        { icon: GitBranch, label: "Scenarios", active: false },
                        { icon: Layers, label: "Knowledge", active: false },
                        { icon: MessageSquare, label: "Chat", active: false },
                        { icon: FlaskConical, label: "Autotest", active: false },
                        { icon: Phone, label: "Calls", active: false },
                        { icon: Cable, label: "Connect", active: false },
                        { icon: BarChart3, label: "Analytics", active: false },
                        { icon: Settings, label: "Settings", active: false },
                      ].map((item) => (
                        <div
                          key={item.label}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium cursor-pointer transition-colors duration-[120ms]",
                            item.active
                              ? "bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                              : "text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800/50 hover:text-neutral-900 dark:hover:text-neutral-100"
                          )}
                        >
                          <item.icon className="h-4 w-4 shrink-0" />
                          {item.label}
                        </div>
                      ))}
                    </nav>
                    <div className="p-2.5 border-t border-neutral-200 dark:border-neutral-800">
                      <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px]">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-lime-400 to-lime-600 flex items-center justify-center shrink-0">
                          <span className="text-[10px] font-bold text-white">AC</span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-neutral-900 dark:text-neutral-100 truncate text-[12px]">Acme Corp</p>
                          <p className="text-[11px] text-neutral-400 truncate">Admin</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Page content preview */}
                  <div className="flex-1 bg-neutral-50 dark:bg-neutral-950 p-5">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-neutral-400 mb-4">
                      Page content area
                    </p>
                    <div className="space-y-2">
                      <div className="h-8 bg-neutral-200 dark:bg-neutral-800 rounded-lg w-48" />
                      <div className="h-4 bg-neutral-100 dark:bg-neutral-800/50 rounded w-72" />
                    </div>
                    <div className="grid grid-cols-3 gap-3 mt-5">
                      {[1,2,3].map(i => (
                        <div key={i} className="h-20 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800" />
                      ))}
                    </div>
                  </div>
                </div>
              </ShowcaseBlock>
            </section>

            {/* ══ DASHBOARD MOCKUP ══ */}
            <section>
              <SectionTitle id="dashboard">Dashboard Mockup</SectionTitle>
              <SectionDesc>
                Layout C: Stats grid + 2/3 / 1/3 widget layout. All data fetched in Server Component.
              </SectionDesc>

              <ShowcaseBlock title="Dashboard Preview">
                <div className="space-y-4">
                  {/* Header */}
                  <div>
                    <h2 className="text-2xl font-semibold tracking-tight">Overview</h2>
                    <p className="text-[13px] text-neutral-500 mt-0.5">Last 30 days performance</p>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: "Active Calls", value: "3", icon: Activity, color: "text-lime-600", bg: "bg-lime-500/10", highlight: true },
                      { label: "Calls Today", value: "142", icon: Phone, color: "text-blue-500", bg: "bg-blue-500/10", highlight: false },
                      { label: "This Week", value: "1,204", icon: TrendingUp, color: "text-purple-500", bg: "bg-purple-500/10", highlight: false },
                      { label: "Avg Duration", value: "3m 14s", icon: Clock, color: "text-orange-500", bg: "bg-orange-500/10", highlight: false },
                    ].map((card) => (
                      <div key={card.label} className={cn(
                        "p-3.5 rounded-xl border bg-white dark:bg-neutral-900",
                        card.highlight
                          ? "border-lime-300 ring-2 ring-lime-500 ring-offset-1 dark:border-lime-700 dark:ring-lime-400 dark:ring-offset-neutral-950"
                          : "border-neutral-200 dark:border-neutral-800"
                      )}>
                        <div className="flex items-center gap-2.5">
                          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", card.bg)}>
                            <card.icon className={cn("h-4 w-4", card.color)} />
                          </div>
                          <div>
                            <p className="text-[11px] text-neutral-500 leading-none mb-0.5">{card.label}</p>
                            <p className={cn("text-lg font-bold tabular-nums", card.highlight && "text-lime-700 dark:text-lime-400")}>{card.value}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Widget grid */}
                  <div className="grid grid-cols-3 gap-4">
                    {/* Main: 2/3 */}
                    <div className="col-span-2 space-y-4">
                      <div className="h-44 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
                        <p className="text-[12px] font-medium text-neutral-500 mb-3">Call Volume · 7 days</p>
                        <div className="flex items-end gap-1.5 h-24">
                          {[40, 65, 48, 80, 72, 95, 58].map((h, i) => (
                            <div key={i} className="flex-1 flex flex-col items-center gap-1">
                              <div
                                className="w-full rounded-sm bg-lime-500/20 dark:bg-lime-400/15"
                                style={{ height: `${h}%` }}
                              />
                            </div>
                          ))}
                        </div>
                        <div className="flex justify-between mt-2">
                          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => (
                            <span key={d} className="text-[10px] text-neutral-400">{d}</span>
                          ))}
                        </div>
                      </div>
                      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden">
                        <div className="px-4 py-3 border-b border-neutral-100 dark:border-neutral-800">
                          <p className="text-[13px] font-semibold">Recent Calls</p>
                        </div>
                        {["+49 162 1234567", "+49 30 9876543", "+49 89 5551234"].map((num, i) => (
                          <div key={num} className={cn("px-4 py-2.5 flex items-center justify-between text-[12px]", i < 2 && "border-b border-neutral-100 dark:border-neutral-800/50")}>
                            <div className="flex items-center gap-2">
                              <Phone className="h-3 w-3 text-neutral-400" />
                              <span className="font-mono">{num}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-neutral-400">3m 12s</span>
                              <span className="inline-flex items-center rounded-[4px] border px-1.5 py-0.5 text-[10px] font-medium bg-lime-500/10 text-lime-700 border-lime-200 dark:bg-lime-400/10 dark:text-lime-400 dark:border-lime-800">Completed</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Sidebar: 1/3 */}
                    <div className="space-y-4">
                      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
                        <p className="text-[13px] font-semibold mb-3">System Status</p>
                        {[
                          { label: "sipgate API", ok: true },
                          { label: "OpenAI", ok: true },
                          { label: "Supabase", ok: true },
                        ].map(s => (
                          <div key={s.label} className="flex items-center justify-between py-1.5">
                            <span className="text-[12px] text-neutral-600 dark:text-neutral-400">{s.label}</span>
                            <div className="flex items-center gap-1.5">
                              <div className="w-1.5 h-1.5 rounded-full bg-lime-500" />
                              <span className="text-[11px] text-lime-700 dark:text-lime-400">Healthy</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
                        <p className="text-[13px] font-semibold mb-3">Top Variables</p>
                        {[
                          { name: "customer_name", count: 89 },
                          { name: "ticket_id", count: 67 },
                          { name: "callback_time", count: 45 },
                        ].map(v => (
                          <div key={v.name} className="flex items-center justify-between py-1.5">
                            <span className="text-[11px] font-mono text-neutral-600 dark:text-neutral-400 truncate">{v.name}</span>
                            <span className="text-[12px] font-semibold tabular-nums ml-2">{v.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </ShowcaseBlock>
            </section>

            {/* Footer */}
            <footer className="border-t border-neutral-200 dark:border-neutral-800 pt-8 pb-16">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-gradient-to-br from-lime-500 to-lime-600 flex items-center justify-center">
                    <Zap className="h-3.5 w-3.5 text-white" />
                  </div>
                  <span className="text-[13px] font-medium">Flow-IO Design System</span>
                </div>
                <div className="flex items-center gap-4 text-[12px] text-neutral-400">
                  <span>Carbon + Lime</span>
                  <span>·</span>
                  <span>v1.0</span>
                  <span>·</span>
                  <span>2026</span>
                </div>
              </div>
              <p className="text-[12px] text-neutral-400 mt-3 max-w-lg">
                See <code className="font-mono text-lime-600 dark:text-lime-400">design/README.md</code> for LLM reference,{" "}
                <code className="font-mono text-lime-600 dark:text-lime-400">design/tokens.md</code> for all tokens,{" "}
                <code className="font-mono text-lime-600 dark:text-lime-400">design/components.md</code> for patterns.
              </p>
            </footer>

          </main>
        </div>
      </div>
    </div>
  )
}
