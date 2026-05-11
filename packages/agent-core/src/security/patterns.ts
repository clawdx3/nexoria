/**
 * Dangerous pattern scanner for terminal/code tools.
 */
export const DANGEROUS_PATTERNS = [
  /rm\s+-rf\s+\//i,
  />\s*\/dev\/null\s*;?\s*rm/i,
  /curl\s+.*\s*\|\s*(bash|sh|zsh)/i,
  /wget\s+.*\s*\|\s*(bash|sh|zsh)/i,
  /eval\s*\(/i,
  /exec\s*\(/i,
  /os\.system\s*\(/i,
  /subprocess\.call\s*\(/i,
  /__import__\s*\(\s*['"]os['"]/i,
  /;\s*rm\s+-rf/i,
  /mkfs\./i,
  /dd\s+if=/i,
  /:\(\)\{\s*:\|:\s*&\s*\};/i, // fork bomb
];

export function isDangerous(input: string): boolean {
  return DANGEROUS_PATTERNS.some((pattern) => pattern.test(input));
}

export function scanForDangerousPatterns(input: string): string[] {
  return DANGEROUS_PATTERNS
    .filter((pattern) => pattern.test(input))
    .map((pattern) => pattern.source);
}
