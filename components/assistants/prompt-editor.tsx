'use client'

import { useState, useRef, useCallback, useEffect, UIEvent } from 'react'
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Quote,
  Minus,
  FileText,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  Sparkles,
  ChevronDown,
  Copy,
  Check,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { PROMPT_VARIABLES } from '@/lib/utils/prompt-variables'

interface PromptEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

// Prompt templates
const TEMPLATES = [
  {
    nameKey: 'templateCustomerSupport',
    prompt: `You are a friendly and professional customer support assistant for [Company Name].

## Your Role
- Help customers with their questions and issues
- Be patient, empathetic, and solution-oriented
- Escalate to human agents when needed

## Guidelines
- Always greet customers warmly
- Ask clarifying questions before making assumptions
- Apologize for any inconvenience caused
- Provide clear, step-by-step instructions
- If you don't know something, say so honestly

## Knowledge
- Products/Services: [List your products]
- Common Issues: [List common problems and solutions]
- Policies: [Refund policy, shipping, etc.]

## Boundaries
- Never share confidential information
- Don't make promises you can't keep
- Redirect complex issues to human support`,
  },
  {
    nameKey: 'templateAppointmentScheduler',
    prompt: `You are an appointment scheduling assistant for [Business Name].

## Your Role
- Help callers schedule, reschedule, or cancel appointments
- Provide information about available services
- Answer basic questions about the business

## Information to Collect
1. Caller's full name
2. Phone number (for confirmation)
3. Preferred date and time
4. Type of service/appointment needed
5. Any special requirements

## Available Services
- [Service 1] - Duration: X minutes
- [Service 2] - Duration: X minutes
- [Service 3] - Duration: X minutes

## Business Hours
Monday-Friday: 9:00 AM - 5:00 PM
Saturday: 10:00 AM - 2:00 PM
Sunday: Closed

## Guidelines
- Confirm all details before ending the call
- Offer alternative times if requested slot is unavailable
- Send confirmation details via SMS when possible`,
  },
  {
    nameKey: 'templateLeadQualification',
    prompt: `You are a lead qualification specialist for [Company Name].

## Your Objective
Qualify incoming leads by gathering key information and determining their fit for our products/services.

## Qualification Criteria (BANT)
- **Budget**: What's their budget range?
- **Authority**: Are they the decision maker?
- **Need**: What problem are they trying to solve?
- **Timeline**: When do they need a solution?

## Questions to Ask
1. "What brings you to [Company] today?"
2. "What challenges are you currently facing with [area]?"
3. "Have you set aside a budget for this solution?"
4. "Who else would be involved in this decision?"
5. "What's your timeline for implementing a solution?"

## Scoring
- Hot Lead: High budget, decision maker, urgent timeline
- Warm Lead: Moderate interest, needs nurturing
- Cold Lead: Low priority, add to nurture campaign

## Next Steps
- Hot leads: Schedule demo immediately
- Warm leads: Send information packet, follow up in 3 days
- Cold leads: Add to email list, nurture over time`,
  },
  {
    nameKey: 'templateTechnicalSupport',
    prompt: `You are a technical support specialist for [Product/Service].

## Your Role
- Help users troubleshoot technical issues
- Guide them through step-by-step solutions
- Escalate complex issues to engineering team

## Troubleshooting Framework
1. **Identify** - Understand the exact issue
2. **Reproduce** - Can you replicate the problem?
3. **Isolate** - Narrow down the cause
4. **Resolve** - Apply the appropriate fix
5. **Verify** - Confirm the issue is resolved

## Common Issues & Solutions
### Issue 1: [Problem]
Solution: [Steps to fix]

### Issue 2: [Problem]
Solution: [Steps to fix]

## Information to Gather
- User's account/ID
- Device/browser/OS version
- Error messages (exact wording)
- Steps that led to the issue
- When did it start happening?

## Escalation Criteria
- Security-related issues
- Data loss situations
- Issues affecting multiple users
- Problems you cannot resolve in 15 minutes`,
  },
]

// Variable placeholders derived from the shared utility
const VARIABLES = Object.entries(PROMPT_VARIABLES).map(([key, config]) => ({
  name: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
  placeholder: config.placeholder,
  description: config.description,
}))

