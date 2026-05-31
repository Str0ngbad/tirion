// Levenshtein edit distance between two strings.
// Used in combobox selectors to surface near-match suggestions
// when typed text doesn't substring-match an existing value.
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
    // curr and prev are populated at all accessed indices.
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1]! + 1,
        prev[j]! + 1,
        prev[j - 1]! + cost
      );
    }
    for (let j = 0; j <= lb; j++) prev[j] = curr[j]!;
  }

  return prev[lb]!;
}
