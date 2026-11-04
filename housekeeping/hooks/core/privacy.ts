export type PrivacyHit = { kind: 'email' | 'key'; index: number; sample: string }

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g
const KEYS = [
  /sk-(?:ant-)?[A-Za-z0-9_-]{20,}/g,
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
  const at = email.lastIndexOf('@')
  const local = email.slice(0, at).toLowerCase()
  const domain = email.slice(at + 1).toLowerCase()
  return ['noreply', 'no-reply', 'donotreply'].includes(local) || local.endsWith('+noreply')
    || ['example.com', 'example.org', 'example.net'].includes(domain) || domain.endsWith('users.noreply.github.com')
}

export function scanPrivacy(text: string): PrivacyHit[] {
  const hits: PrivacyHit[] = []
  for (const m of text.matchAll(EMAIL)) if (!allowed(m[0])) hits.push({ kind: 'email', index: m.index, sample: mask(m[0]) })
  for (const re of KEYS) for (const m of text.matchAll(re)) hits.push({ kind: 'key', index: m.index, sample: mask(m[0]) })
  return hits.sort((a, b) => a.index - b.index)
}
