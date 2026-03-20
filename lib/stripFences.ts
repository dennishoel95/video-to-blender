/**
 * Strips markdown code fences from Claude output.
 * Handles ```python, ```, and leading/trailing whitespace.
 */
export function stripFences(text: string): string {
  return text
    .replace(/^```(?:python|py)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();
}
