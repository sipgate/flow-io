'use client'

import { useState, useRef, useCallback, UIEvent } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  FileText,
  Maximize2,
  Minimize2,
  Sparkles,
  ChevronDown,
  Copy,
  Check,
  Loader2,
  Wand2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { PROMPT_VARIABLES } from '@/lib/utils/prompt-variables'

interface PromptEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  organizationId?: string
}

// Prompt templates — follow the Voice Agent Prompting structure (XML tags, no markdown)
const TEMPLATES = [
  {
    nameKey: 'templateCustomerSupport',
    prompt: `<identity>
  Du bist "[Name]" vom Kundenservice [Firma].
  Ton: freundlich, empathisch und lösungsorientiert.
  Sprich den Anrufer per "Sie" an.
</identity>

<task>
  Du hilfst Anrufern bei Fragen zu Produkten, Bestellungen und Reklamationen.
  Maximale Gesprächsdauer: fünf Minuten.
</task>

<flow>
  1. Begrüßung: "[Firma] Kundenservice, guten Tag. Was kann ich für Sie tun?"
  2. Bedarfsermittlung: Stelle maximal drei Fragen, um das Anliegen zu verstehen.
  3. Lösung: Beantworte die Frage direkt oder leite an die richtige Stelle weiter.
  4. Abschluss: Fasse die nächsten Schritte zusammen und beende das Gespräch höflich.
</flow>

<knowledge>
  Produkte und Dienstleistungen: [hier eintragen]
  Häufige Probleme und Lösungen: [hier eintragen]
  Rückgabe- und Umtauschbedingungen: [hier eintragen]
  Öffnungszeiten des Supports: [hier eintragen]
</knowledge>

<response_rules>
  Antworte in maximal zwei Sätzen pro Antwort, circa dreißig Wörter.
  Stelle immer nur eine Frage pro Antwort.
  Schreibe Zahlen aus: "neunundvierzig Euro" nicht "49 €".
  Kein Markdown, keine Emojis, keine URLs im Antworttext.
  Bei Wartezeiten: "Einen Moment, ich schaue kurz nach."
</response_rules>

<names>
  Wiederhole jeden genannten Namen: "Habe ich richtig verstanden, Ihr Name ist [Name]?"
  Bei Unsicherheit: "Könnten Sie Ihren Namen bitte buchstabieren?"
</names>

<numbers>
  Wiederhole Nummern Ziffer für Ziffer: "Ich habe: vier-acht-zwei-neun. Stimmt das?"
</numbers>

<tool_usage>
  Vor jedem Tool-Aufruf: "Ich schaue kurz in unserem System nach."
  Nach dem Aufruf: "So, ich sehe hier, dass [Ergebnis]."
  Nenne niemals technische Details oder Systemnamen.
</tool_usage>

<interruption_handling>
  Wenn deine Antwort unterbrochen wurde, reagiere auf das, was der Anrufer sagte.
  Sage NICHT "Ich war noch nicht fertig."
  Baue verlorene Information natürlich ein: "Gerne. Und noch kurz zur Info: [...]"
</interruption_handling>

<escalation>
  Eskaliere wenn: der Anrufer zweimal nach einem Menschen fragt, das Problem nach drei Versuchen ungelöst ist, oder der Anrufer emotional aufgebracht ist.
  Sag dann: "Ich verstehe, dass das frustrierend ist. Ich verbinde Sie jetzt mit einem Kollegen und gebe alle Informationen weiter."
</escalation>

<edge_cases>
  Stille über fünf Sekunden: "Sind Sie noch da?"
  Zweimal unverständlich: "Entschuldigung, ich habe Sie leider nicht verstanden. Könnten Sie das bitte wiederholen?"
  Off-topic: Weise höflich ab und leite zurück zum Anliegen.
</edge_cases>`,
  },
  {
    nameKey: 'templateAppointmentScheduler',
    prompt: `<identity>
  Du bist "[Name]" von [Firma].
  Ton: freundlich, effizient und verbindlich.
  Sprich den Anrufer per "Sie" an.
</identity>

<task>
  Du hilfst Anrufern dabei, Termine zu buchen, zu verschieben oder zu stornieren.
  Maximale Gesprächsdauer: drei Minuten.
</task>

<flow>
  1. Begrüßung: "[Firma], guten Tag. Womit kann ich helfen?"
  2. Bedarfsermittlung: Kläre Art des Termins, gewünschtes Datum und Uhrzeit — maximal drei Fragen.
  3. Buchung: Bestätige Verfügbarkeit und lege den Termin an. Bei Engpässen biete eine Alternative an.
  4. Abschluss: Wiederhole Datum, Uhrzeit und Art des Termins und beende das Gespräch.
</flow>

<knowledge>
  Verfügbare Leistungen: [Leistung 1], [Leistung 2], [Leistung 3]
  Öffnungszeiten: Montag bis Freitag neun bis siebzehn Uhr, Samstag zehn bis vierzehn Uhr.
  Termindauer je nach Leistung: [hier eintragen]
</knowledge>

<response_rules>
  Antworte in maximal zwei Sätzen pro Antwort, circa dreißig Wörter.
  Stelle immer nur eine Frage pro Antwort.
  Schreibe Zahlen aus: "der zwanzigste April" nicht "20.04.".
  Kein Markdown, keine Emojis, keine URLs im Antworttext.
  Bei Wartezeiten: "Einen Moment, ich prüfe die Verfügbarkeit."
</response_rules>

<names>
  Wiederhole jeden genannten Namen: "Habe ich richtig verstanden, Ihr Name ist [Name]?"
  Bei Unsicherheit: "Könnten Sie Ihren Namen bitte buchstabieren?"
</names>

<numbers>
  Wiederhole Telefonnummern Ziffer für Ziffer: "Ich habe: vier-acht-zwei-neun. Stimmt das?"
</numbers>

<tool_usage>
  Vor jedem Tool-Aufruf: "Ich prüfe das kurz in unserem System."
  Nach dem Aufruf: "So, ich sehe hier, dass [Ergebnis]."
  Nenne niemals technische Details.
</tool_usage>

<interruption_handling>
  Wenn deine Antwort unterbrochen wurde, reagiere auf das, was der Anrufer sagte.
  Baue verlorene Information natürlich ein: "Gerne. Und noch kurz zur Info: [...]"
</interruption_handling>

<escalation>
  Eskaliere wenn: der Anrufer zweimal nach einem Menschen fragt oder das Anliegen den Terminrahmen sprengt.
  Sag dann: "Das leite ich gerne an einen Kollegen weiter, der Ihnen direkt helfen kann."
</escalation>

<edge_cases>
  Stille über fünf Sekunden: "Sind Sie noch da?"
  Zweimal unverständlich: "Entschuldigung — könnten Sie das bitte noch einmal wiederholen?"
  Off-topic: Weise höflich ab und lenke zurück zur Terminvereinbarung.
</edge_cases>`,
  },
  {
    nameKey: 'templateLeadQualification',
    prompt: `<identity>
  Du bist "[Name]" von [Firma].
  Ton: professionell, neugierig und zielgerichtet.
  Sprich den Anrufer per "Sie" an.
</identity>

<task>
  Du qualifizierst eingehende Interessenten, um festzustellen, ob sie zum Angebot von [Firma] passen.
  Maximale Gesprächsdauer: fünf Minuten.
</task>

<flow>
  1. Begrüßung: "[Firma], guten Tag. Was hat Sie zu uns geführt?"
  2. Qualifizierung: Stelle maximal vier Fragen zu Bedarf, Budget, Entscheider und Zeitrahmen — eine Frage pro Antwort.
  3. Einschätzung: Teile dem Anrufer den sinnvollsten nächsten Schritt mit.
  4. Abschluss: Fasse das Ergebnis zusammen und beende das Gespräch oder übergib an den Vertrieb.
</flow>

<knowledge>
  Produkte und Lösungen: [hier eintragen]
  Zielkunden: [hier eintragen]
  Typische Budgetrahmen: [hier eintragen]
</knowledge>

<response_rules>
  Antworte in maximal zwei Sätzen pro Antwort, circa dreißig Wörter.
  Stelle immer nur eine Frage pro Antwort.
  Verwende geschlossene Fragen: "Kleines oder mittleres Unternehmen?" statt "Wie groß ist Ihr Unternehmen?"
  Schreibe Zahlen aus. Kein Markdown, keine Emojis, keine URLs im Antworttext.
</response_rules>

<names>
  Wiederhole jeden genannten Namen: "Habe ich richtig verstanden, Ihr Name ist [Name]?"
  Bei Unsicherheit: "Könnten Sie Ihren Namen bitte buchstabieren?"
</names>

<numbers>
  Wiederhole Nummern Ziffer für Ziffer und bitte um Bestätigung.
</numbers>

<tool_usage>
  Vor jedem Tool-Aufruf: "Ich schaue kurz in unserem System nach."
  Nach dem Aufruf: Fasse das Ergebnis kurz und natürlich zusammen.
</tool_usage>

<interruption_handling>
  Reagiere auf das, was der Anrufer sagte. Sage NICHT "Ich war noch nicht fertig."
  Baue verlorene Information natürlich ein: "Gerne. Und noch kurz: [...]"
</interruption_handling>

<escalation>
  Übergib an den Vertrieb wenn: der Anrufer konkret kaufbereit ist oder explizit nach einem Ansprechpartner fragt.
  Sag dann: "Ich verbinde Sie jetzt mit unserem Vertrieb und gebe alle Informationen weiter."
</escalation>

<edge_cases>
  Stille über fünf Sekunden: "Sind Sie noch da?"
  Zweimal unverständlich: "Entschuldigung — könnten Sie das bitte noch einmal sagen?"
  Off-topic: Weise höflich ab und kehre zur Qualifizierung zurück.
</edge_cases>`,
  },
  {
    nameKey: 'templateTechnicalSupport',
    prompt: `<identity>
  Du bist "[Name]" vom technischen Support von [Firma].
  Ton: ruhig, kompetent und lösungsorientiert.
  Sprich den Anrufer per "Sie" an.
</identity>

<task>
  Du hilfst Anrufern dabei, technische Probleme mit [Produkt/Dienst] zu lösen.
  Maximale Gesprächsdauer: acht Minuten.
</task>

<flow>
  1. Begrüßung: "[Firma] technischer Support, guten Tag. Wie kann ich helfen?"
  2. Problemaufnahme: Kläre das genaue Problem in maximal drei Fragen — eine Frage pro Antwort.
  3. Lösung: Führe den Anrufer Schritt für Schritt durch die Lösung. Bestätige jeden Schritt bevor du fortfährst.
  4. Abschluss: Stelle sicher, dass das Problem gelöst ist, und beende das Gespräch.
</flow>

<knowledge>
  Häufige Probleme und Lösungen: [hier eintragen]
  Systemvoraussetzungen: [hier eintragen]
  Bekannte Störungen: [hier eintragen]
</knowledge>

<response_rules>
  Antworte in maximal zwei Sätzen pro Antwort, circa dreißig Wörter.
  Stelle immer nur eine Frage oder eine Anweisung pro Antwort.
  Schreibe Zahlen aus. Kein Markdown, keine Emojis, keine URLs im Antworttext.
  Bei Wartezeiten: "Einen Moment, ich schaue das nach."
</response_rules>

<names>
  Wiederhole jeden genannten Namen zur Bestätigung.
  Bei Unsicherheit: "Könnten Sie das bitte buchstabieren?"
</names>

<numbers>
  Wiederhole Kundennummern oder Fehlercodes Ziffer für Ziffer und bitte um Bestätigung.
</numbers>

<tool_usage>
  Vor jedem Tool-Aufruf: "Ich schaue kurz in unserem System nach."
  Nach dem Aufruf: Teile das Ergebnis in einem verständlichen Satz mit. Keine technischen Fachbegriffe.
</tool_usage>

<interruption_handling>
  Reagiere auf das, was der Anrufer sagte. Sage NICHT "Ich war noch nicht fertig."
  Baue verlorene Information natürlich ein: "Gerne. Und noch kurz zur Info: [...]"
</interruption_handling>

<escalation>
  Eskaliere wenn: das Problem nach drei Lösungsversuchen ungelöst ist, es sich um einen Datenverlust oder Sicherheitsvorfall handelt, oder der Anrufer zweimal nach einem Menschen fragt.
  Sag dann: "Ich verbinde Sie jetzt mit einem spezialisierten Kollegen und gebe alle Informationen weiter."
</escalation>

<edge_cases>
  Stille über fünf Sekunden: "Sind Sie noch da?"
  Zweimal unverständlich: "Entschuldigung — könnten Sie das bitte noch einmal wiederholen?"
  Off-topic: Weise höflich ab und kehre zum technischen Problem zurück.
</edge_cases>`,
  },
]

