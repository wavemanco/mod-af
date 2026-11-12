export type PrivacyHit = { kind: 'email' | 'key'; index: number; sample: string }

// the domain may hold non-ASCII letters; a percent-encoded address stays out, at the owner's choice (2026-11-04).
// The local part may too, after one ASCII character: a wholly non-ASCII one is an at-name after CJK text.
const EMAIL = /[A-Za-z0-9._%+-][\p{L}\p{M}0-9._%+-]*@[\p{L}0-9.-]+\.\p{L}{2,}/gu
const KEYS = [
  /(?<![A-Za-z0-9])sk-(?:ant-)?[A-Za-z0-9_-]{20,}/g, // not the end of a word: "task-add-..."
  /(?<![A-Za-z0-9])[rs]k_live_[A-Za-z0-9]{20,}/g, // a live payment key
  /A[KS]IA[0-9A-Z]{16}/g, // an AWS key, long-term or temporary
  /gh[pousr]_[A-Za-z0-9]{36,}/g,
  /github_pat_[A-Za-z0-9_]{22,}/g,
  /glpat-[A-Za-z0-9_-]{20,}/g,
  /npm_[A-Za-z0-9]{36,}/g,
  /xox[abposr]-[A-Za-z0-9-]{10,}/g,
  /AIza[0-9A-Za-z_-]{35}/g,
  /whsec_[A-Za-z0-9+/]{24,}/g, // a webhook signing secret
  /eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, // a JWT
  // the whole block, body and all, to its END line or the end of the text; PGP's label ends in " BLOCK"
  /-----BEGIN [A-Z ]*PRIVATE KEY(?: BLOCK)?-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY(?: BLOCK)?-----|$)/g,
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
