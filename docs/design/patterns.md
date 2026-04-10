# Layout & Kompositions-Patterns — Flow-IO Design System

---

## Seitenstruktur

Jede eingeloggte Seite folgt einem von drei Layouts. **Nie mischen.**

---

### Layout A — Seite mit Tabs

**Wann:** Mehrere verwandte Bereiche (z.B. Knowledge Base: Documents + Settings).

```tsx
// app/[orgSlug]/knowledge/page.tsx (Server Component)
export default async function KnowledgePage({ params }: { params: { orgSlug: string } }) {
  const t = await getTranslations('knowledge')
  // Daten-Fetches...

  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Page Title */}
        <h1 className="text-3xl font-bold tracking-tight mb-6">
          {t('title')}
        </h1>

        <Tabs defaultValue="documents" className="space-y-6">
          <TabsList>
            {/* Keine Icons in TabsTrigger */}
            <TabsTrigger value="documents">{t('tabs.documents')}</TabsTrigger>
            <TabsTrigger value="settings">{t('tabs.settings')}</TabsTrigger>
          </TabsList>

          <TabsContent value="documents" className="space-y-6">
            <KnowledgeDocuments documents={documents} />
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <KnowledgeSettings ... />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
```

**Regeln:**
- `h1 text-3xl font-bold` auf Seitenebene
- Keine Icons in `TabsTrigger`
- Tabs-Container: `space-y-6`
- Max-Width: `max-w-4xl` (einfache Seiten) oder `max-w-7xl` (weite Tabellen)

---

### Layout B — Standalone-Seite

**Wann:** Einzelner Inhaltsbereich ohne Sub-Navigation (z.B. Assistants).

```tsx
// app/[orgSlug]/assistants/page.tsx (Server Component)
export default async function AssistantsPage({ params }: { params: { orgSlug: string } }) {
  // Daten-Fetches...

  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Kein h1 auf Seitenebene — Komponente enthält eigenen h2 */}
        <AssistantsList assistants={assistants} organizationId={organization.id} />
      </div>
    </div>
  )
}
```

**Regeln:**
- Kein `h1` auf Seitenebene
- Die Komponente enthält einen eigenen `h2 text-2xl font-semibold` als Header
- Nur sinnvoll für einen Hauptbereich pro Seite

---

### Layout C — Dashboard / Analytics

**Wann:** Metriken + Widget-Kombination (z.B. Dashboard, Analytics).

```tsx
// app/[orgSlug]/dashboard/page.tsx (Server Component)
export default async function DashboardPage({ params }: { params: { orgSlug: string } }) {
  const t = await getTranslations('dashboard')
  // Parallele Daten-Fetches...

  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">{t('title')}</h2>
          <p className="text-[13px] text-neutral-500 dark:text-neutral-400 mt-1">
            {t('description')}
          </p>
        </div>

        {/* Stats-Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {statCards.map((card) => (
            <StatCard key={card.id} {...card} />
          ))}
        </div>

        {/* Widget-Layout: 2/3 + 1/3 */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <CallVolumeChart data={callVolumeData} />
            <RecentCallsCard calls={recentCalls} />
          </div>
          <div className="space-y-6">
            <SystemStatus status={systemStatus} />
            <TopVariables variables={topVariables} />
          </div>
        </div>

      </div>
    </div>
  )
}
```

**Regeln:**
- `h2` statt `h1` für Dashboard-Titel
- Stats-Grid: `grid-cols-2 md:grid-cols-4`
- Widget-Grid: `lg:grid-cols-3` mit `lg:col-span-2` für Haupt-Widget
- Alle Daten im Server Component parallel fetchen

---

## Section-Header in Komponenten

Für den Header einer Client-Komponente (Titel + CTA):

```tsx
{/* Standard */}
<div className="flex items-start justify-between mb-6">
  <div>
    <h2 className="text-2xl font-semibold tracking-tight">{t('title')}</h2>
    <p className="text-[13px] text-neutral-500 dark:text-neutral-400 mt-1">
      {t('description')}
    </p>
  </div>
  <Button onClick={handleCreate}>
    <Plus className="h-4 w-4 mr-2" />
    {t('actions.new')}
  </Button>
</div>

{/* Variante: Kein CTA */}
<div className="mb-6">
  <h2 className="text-2xl font-semibold tracking-tight">{t('title')}</h2>
  <p className="text-[13px] text-neutral-500 dark:text-neutral-400 mt-1">
    {t('description')}
  </p>
</div>
```

---

## Datenfetch-Pattern

```tsx
// ✅ Server Component fetcht alle Daten
export default async function Page({ params }) {
  const supabase = await createClient()
  const { data: assistants } = await supabase
    .from('assistants')
    .select('*')
    .eq('organization_id', organizationId)

  return <AssistantsList assistants={assistants} organizationId={organizationId} />
}

// ✅ Client Component nach Mutation: router.refresh()
'use client'
function AssistantsList({ assistants, organizationId }) {
  const router = useRouter()

  async function handleDelete(id: string) {
    await deleteAssistant(id)
    router.refresh() // Daten neu laden ohne Full-Reload
  }

  return (...)
}
```

---

## Card-Grid vs. Table-List

### Card-Grid (nur für Stats/Features)
```tsx
{/* Stats: grid */}
<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
  {stats.map(stat => <StatCard key={stat.id} {...stat} />)}
</div>

{/* Features: grid */}
<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
  {features.map(f => <FeatureCard key={f.id} {...f} />)}
</div>
```