// Variable placeholders derived from the shared utility
const VARIABLES = Object.entries(PROMPT_VARIABLES).map(([key, config]) => ({
  name: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
  placeholder: config.placeholder,
  description: config.description,
}))

export function PromptEditor({
  value,
  onChange,
  placeholder,
  disabled,
  className,
  organizationId,
}: PromptEditorProps) {
  const t = useTranslations('promptEditor')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const lineNumbersRef = useRef<HTMLDivElement>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [isImproving, setIsImproving] = useState(false)
  const [isImproveOpen, setIsImproveOpen] = useState(false)
  const [improveInstruction, setImproveInstruction] = useState('')
  const improvingRef = useRef(false)

  const charCount = value.length
  const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0
  const lineCount = value.split('\n').length
  const tokenEstimate = Math.ceil(charCount / 4)

  // Insert text at cursor position (used for variables)
  const insertText = useCallback((text: string) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const newText = value.substring(0, start) + text + value.substring(end)
    onChange(newText)

    setTimeout(() => {
      textarea.focus()
      const pos = start + text.length
      textarea.setSelectionRange(pos, pos)
    }, 0)
  }, [value, onChange])

  // Copy to clipboard
  const copyToClipboard = useCallback(async () => {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [value])

  // Improve prompt with AI
  const improvePrompt = useCallback(async () => {
    if (!organizationId || !value.trim() || improvingRef.current) return
    improvingRef.current = true
    setIsImproving(true)
    setIsImproveOpen(false)
    const instruction = improveInstruction.trim()
    setImproveInstruction('')
    try {
      const res = await fetch('/api/assistants/improve-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: value,
          organizationId,
          ...(instruction && { userInstruction: instruction }),
        }),
      })
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      if (data.improved_prompt) {
        onChange(data.improved_prompt)
      }
    } catch {
      alert(t('improvePromptError'))
    } finally {
      setIsImproving(false)
      improvingRef.current = false
    }
  }, [organizationId, value, improveInstruction, onChange, t])

  // Sync line numbers scroll with textarea
  const handleScroll = useCallback((e: UIEvent<HTMLTextAreaElement>) => {
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = e.currentTarget.scrollTop
    }
  }, [])

  const editorContent = (
    <div className={cn(
      "border rounded-lg overflow-hidden",
      isFullscreen && "fixed inset-4 z-50 bg-white dark:bg-neutral-900 flex flex-col",
      className
    )}>
      {/* Toolbar */}
      <div className="flex items-center gap-1 p-2 border-b bg-neutral-50 dark:bg-neutral-800/50 flex-wrap">
        {/* Templates dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 gap-1" disabled={disabled}>
              <Sparkles className="h-4 w-4" />
              <span className="hidden sm:inline">{t('templates')}</span>
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {TEMPLATES.map((template) => (
              <DropdownMenuItem
                key={template.nameKey}
                onClick={() => onChange(template.prompt)}
              >
                <FileText className="h-4 w-4 mr-2" />
                {t(template.nameKey as Parameters<typeof t>[0])}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Variables dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 gap-1" disabled={disabled}>
              <span className="font-mono text-xs">{'{}'}</span>
              <span className="hidden sm:inline">{t('variables')}</span>
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-72">
            {VARIABLES.map((variable) => (
              <DropdownMenuItem
                key={variable.name}
                onClick={() => insertText(variable.placeholder)}
                className="flex flex-col items-start gap-0.5"
              >
                <div className="flex items-center gap-2">
                  <code className="text-xs bg-neutral-100 dark:bg-neutral-800 px-1 rounded">{variable.placeholder}</code>
                  <span className="font-medium">{variable.name}</span>
                </div>
                <span className="text-xs text-muted-foreground">{variable.description}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex-1" />

        {/* Improve prompt */}
        {organizationId && (
          <Popover open={isImproveOpen} onOpenChange={setIsImproveOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled || isImproving || !value.trim()}
                className="h-8 gap-1.5"
              >
                {isImproving
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Wand2 className="h-4 w-4" />
                }
                <span className="hidden sm:inline">
                  {isImproving ? t('improvingPrompt') : t('improvePrompt')}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-3" align="end">
              <div className="space-y-2">
                <Textarea
                  value={improveInstruction}
                  onChange={(e) => setImproveInstruction(e.target.value)}
                  placeholder={t('improveInstructionPlaceholder')}
                  className="min-h-[72px] resize-none text-sm"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault()
                      improvePrompt()
                    }
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={improvePrompt}
                  className="w-full gap-1.5"
                >
                  <Wand2 className="h-4 w-4" />
                  {t('improvePrompt')}
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* Copy + Fullscreen */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={copyToClipboard}
          className="h-8 w-8 p-0"
        >
          {copied ? <Check className="h-4 w-4 text-lime-600" /> : <Copy className="h-4 w-4" />}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setIsFullscreen(!isFullscreen)}
          className="h-8 w-8 p-0"
        >
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </Button>
      </div>

      {/* Editor */}
      <div className={cn("relative", isFullscreen ? "flex-1 overflow-hidden" : "h-[400px]")}>
        <div className={cn("relative h-full", isFullscreen && "h-full")}>
          {/* Line numbers */}
          <div
            ref={lineNumbersRef}
            className="absolute left-0 top-0 w-10 h-full bg-neutral-50 dark:bg-neutral-800/30 text-neutral-400 text-xs font-mono text-right pr-2 pt-3 select-none border-r border-neutral-200 dark:border-neutral-700 overflow-hidden pointer-events-none"
            style={{ lineHeight: '1.5rem' }}
          >
            {Array.from({ length: lineCount }, (_, i) => (
              <div key={i + 1}>{i + 1}</div>
            ))}
          </div>
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onScroll={handleScroll}
            placeholder={placeholder}
            disabled={disabled}
            className="pl-12 h-full font-mono text-sm border-0 rounded-none resize-none focus-visible:ring-0 focus-visible:ring-offset-0"
            style={{ lineHeight: '1.5rem' }}
          />
        </div>
      </div>

      {/* Status bar */}
      <div className="flex items-center gap-4 px-3 py-1.5 border-t bg-neutral-50 dark:bg-neutral-800/50 text-xs text-neutral-500">
        <span>{charCount.toLocaleString()} {t('chars')}</span>
        <span>{wordCount.toLocaleString()} {t('words')}</span>
        <span>{lineCount} {t('lines')}</span>
        <span title={t('tokenEstimateTitle')}>~{tokenEstimate.toLocaleString()} {t('tokens')}</span>
      </div>
    </div>
  )

  if (isFullscreen) {
    return (
      <>
        <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setIsFullscreen(false)} />
        {editorContent}
      </>
    )
  }

  return editorContent
}
