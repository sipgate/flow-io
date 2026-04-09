'use client'

import { useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Search } from 'lucide-react'

/**
 * IPA character catalog with phonetic/spoken names for fuzzy search.
 * Names include German and English aliases so users can search naturally.
 */
const IPA_CATALOG: { char: string; names: string[] }[] = [
  // Stress & length
  { char: 'ˈ', names: ['hauptbetonung', 'primary stress', 'betonung', 'stress', 'betont'] },
  { char: 'ˌ', names: ['nebenbetonung', 'secondary stress', 'secondary'] },
  { char: 'ː', names: ['lang', 'länge', 'long', 'long vowel', 'längezeichen', 'dehnung'] },
  { char: '.', names: ['silbengrenze', 'syllable', 'punkt', 'silbe'] },
  // Short vowels
  { char: 'ɪ', names: ['i kurz', 'short i', 'lax i', 'bit', 'mit', 'bitte', 'kurzes i'] },
  { char: 'ʊ', names: ['u kurz', 'short u', 'lax u', 'foot', 'und', 'kurzes u'] },
  { char: 'ɛ', names: ['e offen', 'open e', 'bed', 'weg', 'epsilon', 'kurzes e'] },
  { char: 'ɔ', names: ['o offen', 'open o', 'sonne', 'lot', 'thought', 'kurzes o'] },
  { char: 'æ', names: ['ae', 'a englisch', 'cat', 'trap', 'flat', 'ash'] },
  { char: 'ə', names: ['schwa', 'neutral', 'bitte', 'the', 'comma', 'mittelvokal'] },
  { char: 'ɐ', names: ['a reduziert', 'reduced a', 'besser', 'er unbetont', 'vokalisches r'] },
  { char: 'ʌ', names: ['a englisch kurz', 'cup', 'strut', 'cut', 'run'] },
  { char: 'ɜ', names: ['bird', 'nurse', 'turn', 'er englisch', 'offenes e'] },
  { char: 'ɑ', names: ['a lang', 'father', 'palm', 'open a', 'dunkles a'] },
  { char: 'ɒ', names: ['o britisch', 'lot british', 'hot british', 'kurzes o britisch'] },
  // Rounded front vowels (Umlaut)
  { char: 'y', names: ['ü lang', 'long ue', 'über', 'french lune', 'geschlossenes ü'] },
  { char: 'ø', names: ['ö lang', 'oe lang', 'höhe', 'geschlossenes ö', 'long oe'] },
  { char: 'œ', names: ['ö kurz', 'oe kurz', 'hölle', 'offenes ö', 'short oe'] },
  { char: 'ʏ', names: ['ü kurz', 'hübsch', 'kurzes ü', 'short ue'] },
  // Fricatives
  { char: 'ʃ', names: ['sch', 'sh', 'schule', 'ship', 'zisch', 'palatoalveolar'] },
  { char: 'ʒ', names: ['zh', 'garage', 'measure', 'vision', 'stimmhaftes sch', 'journal'] },
  { char: 'ç', names: ['ich laut', 'ch vorne', 'ich', 'nicht', 'icht', 'palatal'] },
  { char: 'χ', names: ['ach laut', 'ch hinten', 'bach', 'doch', 'uvular', 'reibelaut'] },
  { char: 'ð', names: ['th stimmhaft', 'voiced th', 'the', 'this', 'that', 'weiches th'] },
  { char: 'θ', names: ['th stimmlos', 'voiceless th', 'think', 'thin', 'hartes th'] },
  { char: 'ʁ', names: ['r deutsch', 'german r', 'uvular r', 'rachen r', 'zäpfchen r'] },
  { char: 'β', names: ['b spanisch', 'voiced bilabial', 'spanish b', 'frikativer b'] },
  { char: 'ɣ', names: ['g spanisch', 'voiced velar', 'ach ng', 'frikativer g'] },
  { char: 'ɦ', names: ['h stimmhaft', 'voiced h', 'czech h'] },
  // Nasals & approximants
  { char: 'ŋ', names: ['ng', 'lang', 'sing', 'ring', 'nasal velar', 'enklang'] },
  { char: 'ɲ', names: ['ny', 'gn', 'kampagne', 'spanisch n', 'palatal nasal'] },
  { char: 'ʋ', names: ['w niederlaendisch', 'labiodental approximant', 'niederlaendisch w'] },
  // Stops
  { char: 'ʔ', names: ['knacklaut', 'glottal stop', 'glottis', 'einsatz', 'kehlkopfverschluss'] },
  { char: 'ɡ', names: ['g stimmhaft', 'voiced g', 'get', 'go'] },
  // Affricates
  { char: 'ʦ', names: ['ts', 'zahn', 'zeit', 'pizza', 'affricate ts'] },
  { char: 'ʧ', names: ['tsch', 'ch englisch', 'church', 'check'] },
  { char: 'ʤ', names: ['dsch', 'j englisch', 'judge', 'job', 'dj'] },
  { char: 'ʦ', names: ['pf', 'pferd', 'apfel'] },
]

/** Simple fuzzy match: all query tokens must appear in some name */
function searchChars(query: string): { char: string; names: string[] }[] {
  const q = query.toLowerCase().trim()
  if (!q) return []
  const tokens = q.split(/\s+/)
  return IPA_CATALOG.filter(({ names }) =>
    tokens.every((token) => names.some((name) => name.includes(token)))
  ).slice(0, 12)
}

/**
 * IPA character groups for the always-visible picker rows.
 *
 * hint: example word where *...* marks the part that corresponds to this sound.
 * E.g. "m*i*t" → "m" dimmed, "i" highlighted, "t" dimmed.
 * No asterisks = show the whole string without highlighting (used for diacritics).
 */
