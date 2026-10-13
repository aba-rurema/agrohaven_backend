export function sanitizeText(value: string): string {
  let cleaned = '';
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code < 32 || code === 127 || char === '<' || char === '>') continue;
    cleaned += char;
  }
  return cleaned.trim();
}
