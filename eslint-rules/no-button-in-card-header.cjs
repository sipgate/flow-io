/**
 * eslint-rules/no-button-in-card-header.js
 *
 * Regel: <Button> darf kein direktes Kind von <CardHeader> sein.
 *
 * Design System: CardHeader enthält nur Status-Badges (rechts oben).
 * Action-Buttons (Edit, Delete, Upload…) gehören in CardContent.
 *
 * ✅ Erlaubt: <CardHeader> mit <Badge> oder <div><Badge>
 * ❌ Verboten: <CardHeader> mit <Button> direkt oder in einem <div>-Wrapper
 *
 * Ausnahmen: design/page.tsx (Showcase)
 */

/** @type {import('eslint').Rule.RuleModule} */
const noButtonInCardHeader = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Action-Buttons dürfen nicht in <CardHeader> liegen — nur Status-Badges sind dort erlaubt',
      category: 'Design System',
    },
    schema: [],
    messages: {
      buttonInHeader:
        '<Button> in <CardHeader> gefunden. Action-Buttons gehören in <CardContent>. Nur Status-Badges sind in CardHeader erlaubt.',
    },
  },

  create(context) {
    return {
      JSXOpeningElement(node) {
        if (
          node.name.type !== 'JSXIdentifier' ||
          node.name.name !== 'Button'
        ) {
          return
        }

        const filename = context.getFilename()
        if (filename.includes('design/page')) return

        // Elternkette traversieren — suche CardHeader vor Card/CardContent
        let current = node.parent // JSXElement für <Button>
        while (current) {
          if (current.type !== 'JSXElement') {
            current = current.parent
            continue
          }

          const name = current.openingElement?.name?.name
          if (name === 'CardHeader') {
            context.report({ node, messageId: 'buttonInHeader' })
            return
          }

          // Wenn wir Card oder CardContent erreichen, stoppen (Button ist außerhalb CardHeader)
          if (name === 'Card' || name === 'CardContent') return

          current = current.parent
        }
      },
    }
  },
}

module.exports = noButtonInCardHeader
