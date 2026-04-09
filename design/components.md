# Komponent-Patterns — Flow-IO Design System

Alle Patterns sind vollständige, copy-pastable JSX/TSX-Snippets.
Imports werden pro Abschnitt angegeben.

---

## Buttons

### Imports
```tsx
import { Button } from "@/components/ui/button"
import { Loader2, Plus, Trash2, Pencil, Download } from "lucide-react"
```

### Varianten-Übersicht

```tsx
{/* PRIMARY — Brand-Aktion: Erstellen, Speichern, Absenden */}
<Button>
  <Plus className="h-4 w-4 mr-2" />
  New Assistant
</Button>

{/* SECONDARY — Sekundäre Aktion: Bearbeiten, Exportieren */}
<Button variant="outline" size="sm">
  <Pencil className="h-4 w-4 mr-2" />
  Edit
</Button>

{/* DANGER — Zerstörerische Aktionen */}
<Button variant="outline" size="sm">
  <Trash2 className="h-4 w-4 mr-2 text-red-500" />
  Delete
</Button>

{/* GHOST ICON — Inline-Aktionen in Tabellen */}
<Button variant="ghost" size="icon" className="h-7 w-7">
  <Pencil className="h-3.5 w-3.5" />
</Button>
<Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20">
  <Trash2 className="h-3.5 w-3.5" />
</Button>

{/* GHOST TEXT — Navigation, Links */}
<Button variant="ghost" size="sm">
  View all
</Button>

{/* LINK — Inline-Links */}
<Button variant="link" className="p-0 h-auto">
  Learn more
</Button>

{/* DESTRUCTIVE — AlertDialog-Bestätigungen */}
<Button variant="destructive">
  Delete Permanently
</Button>
```

### States

```tsx
{/* LOADING */}
<Button disabled>
  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
  Saving...
</Button>

{/* DISABLED */}
<Button disabled>
  New Assistant
</Button>

{/* ICON ONLY (kein Text) */}
<Button variant="outline" size="icon">
  <Download className="h-4 w-4" />
</Button>
```

### Größen-Matrix

| Größe | Klasse | Höhe | Verwendung |
|-------|--------|------|-----------|
| `default` | `<Button>` | h-9 (36px) | Primär-Aktionen |
| `sm` | `size="sm"` | h-8 (32px) | Sekundär, in Cards |
| `lg` | `size="lg"` | h-10 (40px) | Call-to-Action, Hero |
| `icon` | `size="icon"` | 36×36px | Standalone-Icons |
| `icon-sm` | Custom: `size="icon" className="h-7 w-7"` | 28×28px | Tabellen-Actions |

---

## Badges

### Imports
```tsx
import { Badge } from "@/components/ui/badge"
```

### Status-Badges

```tsx
{/* Active / Healthy / Success */}
<Badge className="bg-lime-500/10 text-lime-700 border-lime-200 dark:bg-lime-400/10 dark:text-lime-400 dark:border-lime-800">
  Active
</Badge>

{/* Inactive / Disabled */}
<Badge variant="secondary">
  Inactive
</Badge>

{/* Pending / Processing */}
<Badge className="bg-amber-500/10 text-amber-700 border-amber-200 dark:bg-amber-400/10 dark:text-amber-400 dark:border-amber-800">
  Pending
</Badge>

{/* Error / Failed */}
<Badge className="bg-red-500/10 text-red-600 border-red-200 dark:bg-red-400/10 dark:text-red-400 dark:border-red-800">
  Error
</Badge>

{/* Info / Feature */}
<Badge className="bg-blue-500/10 text-blue-600 border-blue-200 dark:bg-blue-400/10 dark:text-blue-400 dark:border-blue-800">
  Beta
</Badge>

{/* Brand / Special */}
<Badge className="bg-purple-500/10 text-purple-600 border-purple-200 dark:bg-purple-400/10 dark:text-purple-400 dark:border-purple-800">
  Entry Point
</Badge>

{/* Neutral Label */}
<Badge variant="outline">
  OpenAI GPT-4o
</Badge>
```

---

## Cards

### Imports
```tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Bot, Trash2, Pencil } from "lucide-react"
```

