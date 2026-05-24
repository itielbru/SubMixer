/** Returns true for languages that read right-to-left. Used to flip the
 *  cue editor / cue list text direction automatically. */
export function isRtlLang(lang: string | undefined | null): boolean {
  if (!lang) return false;
  const l = lang.toLowerCase();
  return /^(heb|he|ara|ar|fa|per|fas|urd|ur|yid|yi|iw)$/.test(l);
}

/** Unicode bidirectional formatting code-points we expose as one-click
 *  insertion buttons in the cue editor. */
export const BIDI_CHARS = {
  LRM: '‎',
  RLM: '‏',
  LRE: '‪',
  RLE: '‫',
  PDF: '‬',
  LRO: '‭',
  RLO: '‮',
} as const;

export const BIDI_LABELS: Record<keyof typeof BIDI_CHARS, string> = {
  LRM: 'LRM',
  RLM: 'RLM',
  LRE: 'LRE',
  RLE: 'RLE',
  PDF: 'PDF',
  LRO: 'LRO',
  RLO: 'RLO',
};

/** Move punctuation that ended up on the wrong side of a parenthesized
 *  Hebrew/Arabic phrase. Handles the common case:
 *
 *      "(טקסט)."  →  ".(טקסט)"
 *      ".(טקסט)"  →  "(טקסט)."  (when the line starts the sentence)
 *
 *  Conservative: only swaps when the surrounding chars look RTL or the
 *  string starts/ends with punctuation that's clearly out of place. */
export function reverseRtlPunctuation(text: string): string {
  // Trailing punctuation that should sit to the LEFT of a closing paren
  // in visual order. We swap pairs like ").", "?)" etc.
  let out = text;
  // Move sentence-terminal punctuation that is INSIDE the last
  // parenthesis to its outside: "(text).?!" already fine; but if the
  // file was authored without RTL marks we see "(.)" or ")text)"
  // patterns. We cover the most common pair-swap variants.
  const pairs: Array<[RegExp, string]> = [
    [/\)([.,;:?!])/g, '$1)'],
    [/([.,;:?!])\(/g, '($1'],
    [/\]([.,;:?!])/g, '$1]'],
    [/([.,;:?!])\[/g, '[$1'],
  ];
  for (const [re, rep] of pairs) out = out.replace(re, rep);
  return out;
}
