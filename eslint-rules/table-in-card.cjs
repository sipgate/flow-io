/**
 * eslint-rules/table-in-card.js
 *
 * Regel: <Table> muss einen <Card>-Vorfahren im JSX-Baum haben.
 * Ausnahme: design/page.tsx (Showcase)
 */

/** @type {import('eslint').Rule.RuleModule} */
const tableInCard = {
  meta: {
    type: 'problem',
    docs: {
      description: '<Table> muss innerhalb einer <Card> liegen (Design System)',
      category: 'Design System',
    },
    schema: [],
    messages: {
      missingCard:
        '<Table> muss von einer <Card>-Komponente umschlossen sein. Verwende <Card><CardContent className="p-0"><Table>.',
    },
  },

  create(context) {
    return {
      JSXOpeningElement(node) {
        if (node.name.type !== 'JSXIdentifier' || node.name.name !== 'Table') {
          return
        }

        // Design-Showcase ist ausgenommen
        const filename = context.getFilename()
        if (filename.includes('design/page')) {
          return
        }

        // Elternkette traversieren und nach Card suchen
        let current = node.parent // JSXElement
        while (current) {
          if (
            current.type === 'JSXElement' &&
            current.openingElement?.name?.type === 'JSXIdentifier' &&
            current.openingElement.name.name === 'Card'
          ) {
            return // Card gefunden — kein Fehler
          }
          current = current.parent
        }

        context.report({
          node,
          messageId: 'missingCard',
        })
      },
    }
  },
}

module.exports = tableInCard