const IPA_GROUPS: { label: string; entries: { char: string; hint: string }[] }[] = [
  {
    label: 'Betonung/Länge',
    entries: [
      { char: 'ˈ', hint: 'Haupt' },
      { char: 'ˌ', hint: 'Neben' },
      { char: 'ː', hint: 'lang' },
      { char: '.', hint: 'Silbe' },
    ],
  },
  {
    label: 'Vokale',
    entries: [
      { char: 'ɪ', hint: 'm*i*t' },
      { char: 'ʊ', hint: '*u*nd' },
      { char: 'ɛ', hint: 'W*e*g' },
      { char: 'ɔ', hint: 'S*o*nne' },
      { char: 'æ', hint: '*ca*t' },
      { char: 'ə', hint: 'bitt*e*' },
      { char: 'ɐ', hint: 'bess*er*' },
      { char: 'ʌ', hint: 'c*u*p' },
      { char: 'ɜ', hint: 'b*ir*d' },
      { char: 'ɑ', hint: 'f*a*ther' },
      { char: 'y', hint: '*ü*ber' },
      { char: 'ø', hint: 'H*ö*he' },
      { char: 'œ', hint: 'H*ö*lle' },
      { char: 'ʏ', hint: 'h*ü*bsch' },
    ],
  },
  {
    label: 'Konsonanten',
    entries: [
      { char: 'ʃ', hint: '*Sch*ule' },
      { char: 'ʒ', hint: 'Gara*ge*' },
      { char: 'ŋ', hint: 'la*ng*' },
      { char: 'ç', hint: 'i*ch*' },
      { char: 'χ', hint: 'Ba*ch*' },
      { char: 'ð', hint: '*th*e' },
      { char: 'θ', hint: '*th*ink' },
      { char: 'ʁ', hint: '*R*ot' },
      { char: 'ʔ', hint: 'be*-*acht' },
      { char: 'ɡ', hint: '*g*et' },
      { char: 'ʦ', hint: 'Piz*z*a' },
      { char: 'ʧ', hint: '*tsch*' },
      { char: 'ʤ', hint: '*J*ob' },
    ],
  },
]

/**
 * Parse "m*i*t" → [['m', false], ['i', true], ['t', false]]
 * Strings without asterisks → [['text', false]]
 */
function parseHint(hint: string): [string, boolean][] {
  const parts = hint.split('*')
  return parts.map((text, i) => [text, i % 2 === 1] as [string, boolean])
}

interface IpaCharPickerProps {
  /** Current value of the phoneme input */
  value: string
  /** Called with the new value after insertion */
  onChange: (value: string) => void
  /** Ref to the actual <input> element for cursor tracking */
  inputRef: React.RefObject<HTMLInputElement | null>
}

export function IpaCharPicker({ value, onChange, inputRef }: IpaCharPickerProps) {
  const t = useTranslations('phonemeSets')
  const [search, setSearch] = useState('')

  const insert = useCallback(
    (char: string) => {
      const input = inputRef.current
      const start = input?.selectionStart ?? value.length
      const end = input?.selectionEnd ?? value.length
      const newValue = value.slice(0, start) + char + value.slice(end)
      onChange(newValue)
      // Restore cursor and refocus after React re-render
      requestAnimationFrame(() => {
        if (!input) return
        input.focus()
        input.setSelectionRange(start + char.length, start + char.length)
      })
    },
    [value, onChange, inputRef]
  )

  const searchResults = searchChars(search)

  return (
    <div className="rounded border bg-muted/40 px-2 py-2 space-y-2">
      {/* Search row */}
      <div className="flex items-center gap-1.5">
        <Search className="h-3 w-3 text-muted-foreground shrink-0" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder='z.B. "sch", "ng", "knacklaut"…'
          className="flex-1 text-xs bg-transparent outline-none placeholder:text-muted-foreground min-w-0"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="text-muted-foreground hover:text-foreground text-xs"
          >
            ✕
          </button>
        )}
      </div>

      {/* Search results */}
      {search && (
        <div className="flex flex-wrap gap-1">
          {searchResults.length === 0 ? (
            <span className="text-xs text-muted-foreground">{t('noResults')}</span>
          ) : (
            searchResults.map(({ char, names }) => (
              <button
                key={char + names[0]}
                type="button"
                onClick={() => { insert(char); setSearch('') }}
                title={names.slice(0, 3).join(', ')}
                className="h-7 min-w-[2rem] px-1.5 rounded text-sm font-mono border border-primary/40 bg-primary/5 hover:bg-primary/15 transition-colors flex items-center gap-1"
              >
                <span>{char}</span>
                <span className="text-[10px] text-muted-foreground font-sans">{names[0]}</span>
              </button>
            ))
          )}
        </div>
      )}

      {/* Static groups */}
      {!search && IPA_GROUPS.map((group) => (
        <div key={group.label} className="flex items-start gap-1 flex-wrap">
          <span className="text-[10px] text-muted-foreground w-24 shrink-0 pt-1">{group.label}</span>
          {group.entries.map(({ char, hint }) => (
            <button
              key={char}
              type="button"
              onClick={() => insert(char)}
              title={IPA_CATALOG.find((c) => c.char === char)?.names.join(', ') ?? char}
              className="flex flex-col items-center rounded border border-border bg-background hover:bg-accent hover:text-accent-foreground transition-colors px-1.5 py-0.5 min-w-[2.5rem]"
            >
              <span className="text-sm font-mono leading-tight">{char}</span>
              <span className="text-[9px] leading-tight font-sans">
                {parseHint(hint).map(([text, highlighted], i) =>
                  text ? (
                    <span key={i} className={highlighted ? 'text-orange-500 font-bold' : 'text-foreground'}>
                      {text}
                    </span>
                  ) : null
                )}
              </span>
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}
