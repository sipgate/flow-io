# UI & UX Patterns

Diese Patterns wurden gemeinsam definiert und müssen in allen neuen und bestehenden Bereichen konsequent angewendet werden.

## Sidebar-Navigation
- Bereiche mit gemeinsamem Zweck werden als **ein** Sidebar-Eintrag zusammengefasst
- Die Unterteilung erfolgt über Tabs auf der Seite – nicht über separate Sidebar-Einträge
- Zugriffsschutz (Admin-only) wird auf Seitenebene (Tab sichtbar/unsichtbar) geregelt, nicht durch Sidebar-Filterung

## Seitenstruktur: zwei Varianten

### Variante A – Seite mit Tabs
Referenz: `app/[orgSlug]/knowledge/page.tsx`

```tsx
<div className="p-8">
  <div className="max-w-[4xl|7xl] mx-auto">
    <h1 className="text-3xl font-bold mb-6">{t('title')}</h1>

    <Tabs defaultValue="..." className="space-y-6">
      <TabsList>
        <TabsTrigger value="tab1">{t('tabs.tab1')}</TabsTrigger>
      </TabsList>
      <TabsContent value="tab1" className="space-y-6">
        <MyComponent ... />
      </TabsContent>
    </Tabs>
  </div>
</div>
```

- **Kein** Beschreibungstext zwischen `h1` und `Tabs` – dieser gehört in die Komponente
- **Keine** Icons in `TabsTrigger` bei Seiten-Level-Navigation
- **Kein** extra `className` auf `TabsList` (das `space-y-6` auf `Tabs` reicht)
- URL-basierter Tab-State via `searchParams` bei Redirects aus anderen Routen

### Variante B – Standalone-Seite (ohne Tabs)
Referenz: `app/[orgSlug]/scenarios/page.tsx`

```tsx
<div className="p-8">
  <div className="max-w-7xl mx-auto">
    <MyComponent ... />
  </div>
</div>
```

- **Kein** `h1` auf Seitenebene – die Komponente enthält den gesamten Sektion-Header (`h2 text-2xl`)
- Die Seite ist ein reiner Wrapper ohne eigenen Titel
- Gilt für alle Seiten, die nur einen einzigen Inhaltsbereich haben

### Variante C – Dashboard / Analytics-Übersicht
Referenz: `app/[orgSlug]/dashboard/page.tsx`

```tsx
<div className="p-6 lg:p-8">
  <div className="max-w-7xl mx-auto space-y-6">
    <div>
      <h2 className="text-2xl font-bold">{t('title')}</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
        {t('welcome')}
      </p>
    </div>

    <StatsCards ... />

    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-6">...</div>
      <div className="space-y-6">...</div>
    </div>
  </div>
</div>
```

- Header (`h2 text-2xl`) direkt auf der Seite, **nicht** in einer Komponente – weil kein einzelner Wrapper-Component existiert
- `h2` (nicht `h1`), da die Top-Nav-`header.tsx` bereits ein `h1` (Organisationsname) enthält
- **Stat-/Metric-Cards** dürfen in einem Grid liegen: `grid-cols-2 md:grid-cols-4` – das ist die **einzige Ausnahme** zur „kein Grid"-Regel
- **Widget-Cards** (Charts, Tabellen, Status-Panels) ebenfalls Grid-basiert für das Dashboard-Layout
- Widget-Card-Titel: `CardTitle` mit `text-lg font-semibold` – **nicht** `text-2xl` wie der Sektion-Header

## Sektion-Header in Komponenten

```tsx
<div className="flex justify-between items-center">
  <div>
    <h2 className="text-2xl font-bold">{t('title')}</h2>
    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
      {t('description')}
    </p>
  </div>
  <Button onClick={...}>
    <Plus className="h-4 w-4 mr-2" />
    {t('createNew')}
  </Button>
</div>
```

Regeln:
- Plain `<div>`, **nicht** in `<Card>` gewrapped
- `h2 text-2xl font-bold`, description `text-sm text-slate-500 mt-1`

## Item-Cards
Immer `Card` + `CardHeader` + `CardTitle` + `CardDescription` + `CardContent` verwenden. **Nie** `<Card className="p-6">` mit eigenem `h3`.

Card-Listen immer als `<div className="space-y-4">` – **kein** `grid grid-cols-*`. Karten sind stets volle Breite.

- **CardHeader rechts**: nur Status-Badges (z. B. Dokumentenzahl, Active/Unknown) – **keine** Action-Buttons
- **CardContent unten**: Action-Buttons (`Upload`, `Edit`, `Delete` etc.)

```tsx
<Card>
  <CardHeader className="pb-3">
    <div className="flex items-start justify-between">
      <div className="flex items-start gap-3">
        <Icon className="h-5 w-5 mt-1 text-slate-400" />
        <div>
          <CardTitle className="text-lg">{item.name}</CardTitle>
          {item.description && (
            <CardDescription className="mt-1">{item.description}</CardDescription>
          )}
        </div>
      </div>
      {/* Status-Badges rechts oben */}
      <div className="flex items-center gap-2">
        <Badge variant="secondary">{item.statusLabel}</Badge>
      </div>
    </div>
  </CardHeader>
  <CardContent className="pt-0">
    {/* Detailinhalt */}
    <div className="flex items-center gap-2 mt-4">
      {/* Action-Buttons unten links */}
      <Button variant="outline" size="sm">...</Button>
      <Button variant="outline" size="sm"><Trash2 className="h-4 w-4 mr-2 text-red-500" />Delete</Button>
    </div>
  </CardContent>
</Card>
```

