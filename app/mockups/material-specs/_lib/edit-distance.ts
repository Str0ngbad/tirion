// Levenshtein edit distance between two strings.
// Used in the cascade create modal to surface near-match suggestions
// when typed text doesn't substring-match an existing value (e.g., catches
// "1018 stell" → "1018 Steel" typo suggestions).
export function levenshtein(a: string, b: string): number {
  const la = a.length;
  const lb = b.length;

  if (la === 0) return lb;
  if (lb === 0) return la;

  // prev[j] = edit distance between a[0..i-1] and b[0..j-1]
  const prev = Array.from({ length: lb + 1 }, (_, i) => i);
  const curr = new Array<number>(lb + 1);

  for (let i = 1; i <= la; i++) {
    curr[0] = i;
    // Non-null assertions on array reads below are safe — loop bounds ensure
    // curr and prev are populated at all accessed indices. noUncheckedIndexedAccess
    // can't infer this from the loop structure alone.
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1]! + 1,      // insertion
        prev[j]! + 1,           // deletion
        prev[j - 1]! + cost     // substitution
      );
    }
    for (let j = 0; j <= lb; j++) prev[j] = curr[j]!;
  }

  return prev[lb]!;
}
