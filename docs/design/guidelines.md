# Content-Guidelines — Flow-IO Design System

---

## Labeling & Copy-Regeln

### Button-Labels

| ✅ Korrekt | ❌ Falsch | Regel |
|-----------|---------|-------|
| New Assistant | Add Assistant | Immer "New [Entity]" |
| New Assistant | Create Assistant | Immer "New [Entity]" |
| Save | Submit | Formular-Abschluss |
| Save | Update | Beim Bearbeiten auch "Save" |
| Delete | Remove | Destruktive Aktion |
| Edit | Modify | Bearbeitungs-Aktion |
| Cancel | Close | Dialog abbrechen |
| Confirm | OK | Bestätigungs-Aktion |

### Entitäts-Namen (konsistent)

| Entität | Singular | Plural | Key in i18n |
|---------|---------|--------|------------|
| Assistent | Assistant | Assistants | `assistants` |
| Szenario | Scenario | Scenarios | `scenarios` |
| Wissensartikel | Document | Documents | `knowledge` |
| Telefonanruf | Call | Calls | `calls` |
| Telefonnummer | Phone Number | Phone Numbers | `connect` |
| Variable | Variable | Variables | `variables` |
| Testfall | Test Case | Test Cases | `autotest` |
| Testsuite | Test Suite | Test Suites | `autotest` |

---

## Status-Badges

**Immer kapitalisiert — nie lowercase.**

| Status | Wert | Verwendung |
|--------|------|-----------|
| `Active` | ✅ | Assistent/Nummer aktiv |
| `Inactive` | — | Assistent/Nummer inaktiv |
| `Pending` | ⏳ | Wird verarbeitet |
| `Processing` | ⏳ | Dokument wird indiziert |
| `Healthy` | ✅ | System-Status OK |
| `Degraded` | ⚠️ | Teilausfall |
| `Down` | ❌ | System nicht erreichbar |
| `Failed` | ❌ | Fehler aufgetreten |
| `Completed` | ✅ | Abgeschlossen |
| `Running` | ⏳ | Wird ausgeführt |
| `Error` | ❌ | Allgemeiner Fehler |
| `Beta` | — | Feature in Beta |
| `Entry Point` | — | Einstiegs-Knoten |

---

## Empty States

### Template-Struktur
```
Icon (h-7 w-7, gedämpfte Farbe)
Titel: "No [Entities] yet" oder "No [Entities] found"
Beschreibung: Was der Benutzer tun kann (1-2 Sätze)
CTA: "New [Entity]" (wenn Erstellen möglich)
```

### Entitäts-spezifische Empty States

**Assistants:**
- Icon: `Bot`
- Titel: `No assistants yet`
- Beschreibung: `Create your first AI assistant to start handling calls automatically.`
- CTA: `New Assistant`

**Scenarios:**
- Icon: `GitBranch`
- Titel: `No scenarios yet`
- Beschreibung: `Build call flows to route incoming calls to the right assistants.`
- CTA: `New Scenario`

**Knowledge Documents:**
- Icon: `Layers`
- Titel: `No documents yet`
- Beschreibung: `Upload documents to give your assistants access to your knowledge base.`
- CTA: `Upload Document`

**Phone Numbers:**
- Icon: `Phone`
- Titel: `No phone numbers connected`
- Beschreibung: `Connect a phone number to start receiving calls.`
- CTA: (kein direkter CTA — verweist auf sipgate)

**Calls:**
- Icon: `PhoneCall`
- Titel: `No calls yet`
- Beschreibung: `Calls will appear here once your assistants start receiving them.`
- CTA: — (keine Aktion möglich)

**Variables:**
- Icon: `Variable`
- Titel: `No variables defined`
- Beschreibung: `Add variables to collect structured data from callers.`
- CTA: `New Variable`

**Test Suites:**
- Icon: `FlaskConical`
- Titel: `No test suites yet`
- Beschreibung: `Create a test suite to automate quality testing for your assistants.`
- CTA: `New Test Suite`

