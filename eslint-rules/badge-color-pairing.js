/**
 * eslint-rules/badge-color-pairing.js
 *
 * Regel: <Badge className="bg-X-500/10 ..."> muss eine passende text-X-700
 * (Light) und dark:text-X-400 (Dark) aus derselben Farbfamilie enthalten.
 *
 * Erlaubte Paarungen laut Carbon + Lime Design System:
 *   lime   → bg-lime-500/10   text-lime-700   dark:bg-lime-400/10   dark:text-lime-400
 *   amber  → bg-amber-500/10  text-amber-700  dark:bg-amber-400/10  dark:text-amber-400
 *   red    → bg-red-500/10    text-red-600    dark:bg-red-400/10    dark:text-red-400
 *   blue   → bg-blue-500/10   text-blue-600   dark:bg-blue-400/10   dark:text-blue-400
 *   orange → bg-orange-500/10 text-orange-700 dark:bg-orange-400/10 dark:text-orange-400
 *   neutral→ bg-neutral-N/10  text-neutral-N  (keine strikte Paarung)
 */

const COLOR_RULES = {
  lime: { text: ['text-lime-700'], darkText: ['dark:text-lime-400'] },
  amber: { text: ['text-amber-700'], darkText: ['dark:text-amber-400'] },
  red: { text: ['text-red-600', 'text-red-700'], darkText: ['dark:text-red-400'] },
  blue: { text: ['text-blue-600', 'text-blue-700'], darkText: ['dark:text-blue-400'] },
  orange: { text: ['text-orange-700'], darkText: ['dark:text-orange-400'] },
}

/** @type {import('eslint').Rule.RuleModule} */
const badgeColorPairing = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Badge bg-X-500/10 muss mit passendem text-X-700 und dark:text-X-400 gepaart werden',
      category: 'Design System',
    },
    schema: [],
    messages: {
      missingTextColor:
        'Badge hat "{{bg}}" aber kein passendes Text-Farbe-Pair. Erwartet: {{expected}}',
      missingDarkText:
        'Badge hat "{{bg}}" aber kein passendes dark:-Text-Pair. Erwartet: {{expected}}',
    },
  },

  create(context) {
    return {
      JSXOpeningElement(node) {
        // Nur <Badge> prüfen
        if (
          node.name.type !== 'JSXIdentifier' ||
          node.name.name !== 'Badge'
        ) {
          return
        }

        // className-Attribut finden
        const classNameAttr = node.attributes.find(
          (attr) =>
            attr.type === 'JSXAttribute' &&
            attr.name?.name === 'className'
        )
        if (!classNameAttr) return

        // Nur String-Literals auswerten (keine Template-Literals / cn()-Aufrufe)
        const value = classNameAttr.value
        if (!value || value.type !== 'Literal' || typeof value.value !== 'string') return

        const cls = value.value

        // Prüfe ob bg-X-*/10 Pattern vorhanden
        const bgMatch = cls.match(/\bbg-(lime|amber|red|blue|orange)-\d+\/10\b/)
        if (!bgMatch) return

        const color = bgMatch[1]
        const rule = COLOR_RULES[color]
        if (!rule) return

        // Light-Mode Text prüfen
        const hasCorrectText = rule.text.some((t) => cls.includes(t))
        if (!hasCorrectText) {
          context.report({
            node: classNameAttr,
            messageId: 'missingTextColor',
            data: {
              bg: bgMatch[0],
              expected: rule.text.join(' oder '),
            },
          })
        }

        // Dark-Mode Text prüfen
        const hasCorrectDarkText = rule.darkText.some((t) => cls.includes(t))
        if (!hasCorrectDarkText) {
          context.report({
            node: classNameAttr,
            messageId: 'missingDarkText',
            data: {
              bg: bgMatch[0],
              expected: rule.darkText.join(' oder '),
            },
          })
        }
      },
    }
  },
}

module.exports = badgeColorPairing
