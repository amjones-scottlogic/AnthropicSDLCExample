// Returns the trimmed value, or null if it is empty or only whitespace.
export function cleanText(value: string): string | null {
  const trimmed = value.trim()

  return trimmed === '' ? null : trimmed
}
