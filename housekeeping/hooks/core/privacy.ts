export type PrivacyHit = { kind: 'email' | 'key'; index: number; sample: string }

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g
const KEYS = [
  /(?<![A-Za-z0-9])sk-(?:ant-)?[A-Za-z0-9_-]{20,}/g, // not the end of a word: "task-add-..."
  /AKIA[0-9A-Z]{16}/g,
  /gh[pousr]_[A-Za-z0-9]{36,}/g,
  /github_pat_[A-Za-z0-9_]{22,}/g,
  /xox[abposr]-[A-Za-z0-9-]{10,}/g,
  /AIza[0-9A-Za-z_-]{35}/g,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/g,
]

const mask = (m: string): string =>
  m.length <= 4 ? '*'.repeat(m.length) : m.slice(0, 2) + '*'.repeat(m.length - 4) + m.slice(-2)

function allowed(email: string): boolean {
  const domain = email.slice(email.lastIndexOf('@') + 1).toLowerCase()
  return ['example.com', 'example.org', 'example.net', 'users.noreply.github.com'].includes(domain)
}

export function scanPrivacy(text: string): PrivacyHit[] {
  const hits: PrivacyHit[] = []
  for (const m of text.matchAll(EMAIL)) if (!allowed(m[0])) hits.push({ kind: 'email', index: m.index, sample: mask(m[0]) })
  for (const re of KEYS) for (const m of text.matchAll(re)) hits.push({ kind: 'key', index: m.index, sample: mask(m[0]) })
  return hits.sort((a, b) => a.index - b.index)
}

// The text with each hit masked as its sample is. For commit subjects, which cannot be edited.
export function maskPrivacy(text: string): string {
  let out = text.replace(EMAIL, m => (allowed(m) ? m : mask(m)))
  for (const re of KEYS) out = out.replace(re, mask)
  return out
}
