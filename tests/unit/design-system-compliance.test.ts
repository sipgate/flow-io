/**
 * Design System Compliance Tests
 *
 * Statische Analyse aller TSX/TS-Dateien auf Verstöße gegen das Carbon + Lime Design System.
 * Jede Regel ist deterministisch: kein Match = Pass, mindestens ein Match = Fail mit Datei + Zeile.
 *
 * Design System Referenz: /design/tokens.md, /design/components.md, /design/patterns.md
 */

import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

// ---------------------------------------------------------------------------
// File discovery
// ---------------------------------------------------------------------------

const ROOT = path.resolve(__dirname, '../..')

/** Rekursiv alle .tsx/.ts Dateien finden */
function getFiles(dirs: string[], globalExclude: RegExp[]): string[] {
  const result: string[] = []

  function walk(current: string) {
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(current, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name)
      const rel = path.relative(ROOT, fullPath)
      if (globalExclude.some((p) => p.test(rel))) continue
      if (entry.isDirectory()) {
        walk(fullPath)
      } else if (/\.(tsx|ts)$/.test(entry.name)) {
        result.push(fullPath)
      }
    }
  }

  for (const dir of dirs) walk(path.join(ROOT, dir))
  return result
}

const GLOBAL_EXCLUDE: RegExp[] = [
  /node_modules/,
  /\.next/,
  /components\/ui\//,       // shadcn base components — eigene Regeln
  /tests\//,                // eigene Test-Dateien nicht prüfen
]

/** Alle relevanten App + Komponenten Dateien */
const appAndComponents = getFiles(['app', 'components'], GLOBAL_EXCLUDE)

/** Nur Seiten-Dateien unter [orgSlug] */
const orgSlugPages = appAndComponents.filter((f) =>
  /app\/\[orgSlug\].*\/page\.tsx$/.test(f)
)

// ---------------------------------------------------------------------------
// Violation checker — Typen
// ---------------------------------------------------------------------------

type Violation = { file: string; line: number; content: string }
type FileViolation = { file: string; reason: string }

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

/** Zeilen-Level: Pattern darf in keiner Zeile vorkommen */
function findViolations(
  files: string[],
  pattern: RegExp,
  excludeFiles: RegExp[] = []
): Violation[] {
  const violations: Violation[] = []
  for (const file of files) {
    if (excludeFiles.some((p) => p.test(file))) continue
    const lines = fs.readFileSync(file, 'utf-8').split('\n')
    lines.forEach((line, i) => {
      if (pattern.test(line)) {
        violations.push({
          file: path.relative(ROOT, file),
          line: i + 1,
          content: line.trim().slice(0, 120),
        })
      }
    })
  }
  return violations
}

/**
 * Zeilen-Level: badPattern darf nur dann vorkommen, wenn goodPattern
 * auf derselben Zeile ebenfalls vorkommt.
 */
function findViolationsUnless(
  files: string[],
  badPattern: RegExp,
  goodPattern: RegExp,
  excludeFiles: RegExp[] = []
): Violation[] {
  const violations: Violation[] = []
  for (const file of files) {
    if (excludeFiles.some((p) => p.test(file))) continue
    const lines = fs.readFileSync(file, 'utf-8').split('\n')
    lines.forEach((line, i) => {
      if (badPattern.test(line) && !goodPattern.test(line)) {
        violations.push({
          file: path.relative(ROOT, file),
          line: i + 1,
          content: line.trim().slice(0, 120),
        })
      }
    })
  }
  return violations
}

/**
 * Datei-Level: Jede Datei MUSS das Pattern enthalten.
 * Nützlich für strukturelle Anforderungen (z.B. max-w auf Pages).
 */
function mustContain(
  files: string[],
  pattern: RegExp,
  excludeFiles: RegExp[] = []
): FileViolation[] {
  const violations: FileViolation[] = []
  for (const file of files) {
    if (excludeFiles.some((p) => p.test(file))) continue
    const content = fs.readFileSync(file, 'utf-8')
    if (!pattern.test(content)) {
      violations.push({
        file: path.relative(ROOT, file),
        reason: `Pflicht-Pattern fehlt: ${pattern}`,
      })
    }
  }
  return violations
}

function formatViolations(violations: Violation[]): string {
  return violations
    .map((v) => `  ${v.file}:${v.line}\n    → ${v.content}`)
    .join('\n')
}

function formatFileViolations(violations: FileViolation[]): string {
  return violations
    .map((v) => `  ${v.file}\n    → ${v.reason}`)
    .join('\n')
}