function ToolbarButton({
  icon: Icon,
  label,
  onClick,
  shortcut,
  disabled,
}: {
  icon: React.ElementType
  label: string
  onClick: () => void
  shortcut?: string
  disabled?: boolean
}) {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClick}
            disabled={disabled}
            className="h-8 w-8 p-0"
          >
            <Icon className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{label}{shortcut && <span className="ml-2 text-neutral-400">{shortcut}</span>}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export function PromptEditor({
  value,
  onChange,
  placeholder,
  disabled,
  className,
}: PromptEditorProps) {
  const t = useTranslations('promptEditor')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const lineNumbersRef = useRef<HTMLDivElement>(null)
  const [isPreview, setIsPreview] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [copied, setCopied] = useState(false)

  // Word, character, and token count
  const charCount = value.length
  const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0
  const lineCount = value.split('\n').length
  // Token estimation: ~4 chars per token for English, accounting for whitespace and punctuation
  const tokenEstimate = Math.ceil(charCount / 4)

  // Insert text at cursor position
  const insertText = useCallback((before: string, after: string = '') => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = value.substring(start, end)

    const newText =
      value.substring(0, start) +
      before +
      selectedText +
      after +
      value.substring(end)

    onChange(newText)

    // Restore cursor position
    setTimeout(() => {
      textarea.focus()
      const newCursorPos = start + before.length + selectedText.length
      textarea.setSelectionRange(newCursorPos, newCursorPos)
    }, 0)
  }, [value, onChange])

  // Wrap selection with markdown syntax
  const wrapSelection = useCallback((wrapper: string) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = value.substring(start, end)

    const newText =
      value.substring(0, start) +
      wrapper +
      selectedText +
      wrapper +
      value.substring(end)

    onChange(newText)

    setTimeout(() => {
      textarea.focus()
      if (selectedText) {
        textarea.setSelectionRange(start + wrapper.length, end + wrapper.length)
      } else {
        textarea.setSelectionRange(start + wrapper.length, start + wrapper.length)
      }
    }, 0)
  }, [value, onChange])

  // Insert at line start
  const insertAtLineStart = useCallback((prefix: string) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const lineStart = value.lastIndexOf('\n', start - 1) + 1

    const newText =
      value.substring(0, lineStart) +
      prefix +
      value.substring(lineStart)

    onChange(newText)

    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start + prefix.length, start + prefix.length)
    }, 0)
  }, [value, onChange])

  // Apply template
  const applyTemplate = useCallback((template: string) => {
    onChange(template)
  }, [onChange])

  // Copy to clipboard
  const copyToClipboard = useCallback(async () => {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [value])

  // Sync line numbers scroll with textarea
  const handleScroll = useCallback((e: UIEvent<HTMLTextAreaElement>) => {
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = e.currentTarget.scrollTop
    }
  }, [])

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!textareaRef.current || document.activeElement !== textareaRef.current) return

      if (e.metaKey || e.ctrlKey) {
        switch (e.key) {
          case 'b':
            e.preventDefault()
            wrapSelection('**')
            break
          case 'i':
            e.preventDefault()
            wrapSelection('*')
            break
          case '`':
            e.preventDefault()
            wrapSelection('`')
            break
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [wrapSelection])

  // Simple markdown to HTML renderer
  const renderMarkdown = (text: string) => {
    const html = text
      // Escape HTML
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      // Headers
      .replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>')
      .replace(/^## (.+)$/gm, '<h2 class="text-xl font-semibold mt-4 mb-2">$1</h2>')
      .replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold mt-4 mb-2">$1</h1>')
      // Bold and italic
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      // Code
      .replace(/`(.+?)`/g, '<code class="bg-neutral-100 dark:bg-neutral-800 px-1 rounded">$1</code>')
      // Lists
      .replace(/^- (.+)$/gm, '<li class="ml-4">• $1</li>')
      .replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal">$1</li>')
      // Blockquotes
      .replace(/^> (.+)$/gm, '<blockquote class="border-l-4 border-neutral-300 pl-4 italic text-neutral-600">$1</blockquote>')
      // Horizontal rule
      .replace(/^---$/gm, '<hr class="my-4 border-neutral-200 dark:border-neutral-700" />')
      // Line breaks
      .replace(/\n/g, '<br />')

    return html
  }

  const editorContent = (
    <div className={cn(
      "border rounded-lg overflow-hidden",
      isFullscreen && "fixed inset-4 z-50 bg-white dark:bg-neutral-900 flex flex-col",
      className
    )}>
      {/* Toolbar */}
      <div className="flex items-center gap-1 p-2 border-b bg-neutral-50 dark:bg-neutral-800/50 flex-wrap">
        {/* Text formatting */}
        <div className="flex items-center gap-0.5">
          <ToolbarButton icon={Bold} label={t('toolbarBold')} onClick={() => wrapSelection('**')} shortcut="⌘B" disabled={disabled || isPreview} />
          <ToolbarButton icon={Italic} label={t('toolbarItalic')} onClick={() => wrapSelection('*')} shortcut="⌘I" disabled={disabled || isPreview} />
          <ToolbarButton icon={Code} label={t('toolbarCode')} onClick={() => wrapSelection('`')} shortcut="⌘`" disabled={disabled || isPreview} />
        </div>

        <div className="w-px h-6 bg-neutral-200 dark:bg-neutral-700 mx-1" />

        {/* Headers */}
        <div className="flex items-center gap-0.5">
          <ToolbarButton icon={Heading1} label={t('toolbarH1')} onClick={() => insertAtLineStart('# ')} disabled={disabled || isPreview} />
          <ToolbarButton icon={Heading2} label={t('toolbarH2')} onClick={() => insertAtLineStart('## ')} disabled={disabled || isPreview} />
          <ToolbarButton icon={Heading3} label={t('toolbarH3')} onClick={() => insertAtLineStart('### ')} disabled={disabled || isPreview} />
        </div>

        <div className="w-px h-6 bg-neutral-200 dark:bg-neutral-700 mx-1" />

        {/* Lists and blocks */}
        <div className="flex items-center gap-0.5">
          <ToolbarButton icon={List} label={t('toolbarBulletList')} onClick={() => insertAtLineStart('- ')} disabled={disabled || isPreview} />
          <ToolbarButton icon={ListOrdered} label={t('toolbarNumberedList')} onClick={() => insertAtLineStart('1. ')} disabled={disabled || isPreview} />
          <ToolbarButton icon={Quote} label={t('toolbarQuote')} onClick={() => insertAtLineStart('> ')} disabled={disabled || isPreview} />
          <ToolbarButton icon={Minus} label={t('toolbarHorizontalRule')} onClick={() => insertText('\n---\n')} disabled={disabled || isPreview} />
        </div>

        <div className="w-px h-6 bg-neutral-200 dark:bg-neutral-700 mx-1" />

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
                onClick={() => applyTemplate(template.prompt)}
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
            <Button variant="ghost" size="sm" className="h-8 gap-1" disabled={disabled || isPreview}>
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

        {/* Right side controls */}
        <div className="flex items-center gap-0.5">
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
            onClick={() => setIsPreview(!isPreview)}
            className="h-8 gap-1"
          >
            {isPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            <span className="hidden sm:inline">{isPreview ? t('edit') : t('preview')}</span>
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
      </div>

      {/* Editor / Preview */}
      <div className={cn("relative", isFullscreen ? "flex-1 overflow-hidden" : "h-[400px]")}>
        {isPreview ? (
          <div
            className={cn(
              "p-4 prose prose-sm dark:prose-invert max-w-none overflow-auto h-full",
              isFullscreen && "h-full"
            )}
            dangerouslySetInnerHTML={{ __html: renderMarkdown(value) || `<p class="text-neutral-400">${t('nothingToPreview')}</p>` }}
          />
        ) : (
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
        )}
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t bg-neutral-50 dark:bg-neutral-800/50 text-xs text-neutral-500">
        <div className="flex items-center gap-4">
          <span>{charCount.toLocaleString()} {t('chars')}</span>
          <span>{wordCount.toLocaleString()} {t('words')}</span>
          <span>{lineCount} {t('lines')}</span>
          <span title={t('tokenEstimateTitle')}>~{tokenEstimate.toLocaleString()} {t('tokens')}</span>
        </div>
        <div className="flex items-center gap-2">
          <span>{t('markdownSupported')}</span>
          {isPreview && <span className="text-blue-500">{t('previewMode')}</span>}
        </div>
      </div>
    </div>
  )

  // Fullscreen backdrop
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