## Tabellenbasierte Listen
Für Seiten mit tabellarischen Daten (z. B. Scenarios):

- Bei **leerer Liste**: Tabelle **nicht** rendern – stattdessen Standard-Empty-State-Card
- Bei **gefüllter Liste**: Tabelle in `<Card>` wrappen
- Inline-Aktionsbuttons in Tabellenzeilen: `variant="ghost" size="icon"` (klein, kein Text)

```tsx
{items.length === 0 ? (
  <Card>
    <CardContent className="text-center py-12">
      ...
    </CardContent>
  </Card>
) : (
  <Card>
    <Table>
      <TableHeader>...</TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id}>
            ...
            <TableCell>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </Card>
)}
```

## Empty States

```tsx
<Card>
  <CardContent className="text-center py-12">
    <Icon className="h-12 w-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
    <h3 className="font-medium mb-1">{t('empty.title')}</h3>
    <p className="text-sm text-slate-500 mb-4">{t('empty.description')}</p>
    <Button>
      <Plus className="h-4 w-4 mr-2" />
      {t('createNew')}
    </Button>
  </CardContent>
</Card>
```

## Button-Varianten

| Zweck | Variante |
|---|---|
| Primäre Aktion (neu anlegen) | `<Button>` (default) |
| Sekundäre Aktionen (bearbeiten, testen) | `variant="outline" size="sm"` mit Icon + Text |
| Löschen | `variant="outline" size="sm"` mit `<Trash2 className="h-4 w-4 mr-2 text-red-500" />` + Text |
| Inline-Zeilen-Aktionen (Tabellen) | `variant="ghost" size="icon" className="h-7 w-7"` |

## Button-Label-Konvention
- **Immer** „New [Entity]" für primäre Erstellungsaktionen – nicht „Add" oder „Create"
- Beispiele: „New Knowledge Base", „New MCP Server", „New Assistant"
- Konsistenz innerhalb derselben Seite ist Pflicht

## Dialog-Breiten

Der Default `DialogContent` ist auf `sm:max-w-lg` begrenzt. Breite **immer** mit `sm:`-Präfix angeben, sonst überschreibt es den Default in die falsche Richtung:

| Inhalt | Klasse |
|---|---|
| Einfaches Formular (Standard) | *(kein className nötig → Default `sm:max-w-lg`)* |
| Medium (z.B. Telefonnummern) | `sm:max-w-md` |
| Groß (z.B. Variablen, Vergleich) | `sm:max-w-3xl` |
| Extra groß (z.B. Call-Details) | `sm:max-w-6xl` |

```tsx
// ✅ Richtig
<DialogContent className="sm:max-w-3xl max-h-[85vh]">
// ❌ Falsch – überschreibt sm:max-w-lg in die falsche Richtung
<DialogContent className="max-w-3xl max-h-[85vh]">
```

## Dialog vs. eigene Seite für Erstellungsformulare

| Kriterium | Dialog | Eigene Seite |
|---|---|---|
| Anzahl Felder | ≤ 3–4 | Viele |
| Felder bedingen sich | Nein | Ja (z.B. Auth-Typ wechselt verfügbare Felder) |
| Mehrstufig | Nein | Ja |
| Eingebettete Aktionen | Nein | Ja (z.B. Verbindungstest) |
| Nach Erstellen | Nutzer bleibt in Kontext | Weiterleitung logisch |

Beispiele: Knowledge Base (Name + Beschreibung) → Dialog. MCP Server (URL, Auth-Typ, Credentials, Verbindungstest) → eigene Seite.

## Datenfetch-Architektur
- **Server Components** fetchen alle Daten – auch für Client Components – via `Promise.all`
- Daten werden als Props übergeben; Client Components fetchen **nie** initial via `useEffect`
- Nach Mutationen in Client Components: `router.refresh()` statt erneutem Fetch
- Zugriffssteuerung (z. B. `isAdmin`) ausschließlich im Server Component

```tsx
// ✅ Richtig: Server Component fetcht alles parallel
const [{ items }, { analytics }] = await Promise.all([
  getItems(organization.id),
  getAnalytics(organization.id),
])

// ✅ Richtig: Client Component nach Mutation
await deleteItem(id)
router.refresh()

// ❌ Falsch: Client Component fetcht selbst
useEffect(() => { loadItems() }, [])
```

## Internationalisierung (i18n)

- **Keine** hardcodierten Strings in Komponenten – alles in `messages/de.json`, `messages/en.json`, `messages/es.json`
- Status-Badges immer großgeschrieben: „Active", „Healthy" – nicht „active", „healthy"
- Auf Konsistenz zwischen Tabs/Sektionen einer Seite achten (gleicher Verb, gleicher Stil)
- Pluralformen mit ICU-Syntax: `"{count, plural, one {# Item} other {# Items}}"`

**Deutsch-spezifisch:**
- Komposita mit Fremdwörtern brauchen Bindestrich: „MCP-Server", nicht „MCP Server"
- Progressive Verbformen verwenden: „Wird getestet…", nicht „Teste…"
