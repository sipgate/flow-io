/**
 * eslint-rules/index.js
 *
 * Flow-IO Design System ESLint Plugin
 * Lokales Plugin — kein npm-Publish nötig.
 *
 * Registrierte Regeln:
 *   flow-io-design/table-in-card         → <Table> muss in <Card> liegen
 *   flow-io-design/badge-color-pairing   → bg-X-N/10 muss text-X-N aus gleicher Familie haben
 *   flow-io-design/no-hardcoded-jsx-text → JSXText muss i18n-Aufruf sein
 */

const tableInCard = require('./table-in-card.cjs')
const badgeColorPairing = require('./badge-color-pairing.cjs')
const noHardcodedJsxText = require('./no-hardcoded-jsx-text.cjs')
const noButtonInCardHeader = require('./no-button-in-card-header.cjs')

const plugin = {
  meta: {
    name: 'flow-io-design',
    version: '1.0.0',
  },
  rules: {
    'table-in-card': tableInCard,
    'badge-color-pairing': badgeColorPairing,
    'no-hardcoded-jsx-text': noHardcodedJsxText,
    'no-button-in-card-header': noButtonInCardHeader,
  },
}

module.exports = plugin