### 1. ItemCard — Standard Entity-Card

```tsx
<Card className="hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors duration-[120ms] cursor-pointer"
      onClick={() => router.push(`/assistants/${assistant.id}`)}>
  <CardHeader className="pb-3">
    <div className="flex items-start justify-between">
      <div className="flex items-start gap-3">
        {/* Icon oder Avatar */}
        <div className="w-9 h-9 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0">
          <Bot className="h-4.5 w-4.5 text-indigo-500" />
        </div>
        <div className="min-w-0">
          <CardTitle className="text-[15px] font-semibold leading-snug">
            {assistant.name}
          </CardTitle>
          {assistant.description && (
            <CardDescription className="text-[13px] mt-0.5 line-clamp-2">
              {assistant.description}
            </CardDescription>
          )}
        </div>
      </div>
      {/* Status-Badge oben rechts */}
      <div className="flex items-center gap-2 shrink-0 ml-3">
        <Badge className="bg-lime-500/10 text-lime-700 border-lime-200 dark:bg-lime-400/10 dark:text-lime-400 dark:border-lime-800">
          Active
        </Badge>
      </div>
    </div>
  </CardHeader>
  <CardContent className="pt-0">
    {/* Meta-Informationen */}
    <div className="flex flex-wrap gap-3 text-[12px] text-neutral-500 dark:text-neutral-400 mb-4">
      <span>{assistant.voice_provider} · {assistant.voice_language}</span>
      <span>{assistant.llm_provider} · {assistant.llm_model}</span>
    </div>
    {/* Action-Buttons immer unten in CardContent */}
    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
      <Button variant="outline" size="sm" onClick={() => router.push(`/assistants/${assistant.id}`)}>
        <Pencil className="h-4 w-4 mr-2" />
        Edit
      </Button>
      <Button variant="outline" size="sm" onClick={() => handleDelete(assistant.id)}>
        <Trash2 className="h-4 w-4 mr-2 text-red-500" />
        Delete
      </Button>
    </div>
  </CardContent>
</Card>
```

### 2. StatCard — Metriken und KPIs

```tsx
<Card className="p-4 hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors duration-[120ms]">
  <div className="flex items-center gap-3">
    {/* Icon mit farbigem Hintergrund */}
    <div className="w-9 h-9 rounded-lg bg-lime-500/10 flex items-center justify-center shrink-0">
      <Activity className="h-4.5 w-4.5 text-lime-600 dark:text-lime-400" />
    </div>
    <div className="min-w-0">
      <p className="text-[12px] font-medium text-neutral-500 dark:text-neutral-400 leading-none mb-1">
        Active Calls
      </p>
      <p className="text-2xl font-bold tracking-tight leading-none tabular-nums">
        3
      </p>
    </div>
  </div>
</Card>

{/* StatCard mit Highlight (aktiver Status) */}
<Card className="p-4 ring-2 ring-lime-500 ring-offset-2 dark:ring-lime-400 dark:ring-offset-neutral-950">
  <div className="flex items-center gap-3">
    <div className="w-9 h-9 rounded-lg bg-lime-500/10 flex items-center justify-center shrink-0">
      <Activity className="h-4.5 w-4.5 text-lime-600 dark:text-lime-400" />
    </div>
    <div>
      <p className="text-[12px] font-medium text-neutral-500 dark:text-neutral-400 leading-none mb-1">
        Active Calls
      </p>
      <p className="text-2xl font-bold tracking-tight leading-none tabular-nums text-lime-700 dark:text-lime-400">
        3
      </p>
    </div>
  </div>
</Card>
```

### 3. FeatureCard — Übersichtliche Feature-Kachel

```tsx
<Card className="p-5 flex flex-col gap-3">
  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-lime-500/20 to-purple-600/20 flex items-center justify-center">
    <Zap className="h-5 w-5 text-lime-600 dark:text-lime-400" />
  </div>
  <div>
    <h3 className="text-[15px] font-semibold leading-snug mb-1">
      Auto-Extraction
    </h3>
    <p className="text-[13px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
      Automatically extracts variables from conversations in real-time.
    </p>
  </div>
  <Button variant="link" className="p-0 h-auto text-[13px] text-lime-600 dark:text-lime-400 w-fit">
    Learn more →
  </Button>
</Card>
```