### Item-Card-Liste (für Entitäten: Assistants, Scenarios etc.)
```tsx
{/* IMMER space-y, nie grid */}
<div className="space-y-4">
  {items.map(item => <ItemCard key={item.id} {...item} />)}
</div>
```

### Tabelle (für tabellarische Daten)
```tsx
{/* Immer in <Card> wrappen */}
<Card>
  <Table>...</Table>
</Card>
```

**Entscheidungsregel:**
- Entities (Assistants, Phone Numbers, etc.) → ItemCard-Liste
- Tabellarische Daten mit Sortierung/Pagination (Calls, Variables) → Table
- Metriken/Zahlen → StatCard-Grid
- Funktionen/Features → FeatureCard-Grid

---

## Dialog vs. eigene Seite

| Kriterium | Dialog | Eigene Seite |
|-----------|--------|-------------|
| ≤ 4 Felder, keine Abhängigkeiten | ✅ | |
| Bedingte Felder | | ✅ |
| Multi-Step Wizard | | ✅ |
| Benötigt eigene URL | | ✅ |
| Lösch-Bestätigung | ✅ (AlertDialog) | |
| Daten-Detail-Ansicht | ✅ (Large Dialog) | |
| Komplexer Editor | | ✅ |

---

## Responsive Verhalten

### Breakpoints
```
sm:  640px   — Tablet hoch
md:  768px   — Tablet quer
lg:  1024px  — Desktop
xl:  1280px  — Großer Desktop
2xl: 1536px  — Wide
```

### Standard-Responsive-Klassen
```
p-6 lg:p-8                        Page-Padding
max-w-7xl mx-auto                 Container
grid-cols-2 md:grid-cols-4        Stats-Grid
grid-cols-1 md:grid-cols-3        Feature-Grid
lg:grid-cols-3                    Dashboard-Grid
text-sm md:text-xs                Responsive Text (Tabellen)
gap-4 lg:gap-6                    Responsive Gap
```

---

## Sidebar-Navigation

Die Sidebar ist dunkel, schwebend (floating) und zusammenklappbar. Zustand wird in `localStorage` persistiert.

**Struktur: zwei verschachtelte Divs**
- Äußeres Div: Breiten-Transition + `relative group` (kein `overflow-hidden`) — ermöglicht den herausragenden Hover-Button
- Inneres Div: sichtbare Sidebar mit `rounded-xl shadow-xl overflow-hidden`

**Layout-Container** (`app/[orgSlug]/layout.tsx`):
```tsx
<div className="h-screen overflow-hidden flex bg-neutral-100 dark:bg-neutral-950">
  {/* Wrapper mit Abstand: 12px oben/links/unten, kein rechter Abstand */}
  <div className="p-3 pr-0 flex shrink-0">
    <DashboardSidebar ... />
  </div>
  <div className="flex-1 flex flex-col overflow-hidden">
    <DashboardHeader ... />
    <main className="flex-1 overflow-auto">{children}</main>
  </div>
</div>
```

**Sidebar-Komponente** (vereinfacht):
```tsx
// Äußeres Div: Breite wechselt zwischen w-16 (collapsed) und w-64
<div className={cn(
  'relative group shrink-0 h-full transition-all duration-200 ease-in-out',
  collapsed ? 'w-16' : 'w-64'
)}>
  {/* Inneres Div: sichtbares Element */}
  <div className="bg-neutral-900 rounded-xl shadow-xl overflow-hidden h-full flex flex-col">
    {/* Header: Logo + optionaler Collapse-Button */}
    {/* Nav-Items */}
    <nav className="flex-1 px-2 space-y-0.5 py-2">
      <Link className={cn(
        'flex items-center rounded-lg text-sm font-medium transition-colors',
        collapsed ? 'justify-center h-10 w-full' : 'gap-3 px-3 py-2',
        isActive
          ? 'bg-white/15 text-white'
          : 'text-neutral-400 hover:bg-white/10 hover:text-white'
      )} />
    </nav>
    {/* Kein Footer — Org-Info lebt im Header-Dropdown */}
  </div>

  {/* Floating Expand-Button: erscheint on hover, ragt rechts heraus */}
  {collapsed && (
    <button className={cn(
      'absolute top-3 -right-10 z-10',
      'w-9 h-9 rounded-lg bg-neutral-800 border border-white/5 shadow-lg',
      'text-neutral-400 hover:text-white',
      'opacity-0 group-hover:opacity-100 translate-x-1 group-hover:translate-x-0',
      'transition-all duration-150',
    )}>
      <PanelLeftOpen className="h-4 w-4" />
    </button>
  )}
</div>
```

**Regeln:**
- Org-Name und Nutzerrolle gehören ins Header-Dropdown, **nicht** in die Sidebar
- Im collapsed-Zustand: Tooltips (`side="right"`) für alle Nav-Items
- Aktiv-Zustand: `bg-white/15 text-white` (kein farbiges Highlight im Dark-Theme)
- Setup-Hinweis (kein Telefon eingerichtet): `bg-amber-500/20 text-amber-300`

---

## Allgemeine Regeln

1. **Server Components fetchen** — Keine Client-seitigen Data-Fetches für initiale Daten
2. **`router.refresh()` nach Mutations** — Keine manuellen State-Updates für Listen
3. **`space-y-4` für Item-Listen** — Nie `grid` für Entity-Listen
4. **Empty States außerhalb der Tabelle** — Eigene `Card` mit `py-16`
5. **Max-Width immer setzen** — Kein unbegrenzt breites Layout
6. **Padding immer `p-6 lg:p-8`** auf Page-Ebene
7. **Transitions bei hover** — `transition-colors duration-[120ms]` auf interaktiven Elementen
