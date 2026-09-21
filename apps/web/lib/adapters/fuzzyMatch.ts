/**
 * Snaps a spoken/transcribed name to the closest real option (a position,
 * department, credential type) when it's close enough to obviously be a
 * mishearing -- same Levenshtein-distance safety net used for supplier
 * names in the contractor-os voice-quote adapter. Returns null rather
 * than guessing when nothing is a close enough match, so voice input
 * never silently assigns the wrong position/department to someone.
 */

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/['’.]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshteinDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp: number[][] = Array.from({ length: rows }, () => new Array(cols).fill(0));
  for (let i = 0; i < rows; i++) dp[i][0] = i;
  for (let j = 0; j < cols; j++) dp[0][j] = j;
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[rows - 1][cols - 1];
}

export function fuzzyMatchOption<T extends { id: string; name: string }>(spoken: string, options: T[]): T | null {
  const cleaned = spoken.trim();
  if (!cleaned || options.length === 0) return null;
  const normalizedSpoken = normalize(cleaned);

  let best: { option: T; distance: number } | null = null;
  for (const option of options) {
    const distance = levenshteinDistance(normalizedSpoken, normalize(option.name));
    if (!best || distance < best.distance) best = { option, distance };
  }
  if (!best) return null;

  const threshold = Math.max(1, Math.round(normalize(best.option.name).length * 0.35));
  return best.distance <= threshold ? best.option : null;
}