**Suchergebnis-Empty-State (Filtern):**
- Icon: `Search`
- Titel: `No results found`
- Beschreibung: `Try adjusting your search or filters.`
- CTA: — (kein CTA, aber "Clear filters"-Link)

---

## Fehlermeldungen

### Regeln
- Nutzerfreundlich: Erkläre was passiert ist
- Handlungsorientiert: Sag was der Nutzer tun kann
- Keine technischen Details für Endnutzer
- Keine Entschuldigungen ("Sorry...")

| ✅ Gut | ❌ Schlecht |
|-------|-----------|
| "Failed to save. Please try again." | "Error 500: Internal Server Error" |
| "Name must be at least 3 characters." | "Validation failed" |
| "Connection failed. Check your API key." | "Unauthorized" |
| "This name is already taken." | "Duplicate entry error" |

### Standard-Fehlertexte

```
// Netzwerk-Fehler
"Something went wrong. Please try again."

// Validierungsfehler
"Please fill in all required fields."

// Nicht gefunden
"This [entity] could not be found."

// Keine Berechtigung
"You don't have permission to do this."

// Löschen nicht möglich (Abhängigkeiten)
"This [entity] cannot be deleted because it is still in use."
```

---

## Loading-States

### Button-Loading

```tsx
// Immer: disabled + Loader2 + Verb im Progressiv
<Button disabled>
  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
  Saving...
</Button>
```

| Aktion | Loading-Text |
|--------|-------------|
| Speichern | `Saving...` |
| Löschen | `Deleting...` |
| Hochladen | `Uploading...` |
| Verbinden | `Connecting...` |
| Laden | `Loading...` |
| Testen | `Testing...` |
| Generieren | `Generating...` |

---

## Internationalisierung (i18n)

### Pflichtregeln

1. **Kein hardcodierter Text** in Komponenten
2. **Immer `useTranslations('namespace')`** in Client Components
3. **Immer `getTranslations('namespace')`** in Server Components
4. **ICU-Pluralformen** für Zählungen
5. **Namespace-Konvention**: Entspricht dem Seiten-/Feature-Namen

### Namespace-Struktur

```json
{
  "assistants": {
    "title": "Assistants",
    "description": "...",
    "tabs": { "list": "...", "settings": "..." },
    "actions": { "new": "New Assistant", "edit": "Edit", "delete": "Delete" },
    "empty": { "title": "No assistants yet", "description": "..." },
    "fields": { "name": "Name", "description": "Description", ... },
    "status": { "active": "Active", "inactive": "Inactive" }
  }
}
```

### ICU-Pluralformen

```json
{
  "callCount": "{count, plural, =0 {No calls} =1 {1 call} other {# calls}}"
}
```

```tsx
t('callCount', { count: calls.length })
```

### Unterstützte Sprachen
- `de` — Deutsch (primär)
- `en` — Englisch
- `es` — Spanisch

---

## Beschriftungen in Formular-Labels

```
// Format: Substantiv, nicht Verb
Name           ✅    Enter a name     ❌
Description    ✅    Write a description ❌
Language       ✅    Select language  ❌

// Pflichtfelder: Kein Sternchen (*) im Label — Fehler beim Absenden zeigen
// Optionale Felder: "(optional)" nach dem Label
Description (optional)
```

---

## Tabellen-Überschriften

```
// Format: Kurz, beschreibend, ohne Verb
Name        ✅    Assistant Name    ❌ (zu lang)
Status      ✅    Current Status    ❌ (redundant)
Created     ✅    Created At        ❌ (Präposition weg)
Duration    ✅    Call Duration     ❌ (Kontext-Wort weg)
Actions     ✅    Available Actions ❌ (zu lang)
```

---

## Zeitanzeige

```tsx
// Relative Zeit (< 1 Tag alt)
"Just now", "2 minutes ago", "1 hour ago"

// Datum + Zeit (> 1 Tag alt)
"Mar 15, 14:32"

// Datum (> 7 Tage alt)
"Mar 15, 2024"

// Dauer (Anrufe)
formatDuration(seconds):
  < 60s  → "45s"
  < 1h   → "3m 20s"
  ≥ 1h   → "1h 5m"
```
