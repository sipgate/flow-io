# Flow-IO Design System — LLM Quick Reference

**Version**: 1.0 · **Palette**: Carbon + Lime · **Framework**: Next.js 15 + Tailwind v4 + shadcn/ui

Dieses Dokument ist der primäre Einstiegspunkt für LLMs beim Arbeiten mit dem Flow-IO UI.
Lies dieses Dokument vollständig, bevor du Komponenten erstellst oder bearbeitest.

---

## Dokumentenindex

| Dokument | Zweck |
|----------|-------|
| **`design/tokens.md`** | Alle Farb-, Typo-, Spacing-, Shadow- und Motion-Tokens |
| **`design/components.md`** | Vollständige JSX-Patterns für alle Komponenten |
| **`design/patterns.md`** | Seitenstrukturen, Layouts, Kompositionsregeln |
| **`design/guidelines.md`** | Copy-Regeln, Labels, Empty States, i18n |
| **`app/design/page.tsx`** | Visueller Showcase (live unter `/design`) |

---

## 7 Designprinzipien

1. **Weiß zuerst** — Der eingeloggte Bereich ist clean und hell. Farbe kommt durch Akzente, nicht durch Hintergründe.
2. **Lime ist Aktion** — `lime-600` (light) / `lime-400` (dark) steht ausschließlich für primäre Brand-Aktionen und Status "Active".
3. **Violett ist sekundär** — `purple-600` für Akzent-Elemente, nie für Status.
4. **Tiefe durch Layering** — Verwende 3 Surface-Ebenen (`white` → `neutral-50` → `neutral-100`), keine Schatten-Exzesse.
5. **Typografie ist Hierarchie** — Exakte Größen/Weights laut Token-Tabelle. Kein `font-bold` auf Body-Text.
6. **Konsistenz über Kreativität** — Nutze Bestehende Patterns. Erfinde keine neuen Kompositionsmuster.
7. **Kein hardcodierter Text** — Immer `useTranslations()`, kein inline-String.

---

## Quick Reference: Häufigste Klassen

### Text
```
text-[0.6875rem]          caption       (11px, 0.02em tracking)
text-xs font-medium       label-sm      (12px, 0.02em)
text-[0.8125rem] font-medium  label-md  (13px, 0.015em)
text-sm                   body-md       (14px)
text-sm font-medium       label-lg      (14px, 0.01em)
text-base                 body-lg       (16px)
text-lg font-semibold     heading-sm    (18px, -0.005em)
text-xl font-semibold     heading-md    (20px, -0.01em)
text-2xl font-semibold    heading-lg    (24px, -0.015em)
text-3xl font-bold        heading-xl    (30px, -0.02em)
text-4xl font-bold        display-sm    (36px, -0.025em)
text-5xl font-bold        display-lg    (48px, -0.03em)
```

### Farbe (Light Mode)
```
bg-white                  surface-1
bg-neutral-50             surface-2
bg-neutral-100            surface-3
bg-neutral-950            text-primary
text-neutral-500          text-secondary
text-neutral-400          text-muted
border-neutral-200        border-subtle
border-neutral-300        border-default
bg-lime-500               brand primary bg
text-lime-700             brand primary text
text-purple-600           accent text
```

### Farbe (Dark Mode)
```
dark:bg-neutral-950       base
dark:bg-neutral-900       surface-1
dark:bg-neutral-800       surface-2
dark:bg-neutral-700       surface-3
dark:text-neutral-50      text-primary
dark:text-neutral-400     text-secondary
dark:text-neutral-600     text-muted
dark:border-neutral-800   border-subtle
dark:border-neutral-700   border-default
dark:bg-lime-400          brand primary bg (dark)
dark:text-lime-400        brand primary text (dark)
dark:text-purple-400      accent text (dark)
```

---

## Decision Tree: Welchen Button nutze ich?

```
Primäre Aktion (speichern, erstellen, absenden)?
  └─ <Button>New Assistant</Button>

Sekundäre Aktion (bearbeiten, exportieren)?
  └─ <Button variant="outline" size="sm">Edit</Button>

Zerstörerische Aktion (löschen)?
  └─ <Button variant="outline" size="sm">
       <Trash2 className="h-4 w-4 mr-2 text-red-500" />Delete
     </Button>

Inline-Aktion in Tabelle (Icon only)?
  └─ <Button variant="ghost" size="icon" className="h-7 w-7">
       <Pencil className="h-3.5 w-3.5" />
     </Button>

Navigation/Link?
  └─ <Button variant="link">Go to settings</Button>
```

## Decision Tree: Dialog vs. eigene Seite?

```
Formular mit ≤ 4 Feldern und keine Abhängigkeiten?
  └─ Dialog (sm:max-w-lg)

Formular mit bedingten Feldern / Wizard-Steps?
  └─ Eigene Seite (/entity/new)

Lösch-Bestätigung?
  └─ AlertDialog (sm:max-w-sm)

Großes Daten-Detail (Call-Analyse etc.)?
  └─ Dialog (sm:max-w-6xl) oder Seite
```

## Decision Tree: Card vs. Tabelle?