### 4. SectionCard — Wrapper für Formulare und Listen

```tsx
<Card>
  <CardHeader className="border-b border-neutral-100 dark:border-neutral-800">
    <div className="flex items-center justify-between">
      <div>
        <CardTitle className="text-lg font-semibold">Section Title</CardTitle>
        <CardDescription className="text-[13px] mt-0.5">
          Optional description text.
        </CardDescription>
      </div>
      <Button size="sm">
        <Plus className="h-4 w-4 mr-2" />
        New Item
      </Button>
    </div>
  </CardHeader>
  <CardContent className="pt-4">
    {/* Inhalt */}
  </CardContent>
</Card>
```

---

## Tables

### Imports
```tsx
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Pencil, Trash2, Phone } from "lucide-react"
```

### Standard Table mit Empty State

```tsx
{items.length === 0 ? (
  // Empty State: AUSSERHALB der Tabelle, in eigener Card
  <Card>
    <CardContent className="text-center py-16">
      <div className="w-14 h-14 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mx-auto mb-4">
        <Phone className="h-7 w-7 text-neutral-400" />
      </div>
      <h3 className="text-[15px] font-semibold mb-1.5">
        {t('empty.title')}
      </h3>
      <p className="text-[13px] text-neutral-500 dark:text-neutral-400 mb-5 max-w-xs mx-auto">
        {t('empty.description')}
      </p>
      <Button>
        <Plus className="h-4 w-4 mr-2" />
        {t('actions.new')}
      </Button>
    </CardContent>
  </Card>
) : (
  // Tabelle: immer in <Card> wrappen
  <Card>
    <Table>
      <TableHeader>
        <TableRow className="border-b border-neutral-100 dark:border-neutral-800">
          <TableHead className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">
            Name
          </TableHead>
          <TableHead className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">
            Status
          </TableHead>
          <TableHead className="text-[11px] font-medium uppercase tracking-wider text-neutral-500 text-right">
            Actions
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow
            key={item.id}
            className="hover:bg-neutral-50 dark:hover:bg-neutral-900/50 transition-colors duration-[120ms] border-b border-neutral-100 dark:border-neutral-800/50 last:border-0"
          >
            <TableCell>
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-md bg-indigo-500/10 flex items-center justify-center shrink-0">
                  <Bot className="h-3.5 w-3.5 text-indigo-500" />
                </div>
                <span className="text-[13px] font-medium">{item.name}</span>
              </div>
            </TableCell>
            <TableCell>
              <Badge className="bg-lime-500/10 text-lime-700 border-lime-200 dark:bg-lime-400/10 dark:text-lime-400 dark:border-lime-800 text-[11px]">
                Active
              </Badge>
            </TableCell>
            <TableCell className="text-right">
              <div className="flex items-center justify-end gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20">
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

---

## Forms

### Imports
```tsx
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
```

### Standard Label + Input

```tsx
<div className="space-y-2">
  <Label htmlFor="name" className="text-sm font-medium">
    Assistant Name
  </Label>
  <Input
    id="name"
    placeholder="e.g. Customer Support Bot"
    value={name}
    onChange={(e) => setName(e.target.value)}
  />
  <p className="text-[12px] text-neutral-500 dark:text-neutral-400">
    This name will be displayed in the dashboard.
  </p>
</div>
```

### Select

```tsx
<div className="space-y-2">
  <Label htmlFor="provider" className="text-sm font-medium">
    LLM Provider
  </Label>
  <Select value={provider} onValueChange={setProvider}>
    <SelectTrigger id="provider">
      <SelectValue placeholder="Select provider..." />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="openai">OpenAI</SelectItem>
      <SelectItem value="google">Google Gemini</SelectItem>
      <SelectItem value="mistral">Mistral</SelectItem>
    </SelectContent>
  </Select>
