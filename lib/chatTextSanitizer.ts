export function sanitizeAssistantText(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/[*_`>#~]/g, '')
    .replace(/\s*[—–]\s*/g, ', ')
    .replace(/(?:\uD83C[\uDF00-\uDFFF]|\uD83D[\uDC00-\uDEFF]|\uD83E[\uDD00-\uDDFF])/g, '')
    .replace(/[\u2600-\u27BF]/g, '')
    .replace(/\s+,/g, ',')
    .replace(/,\s*,+/g, ',')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trimStart();
}