// ---------------------------------------------------------------------------
// Data-Viz Ausnahmen (grüne Icon-Farben sind in diesen Dateien erlaubt)
// ---------------------------------------------------------------------------
const DATA_VIZ_EXCLUDE: RegExp[] = [
  /stats-cards\.tsx/,
  /quick-actions\.tsx/,
  /analytics-summary\.tsx/,
  /call-heatmap\.tsx/,
  /period-comparison\.tsx/,
  /csat-overview-card\.tsx/,
  /csat-analytics-section\.tsx/,
  /criteria-analytics-section\.tsx/,
  /criteria-overview-card\.tsx/,
  /landing-content\.tsx/,
  /app\/design\/page\.tsx/,
]

// ---------------------------------------------------------------------------
// ══════════════════════════════════════════════════════════════════════════
// FARBEN — Keine verbotenen Tailwind-Farb-Namespaces
// ══════════════════════════════════════════════════════════════════════════
// ---------------------------------------------------------------------------

describe('Design System Compliance — Farben', () => {

  // ─── RULE-01: Kein slate-* ───────────────────────────────────────────────
  it('RULE-01: Keine slate-* Tailwind-Farben (stattdessen neutral-*)', () => {
    const violations = findViolations(appAndComponents, /\bslate-\d+\b/)
    expect(violations, `\nVerstöße:\n${formatViolations(violations)}`).toHaveLength(0)
  })

  // ─── RULE-04: Kein bg-green-500 solid ───────────────────────────────────
  it('RULE-04: Keine bg-green-500 als Status-Badge (Lime-Pattern: bg-lime-500/10)', () => {
    const violations = findViolations(
      appAndComponents,
      /\bbg-green-500(?!\/)(?:[^/]|$)/,
      DATA_VIZ_EXCLUDE
    )
    expect(violations, `\nVerstöße:\n${formatViolations(violations)}`).toHaveLength(0)
  })

  // ─── RULE-05: Kein bg-yellow-500 solid ──────────────────────────────────
  it('RULE-05: Keine bg-yellow-500 als Status-Badge (Amber-Pattern: bg-amber-500/10)', () => {
    const violations = findViolations(
      appAndComponents,
      /\bbg-yellow-500(?!\/)(?:[^/]|$)/
    )
    expect(violations, `\nVerstöße:\n${formatViolations(violations)}`).toHaveLength(0)
  })

  // ─── RULE-11: Kein Legacy bg-green-100 text-green-7* ────────────────────
  it('RULE-11: Keine Legacy-Badge-Farben (bg-green-100 text-green-7*)', () => {
    const violations = findViolations(
      appAndComponents,
      /bg-green-100[^"]*text-green-[67]/
    )
    expect(violations, `\nVerstöße:\n${formatViolations(violations)}`).toHaveLength(0)
  })

  // ─── RULE-12: Kein dark:bg-slate-* ──────────────────────────────────────
  it('RULE-12: Kein dark:bg-slate-* (Dark Mode muss dark:bg-neutral-* verwenden)', () => {
    const violations = findViolations(appAndComponents, /dark:bg-slate-\d+/)
    expect(violations, `\nVerstöße:\n${formatViolations(violations)}`).toHaveLength(0)
  })

  // ─── RULE-14: Weitere solide Status-Farben ohne Opacity ─────────────────
  it('RULE-14: Keine soliden bg-red/orange/blue/purple-500 als Status-Badges (Opacity-Pattern /10 verwenden)', () => {
    // Erlaubt: bg-red-500/10 (mit Opacity-Modifier)
    // Verboten: bg-red-500 ohne Opacity (solide Farbfläche)
    const violations = findViolations(
      appAndComponents,
      /\bbg-(?:red|orange|blue|purple|pink)-500(?!\/)(?:[^/]|$)/,
      [
        ...DATA_VIZ_EXCLUDE,
        // Weitere bekannte Data-Viz Ausnahmen
        /enhanced-assistant-stats\.tsx/,
        /drill-down-modal\.tsx/,
        /call-volume-chart\.tsx/,
        // Kompakte Icon-Indikatoren (kleine solide Kreise, kein Badge-Muster)
        /running-tests-indicator\.tsx/,
        /calls-table\.tsx/,
        /criteria-overview-card\.tsx/,
        /csat-overview-card\.tsx/,
        /criteria-analytics-section\.tsx/,
        /csat-analytics-section\.tsx/,
      ]
    )
    expect(violations, `\nVerstöße:\n${formatViolations(violations)}`).toHaveLength(0)
  })

  // ─── RULE-19: variant="secondary" mit solidem bg-Override ───────────────
  it('RULE-19: Keine Badge variant="secondary" mit solidem bg-* Override', () => {
    // Fängt: variant="secondary" className="bg-yellow-500" etc.
    const violations = findViolations(
      appAndComponents,
      /variant="secondary"\s+className="bg-(?!neutral|white|transparent)[a-z]+-\d{3}(?!\/)/
    )
    expect(violations, `\nVerstöße:\n${formatViolations(violations)}`).toHaveLength(0)
  })

})

// ---------------------------------------------------------------------------
// ══════════════════════════════════════════════════════════════════════════
// BADGES — Variant + Farb-Kombinationen
// ══════════════════════════════════════════════════════════════════════════
// ---------------------------------------------------------------------------

describe('Design System Compliance — Badges', () => {

  // ─── RULE-06: variant="default" + solidem bg-Override ───────────────────
  it('RULE-06: Keine Badge variant="default" mit solidem bg-* Override', () => {
    const violations = findViolations(
      appAndComponents,
      /variant="default"\s+className="bg-(?!lime|neutral|white|black|transparent)/
    )
    expect(violations, `\nVerstöße:\n${formatViolations(violations)}`).toHaveLength(0)
  })

})

// ---------------------------------------------------------------------------
// ══════════════════════════════════════════════════════════════════════════
// LAYOUT — Struktur & Abstände
// ══════════════════════════════════════════════════════════════════════════
// ---------------------------------------------------------------------------

describe('Design System Compliance — Layout', () => {

  // ─── RULE-02: Kein hover:shadow ──────────────────────────────────────────
  it('RULE-02: Kein hover:shadow-* (stattdessen hover:border + transition-colors)', () => {
    const violations = findViolations(
      appAndComponents,
      /hover:shadow-(?:sm|md|lg|xl|2xl)/,
      [/landing-content\.tsx/]
    )
    expect(violations, `\nVerstöße:\n${formatViolations(violations)}`).toHaveLength(0)
  })

  // ─── RULE-13: Kein transition-shadow ─────────────────────────────────────
  it('RULE-13: Kein transition-shadow (transition-colors verwenden)', () => {
    const violations = findViolations(
      appAndComponents,
      /\btransition-shadow\b/,
      [/landing-content\.tsx/, /app\/design\/page\.tsx/]
    )
    expect(violations, `\nVerstöße:\n${formatViolations(violations)}`).toHaveLength(0)
  })

  // ─── RULE-09: Kein <div rounded-md border> als Table-Wrapper ─────────────
  it('RULE-09: Kein <div className="rounded-md border"> als Tabellen-Wrapper', () => {
    const violations = findViolations(
      appAndComponents,
      /className="rounded-md border"\s*>/
    )
    expect(violations, `\nVerstöße:\n${formatViolations(violations)}`).toHaveLength(0)
  })

  // ─── RULE-03: Kein p-8 allein auf Pages ──────────────────────────────────
  it('RULE-03: Seiten-Padding muss responsiv sein (p-6 lg:p-8, nicht "p-8" allein)', () => {
    const violations = findViolations(orgSlugPages, /className="p-8"/)
    expect(violations, `\nVerstöße:\n${formatViolations(violations)}`).toHaveLength(0)
  })

  // ─── RULE-17: Kein p-6 allein auf Pages (muss lg:p-8 haben) ─────────────
  it('RULE-17: Seiten-Padding p-6 muss von lg:p-8 begleitet sein', () => {
    // Erkennt: className="p-6" ohne lg:p-8 auf derselben Zeile
    const violations = findViolationsUnless(
      orgSlugPages,
      /className="p-6(?:\s[^"]*)?"/,
      /lg:p-8/
    )
    expect(violations, `\nVerstöße:\n${formatViolations(violations)}`).toHaveLength(0)
  })

  // ─── RULE-15: Seiten-Layout braucht max-w ────────────────────────────────
  it('RULE-15: UI-Pages müssen einen max-w-* Container haben', () => {
    // Redirect-only Pages brauchen kein max-w (kein UI-Output).
    // Erkennungsmerkmal: Datei enthält `className=` aber kein `max-w-`.
    const uiPages = orgSlugPages.filter((f) => {
      const content = fs.readFileSync(f, 'utf-8')
      return content.includes('className=') // hat sichtbares UI
    })
    const violations = mustContain(
      uiPages,
      /max-w-/,
      [
        // Fullscreen-Editor ohne Container-Beschränkung
        /scenarios\/\[id\]\/page\.tsx/,
        // Design-Showcase
        /app\/design\/page\.tsx/,
      ]
    )
    expect(violations, `\nVerstöße:\n${formatFileViolations(violations)}`).toHaveLength(0)
  })

  // ─── RULE-16: h2-Elemente müssen font-semibold verwenden ─────────────────
  it('RULE-16: h2-Elemente dürfen nicht font-bold verwenden (font-semibold ist korrekt)', () => {
    const violations = findViolations(
      appAndComponents,
      /<h2[^>]*\bfont-bold\b/,
      [/app\/design\/page\.tsx/]
    )
    expect(violations, `\nVerstöße:\n${formatViolations(violations)}`).toHaveLength(0)
  })

  // ─── RULE-20: TabsList darf kein extra className haben ────────────────────
  it('RULE-20: <TabsList> darf kein extra className= haben (Spacing über Tabs regeln)', () => {
    // Ausnahme: Formulare die TabsList als Grid-Container verwenden müssen
    const violations = findViolations(
      appAndComponents,
      /<TabsList\s+className=/,
      [
        /assistant-form\.tsx/,   // Grid-Layout für gleich breite Form-Tabs
        /app\/design\/page\.tsx/,
      ]
    )
    expect(violations, `\nVerstöße:\n${formatViolations(violations)}`).toHaveLength(0)
  })

  // ─── RULE-21: h1 gehört nur in page.tsx, nicht in components/ ────────────
  it('RULE-21: <h1> darf nur in page.tsx verwendet werden, nicht in components/', () => {
    const componentFiles = appAndComponents.filter((f) => /\/components\//.test(f))
    const violations = findViolations(
      componentFiles,
      /<h1[\s>]/,
      [
        /app\/design\/page\.tsx/,
        /header\.tsx/,             // Org-Name = Site-Level-h1 (explizit so definiert)
        /landing-content\.tsx/,   // Marketing-Hero, kein App-Screen
        /prompt-editor\.tsx/,     // String-Template für Markdown-HTML-Rendering
      ]
    )
    expect(violations, `\nVerstöße:\n${formatViolations(violations)}`).toHaveLength(0)
  })

  // ─── RULE-22: Card darf kein direktes Padding-className haben ────────────
  it('RULE-22: <Card className="p-*"> verboten — Padding gehört in CardContent', () => {
    // Ausnahmen: Analytics-Summary (kompakte Metric-Cards im Grid haben p-4),
    // KB Error-Card (Alert-Styling mit Custom-Border ist Sonderfall)
    const violations = findViolations(
      appAndComponents,
      /<Card\b[^>]*className="[^"]*\bp-[3-9]\b/,
      [
        /analytics-summary\.tsx/,        // kompakte Metric-Stats-Cards
        /knowledge-base-manager\.tsx/,   // Fehler-Alert-Card mit custom border
        /app\/design\/page\.tsx/,
      ]
    )
    expect(violations, `\nVerstöße:\n${formatViolations(violations)}`).toHaveLength(0)
  })

  // ─── RULE-23: CardTitle darf kein text-2xl haben ─────────────────────────
  it('RULE-23: <CardTitle> darf kein text-2xl verwenden (text-lg für Widget-Titel)', () => {
    // text-2xl gehört auf <h2> Sektion-Header, nicht auf CardTitle
    const violations = findViolations(
      appAndComponents,
      /<CardTitle\b[^>]*\btext-2xl\b/,
      [/app\/design\/page\.tsx/]
    )
    expect(violations, `\nVerstöße:\n${formatViolations(violations)}`).toHaveLength(0)
  })

})