</div>
```

### Textarea

```tsx
<div className="space-y-2">
  <Label htmlFor="prompt" className="text-sm font-medium">
    System Prompt
  </Label>
  <Textarea
    id="prompt"
    placeholder="You are a helpful assistant..."
    rows={6}
    value={prompt}
    onChange={(e) => setPrompt(e.target.value)}
    className="resize-none font-mono text-[13px]"
  />
  <p className="text-[12px] text-neutral-500">
    {prompt.length} characters
  </p>
</div>
```

### Switch

```tsx
<div className="flex items-center justify-between py-3">
  <div className="space-y-0.5">
    <Label htmlFor="active" className="text-sm font-medium cursor-pointer">
      Active
    </Label>
    <p className="text-[12px] text-neutral-500 dark:text-neutral-400">
      Enable this assistant for incoming calls.
    </p>
  </div>
  <Switch
    id="active"
    checked={isActive}
    onCheckedChange={setIsActive}
  />
</div>
```

### Validation States

```tsx
{/* Error State */}
<div className="space-y-2">
  <Label htmlFor="name" className="text-sm font-medium text-red-600 dark:text-red-400">
    Name
  </Label>
  <Input
    id="name"
    className="border-red-300 focus-visible:ring-red-500 dark:border-red-800"
    value={name}
  />
  <p className="text-[12px] text-red-600 dark:text-red-400 flex items-center gap-1">
    <XCircle className="h-3 w-3" />
    Name must be at least 3 characters.
  </p>
</div>

{/* Success State */}
<div className="space-y-2">
  <Label htmlFor="name" className="text-sm font-medium">Name</Label>
  <Input id="name" className="border-lime-400 dark:border-lime-700" value={name} />
  <p className="text-[12px] text-lime-700 dark:text-lime-400 flex items-center gap-1">
    <CheckCircle2 className="h-3 w-3" />
    Looks good!
  </p>
</div>
```

### Inline-Alert (Feedback-Nachrichten)

```tsx
{/* Success */}
<div className="p-3 rounded-lg text-[13px] bg-lime-50 dark:bg-lime-950/20 border border-lime-200 dark:border-lime-800 text-lime-700 dark:text-lime-400 flex items-center gap-2">
  <CheckCircle2 className="h-4 w-4 shrink-0" />
  Changes saved successfully.
</div>

{/* Error */}
<div className="p-3 rounded-lg text-[13px] bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 flex items-center gap-2">
  <XCircle className="h-4 w-4 shrink-0" />
  Failed to save. Please try again.
</div>

{/* Warning */}
<div className="p-3 rounded-lg text-[13px] bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 flex items-center gap-2">
  <AlertTriangle className="h-4 w-4 shrink-0" />
  This action cannot be undone.
</div>
```

---

## Dialogs

### Standard Dialog (≤ 4 Felder)

```tsx
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

