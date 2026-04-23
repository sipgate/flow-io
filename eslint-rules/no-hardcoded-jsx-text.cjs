/**
 * eslint-rules/no-hardcoded-jsx-text.js
 *
 * Regel: JSXText-Nodes (direkter Text zwischen Tags) mit mehr als `minLength`
 * Zeichen müssen als Übersetzungs-Aufruf {t('...')} vorliegen.
 *
 * Ausnahmen:
 *   - Reiner Whitespace / Zeilenumbrüche
 *   - Nur Sonderzeichen (—, /, :, ., ...)
 *   - Strings auf der allowedStrings-Liste
 *   - design/page.tsx (Showcase)
 */

/** @type {import('eslint').Rule.RuleModule} */
const noHardcodedJsxText = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'JSX-Text muss über t()-Übersetzungsaufrufe referenziert werden (i18n)',
      category: 'Design System',
    },
    schema: [
      {
        type: 'object',
        properties: {
          minLength: { type: 'number', default: 4 },
          allowedStrings: {
            type: 'array',
            items: { type: 'string' },
            default: [],
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      hardcodedText:
        'Hardcodierter JSX-Text "{{text}}" gefunden. Verwende {t("schluessel")} stattdessen.',
    },
  },

  create(context) {
    const options = context.options[0] || {}
    const minLength = options.minLength ?? 4
    const allowedStrings = options.allowedStrings ?? [
      '—',
      '/',
      ':',
      '.',
      '...',
      '·',
      '|',
      '%',
      '•',
    ]

    return {
      JSXText(node) {
        const filename = context.getFilename()
        if (filename.includes('design/page')) return

        const raw = node.value

        // Nur Whitespace → überspringen
        if (!raw.trim()) return

        const text = raw.trim()

        // Zu kurz → überspringen
        if (text.length < minLength) return

        // Erlaubte Strings → überspringen
        if (allowedStrings.includes(text)) return

        // Nur Sonderzeichen (kein Buchstabe, keine Ziffer) → überspringen
        if (!/[a-zA-ZäöüÄÖÜß0-9]/.test(text)) return

        context.report({
          node,
          messageId: 'hardcodedText',
          data: { text: text.slice(0, 40) },
        })
      },
    }
  },
}

module.exports = noHardcodedJsxText