// ---------------------------------------------------------------------------
// ══════════════════════════════════════════════════════════════════════════
// EMPTY STATES
// ══════════════════════════════════════════════════════════════════════════
// ---------------------------------------------------------------------------

describe('Design System Compliance — Empty States', () => {

  // ─── RULE-07: Empty-State Icons h-14 w-14 ────────────────────────────────
  it('RULE-07: Empty-State Icons müssen h-14 w-14 sein (nicht h-12 w-12)', () => {
    const violations = findViolations(
      appAndComponents,
      /h-12 w-12[^"]*mx-auto|mx-auto[^"]*h-12 w-12/,
      [/app\/design\/page\.tsx/]
    )
    expect(violations, `\nVerstöße:\n${formatViolations(violations)}`).toHaveLength(0)
  })

  // ─── RULE-08: Empty-State Icons text-neutral-400 ─────────────────────────
  it('RULE-08: Empty-State Icons müssen text-neutral-400 sein (nicht text-neutral-3xx)', () => {
    const violations = findViolations(
      appAndComponents,
      /text-neutral-3\d\d[^"]*mx-auto|mx-auto[^"]*text-neutral-3\d\d/,
      [/app\/design\/page\.tsx/]
    )
    expect(violations, `\nVerstöże:\n${formatViolations(violations)}`).toHaveLength(0)
  })

})