<Dialog open={open} onOpenChange={setOpen}>
  <DialogTrigger asChild>
    <Button>
      <Plus className="h-4 w-4 mr-2" />
      New Assistant
    </Button>
  </DialogTrigger>
  <DialogContent className="sm:max-w-lg">
    <DialogHeader>
      <DialogTitle>New Assistant</DialogTitle>
      <DialogDescription>
        Configure your AI voice assistant.
      </DialogDescription>
    </DialogHeader>

    <div className="space-y-4 py-2">
      {/* Formular-Felder */}
    </div>

    <DialogFooter>
      <Button variant="outline" onClick={() => setOpen(false)}>
        Cancel
      </Button>
      <Button onClick={handleSave} disabled={isLoading}>
        {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        Save
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Confirm Dialog (Löschen)

```tsx
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"

<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button variant="outline" size="sm">
      <Trash2 className="h-4 w-4 mr-2 text-red-500" />
      Delete
    </Button>
  </AlertDialogTrigger>
  <AlertDialogContent className="sm:max-w-sm">
    <AlertDialogHeader>
      <AlertDialogTitle>Delete Assistant?</AlertDialogTitle>
      <AlertDialogDescription>
        This action cannot be undone. The assistant and all its data will be permanently deleted.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction
        onClick={handleDelete}
        className="bg-red-600 hover:bg-red-700 text-white"
      >
        Delete
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

### Dialog-Größen-Matrix

| Inhalt | Klasse | px |
|--------|--------|----|
| Bestätigung (2-3 Felder) | `sm:max-w-sm` | 384 |
| Standard (4-5 Felder) | `sm:max-w-lg` | 512 |
| Mittel (6+ Felder, konditionell) | `sm:max-w-2xl` | 672 |
| Groß (Daten-Vergleich) | `sm:max-w-4xl` | 896 |
| Sehr groß (Call-Details) | `sm:max-w-6xl` | 1152 |

---

## Empty States

### Standardmuster (in Card)

```tsx
<Card>
  <CardContent className="text-center py-16">
    {/* Icon in quadratischem Container */}
    <div className="w-14 h-14 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mx-auto mb-4">
      <Bot className="h-7 w-7 text-neutral-400" />
    </div>

    {/* Titel */}
    <h3 className="text-[15px] font-semibold text-neutral-900 dark:text-neutral-100 mb-1.5">
      No assistants yet
    </h3>

    {/* Beschreibung */}
    <p className="text-[13px] text-neutral-500 dark:text-neutral-400 mb-5 max-w-xs mx-auto leading-relaxed">
      Create your first AI assistant to start handling calls automatically.
    </p>

    {/* Primäre Aktion */}
    <Button>
      <Plus className="h-4 w-4 mr-2" />
      New Assistant
    </Button>
  </CardContent>
</Card>
```

---

## Loading States

### Skeleton Cards

```tsx
import { Skeleton } from "@/components/ui/skeleton"

{/* Skeleton für Item-Card */}
<Card>
  <CardHeader className="pb-3">
    <div className="flex items-start gap-3">
      <Skeleton className="w-9 h-9 rounded-lg" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-60" />
      </div>
    </div>
  </CardHeader>
  <CardContent className="pt-0">
    <div className="flex gap-2">
      <Skeleton className="h-8 w-20" />
      <Skeleton className="h-8 w-20" />
    </div>
  </CardContent>
</Card>
```

### Loading Page

```tsx
<div className="flex items-center justify-center min-h-[400px]">
  <Loader2 className="h-8 w-8 animate-spin text-neutral-400" />
</div>
```

---

## Navigation

### Sidebar-Item (Active State)

```tsx
{/* Active */}
<Link
  href={`/${orgSlug}/dashboard`}
  className="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium
             bg-neutral-100 dark:bg-neutral-800
             text-neutral-900 dark:text-neutral-100
             transition-colors duration-[120ms]"
>
  <LayoutDashboard className="h-4 w-4" />
  Dashboard
</Link>

{/* Inactive */}
<Link
  href={`/${orgSlug}/assistants`}
  className="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium
             text-neutral-600 dark:text-neutral-400
             hover:bg-neutral-100 dark:hover:bg-neutral-800/50
             hover:text-neutral-900 dark:hover:text-neutral-100
             transition-colors duration-[120ms]"
>
  <Bot className="h-4 w-4" />
  Assistants
</Link>
```

### Tabs

```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

<Tabs defaultValue="general" className="space-y-6">
  <TabsList>
    <TabsTrigger value="general">General</TabsTrigger>
    <TabsTrigger value="voice">Voice</TabsTrigger>
    <TabsTrigger value="advanced">Advanced</TabsTrigger>
  </TabsList>

  <TabsContent value="general" className="space-y-4">
    {/* Inhalt */}
  </TabsContent>
</Tabs>
```

---

## Section-Header

```tsx
{/* Standard (mit Button) */}
<div className="flex items-start justify-between">
  <div>
    <h2 className="text-2xl font-semibold tracking-tight">Assistants</h2>
    <p className="text-[13px] text-neutral-500 dark:text-neutral-400 mt-1">
      Manage your AI voice assistants.
    </p>
  </div>
  <Button>
    <Plus className="h-4 w-4 mr-2" />
    New Assistant
  </Button>
</div>

{/* Ohne Button */}
<div>
  <h2 className="text-2xl font-semibold tracking-tight">Analytics</h2>
  <p className="text-[13px] text-neutral-500 dark:text-neutral-400 mt-1">
    Last 30 days performance overview.
  </p>
</div>
```