```
Jedes Item hat Icon, Name, Description, Status-Badge, 2+ Aktionen?
  └─ ItemCard-Liste (space-y-4)

Items sind tabellarisch (viele Spalten, Sortierung, Pagination)?
  └─ Table in <Card>

Metriken / Stats?
  └─ StatCard-Grid (grid-cols-2 md:grid-cols-4)

Marketing / Feature-Highlights?
  └─ FeatureCard-Grid (grid-cols-1 md:grid-cols-3)
```

---

## Icon-Tabelle (Lucide Icons)

| Icon | Import | Verwendung | Farbe |
|------|--------|-----------|-------|
| `Bot` | `lucide-react` | Assistants | `text-indigo-500` |
| `Phone` | `lucide-react` | Phone Numbers | `text-teal-500` |
| `GitBranch` | `lucide-react` | Scenarios | `text-violet-500` |
| `Layers` | `lucide-react` | Knowledge Base | `text-amber-500` |
| `MessageSquare` | `lucide-react` | Chat | `text-green-500` |
| `FlaskConical` | `lucide-react` | Autotest | `text-blue-500` |
| `Cable` | `lucide-react` | Connect/MCP | `text-orange-500` |
| `BarChart3` | `lucide-react` | Analytics | `text-purple-500` |
| `Settings` | `lucide-react` | Settings | `text-neutral-500` |
| `LayoutDashboard` | `lucide-react` | Dashboard | `text-neutral-500` |
| `Plus` | `lucide-react` | Neue Entität erstellen | — |
| `Trash2` | `lucide-react` | Löschen | `text-red-500` |
| `Pencil` | `lucide-react` | Bearbeiten | — |
| `Globe` | `lucide-react` | Sprache/Spracheinstellung | — |
| `Check` | `lucide-react` | Erfolg bestätigen | — |
| `X` | `lucide-react` | Schließen/Abbrechen | — |
| `Search` | `lucide-react` | Suchfeld | — |
| `Loader2` | `lucide-react` | Ladeindikator (animate-spin) | — |
| `AlertTriangle` | `lucide-react` | Warnung | `text-amber-500` |
| `CheckCircle2` | `lucide-react` | Erfolgsstatus | `text-green-500` |
| `XCircle` | `lucide-react` | Fehlerstatus | `text-red-500` |
| `Activity` | `lucide-react` | Live/Aktiv | `text-green-500` |
| `Clock` | `lucide-react` | Dauer/Zeit | `text-orange-500` |
| `TrendingUp` | `lucide-react` | Wachstum/Trend | `text-purple-500` |
| `Zap` | `lucide-react` | Schnell-Aktionen | `text-amber-500` |
| `Variable` | `lucide-react` | Variablen | `text-pink-500` |
| `Star` | `lucide-react` | Entry-Point | `text-violet-500` |
| `Download` | `lucide-react` | Export | — |
| `Upload` | `lucide-react` | Import | — |
| `ArrowLeft` | `lucide-react` | Zurück-Navigation | — |

---

## Status-Badge Farb-Mapping

| Status | Badge-Klassen | Tailwind-Klassen |
|--------|--------------|-----------------|
| Active | `bg-lime-500/10 text-lime-700 dark:bg-lime-400/10 dark:text-lime-400` | — |
| Inactive | `bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400` | — |
| Pending | `bg-amber-500/10 text-amber-700 dark:text-amber-400` | — |
| Error / Failed | `bg-red-500/10 text-red-600 dark:text-red-400` | — |
| Healthy | `bg-lime-500/10 text-lime-700 dark:text-lime-400` | — |
| Processing | `bg-blue-500/10 text-blue-600 dark:text-blue-400` | — |

---

## Anti-Patterns (was zu vermeiden ist)

```tsx
// ❌ Nie hardcodierte Strings
<h2>Assistants</h2>
// ✅ Immer i18n
<h2>{t('title')}</h2>

// ❌ Nie "Add" oder "Create" als Button-Label
<Button>Add Assistant</Button>
// ✅ Immer "New [Entity]"
<Button>New Assistant</Button>

// ❌ Nie grid für normale Item-Listen
<div className="grid grid-cols-2 gap-4">{items.map(...)}</div>
// ✅ Immer space-y für Item-Listen
<div className="space-y-4">{items.map(...)}</div>

// ❌ Nie Card für den Section-Header
<Card><CardHeader><h2>Section</h2></CardHeader></Card>
// ✅ Section-Header immer plain div
<div className="flex justify-between items-center">
  <h2 className="text-2xl font-semibold">Section</h2>
</div>

// ❌ Nie Status-Badges klein schreiben
<Badge>active</Badge>
// ✅ Immer kapitalisiert
<Badge>Active</Badge>

// ❌ Nie any-Types
const data: any = await fetch(...)
// ✅ Typisierte Interfaces
const data: Assistant[] = await fetch(...)

// ❌ Nie shadows statt borders für Tiefe
className="shadow-2xl"
// ✅ Borders + subtile Schatten
className="border border-neutral-200 shadow-sm"
```

---

## Komponent-Import-Pfade

```tsx
// shadcn/ui
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

// Icons
import { Plus, Trash2, Pencil, Bot, Phone, Loader2 } from "lucide-react"

// i18n
import { useTranslations } from "next-intl"

// Navigation
import { useRouter } from "next/navigation"
import Link from "next/link"
```