// ---------------------------------------------------------------------------
// ══════════════════════════════════════════════════════════════════════════
// NAVIGATION
// ══════════════════════════════════════════════════════════════════════════
// ---------------------------------------------------------------------------

describe('Design System Compliance — Navigation', () => {

  // ─── RULE-10: Sidebar Active-State muss Lime verwenden ───────────────────
  it('RULE-10: Sidebar Active-State darf keine neutral-100/200/300 Hintergrundfarbe haben', () => {
    const violations = findViolations(
      appAndComponents.filter((f) => /sidebar\.tsx$/.test(f)),
      /isActive.*bg-neutral-[1-3]00|bg-neutral-[1-3]00.*isActive/
    )
    expect(violations, `\nVerstöße:\n${formatViolations(violations)}`).toHaveLength(0)
  })

})

// ---------------------------------------------------------------------------
// ══════════════════════════════════════════════════════════════════════════
// INTERAKTION — Native Browser-Dialoge verboten
// ══════════════════════════════════════════════════════════════════════════
// ---------------------------------------------------------------------------

describe('Design System Compliance — Interaktion', () => {

  // ─── RULE-24: Kein confirm() ─────────────────────────────────────────────
  it('RULE-24: Kein confirm() — stattdessen shadcn/ui Dialog mit Bestätigungs-Button verwenden', () => {
    // Nur JS-Aufrufe: confirm( am Anfang einer Anweisung oder nach ! / = / ( / ,
    // Schließt reinen Fließtext (JSX-Strings, Kommentare) aus
    const violations = findViolations(
      appAndComponents,
      /(?:^|[!=(,;]\s*)\bconfirm\s*\(/
    )
    expect(violations, `\nVerstöße:\n${formatViolations(violations)}`).toHaveLength(0)
  })

  // ─── RULE-25: Kein alert() ───────────────────────────────────────────────
  it('RULE-25: Kein alert() — stattdessen toast.error() oder shadcn/ui Dialog verwenden', () => {
    const violations = findViolations(
      appAndComponents,
      /\balert\s*\(/
    )
    expect(violations, `\nVerstöße:\n${formatViolations(violations)}`).toHaveLength(0)
  })

  // ─── RULE-26: Kein prompt() ──────────────────────────────────────────────
  it('RULE-26: Kein prompt() — stattdessen shadcn/ui Dialog mit Input-Feld verwenden', () => {
    const violations = findViolations(
      appAndComponents,
      /\bprompt\s*\(/
    )
    expect(violations, `\nVerstöße:\n${formatViolations(violations)}`).toHaveLength(0)
  })

})

// ---------------------------------------------------------------------------
// ══════════════════════════════════════════════════════════════════════════
// WARNUNGEN — Hohe False-Positive-Rate, kein harter Fail
// ══════════════════════════════════════════════════════════════════════════
// ---------------------------------------------------------------------------

describe('Design System Compliance — Warnungen (informativ)', () => {

  // ─── RULE-18: Verdächtige hardcodierte Button-Labels ─────────────────────
  it('RULE-18 (Warnung): Verdächtige hardcodierte Button-Labels ohne t()-Wrapper', () => {
    // Erkennt: >Add Xyz< oder >Create Xyz< oder >Submit< in JSX ohne t(...)
    // Hohes False-Positive-Risiko — deshalb nur Warnung, kein harter Fail.
    const violations = findViolations(
      appAndComponents,
      />\s*(?:Add|Create|Submit|Remove)\s+[A-Z]/,
      [
        /app\/design\/page\.tsx/,
        /landing-content\.tsx/,
      ]
    )
    // Nur Logging, kein expect-Fail — dient als Inventar
    if (violations.length > 0) {
      console.warn(
        `\n[RULE-18 Warnung] ${violations.length} verdächtige hardcodierte Label gefunden:\n` +
        formatViolations(violations)
      )
    }
    // Kein toHaveLength(0) — ist nur informativ
    expect(true).toBe(true)
  })

})
