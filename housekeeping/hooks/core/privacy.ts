export type PrivacyHit = { kind: 'email' | 'key'; index: number; sample: string }

// the domain may hold non-ASCII letters; a percent-encoded address stays out, at the owner's choice (2026-11-04).
// The local part may too, after one ASCII character: a wholly non-ASCII one is an at-name after CJK text.
// At most the 64 characters RFC 5321 allows, so a long run of letters is scanned in linear time (HK-088).
const EMAIL = /[A-Za-z0-9._%+-][\p{L}\p{M}0-9._%+-]{0,63}@[\p{L}0-9.-]+\.\p{L}{2,}/gu
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
  // the whole block, body and all, to its END line or the end of the text; PGP's label ends in " BLOCK", and its
  // older label says SECRET (HK-088)
  /-----BEGIN [A-Z ]*(?:PRIVATE|SECRET) KEY(?: BLOCK)?-----[\s\S]*?(?:-----END [A-Z ]*(?:PRIVATE|SECRET) KEY(?: BLOCK)?-----|$)/g,
]

// the first and last two characters stay, never half a surrogate pair (HK-092)
const mask = (m: string): string => {
  if (m.length <= 4) return '*'.repeat(m.length)
  const h = /[\uD800-\uDBFF]/.test(m[1]) ? 1 : 2, t = /[\uDC00-\uDFFF]/.test(m.at(-2) ?? '') ? 1 : 2
  return m.slice(0, h) + '*'.repeat(m.length - h - t) + m.slice(-t)
}

function allowed(email: string): boolean {
  const domain = email.slice(email.lastIndexOf('@') + 1).toLowerCase()
  return ['example.com', 'example.org', 'example.net', 'users.noreply.github.com'].includes(domain)
}

// Each address with its whole local part: the pattern reads at most the last 64 characters of it, so a longer one is
// widened to the left here, to a space or punctuation, and no part of it is left unmasked (HK-088). It steps by code
// point, so a letter outside the BMP does not stop it (HK-091). Words written straight before an address, with no
// space, are masked with it: a few letters of prose too many rather than an address's first letters on show (the
// automated security review of 324aea5, over the narrow check's wish to keep them)
// an apostrophe too (o'brien@): the pattern starts after it, the widening must not stop at it (HK-092)
const LOCAL = /[\p{L}\p{M}0-9._%+'-]/u
function emails(text: string): { start: number; end: number }[] {
  const out: { start: number; end: number }[] = []
  for (const m of text.matchAll(EMAIL)) {
    const floor = out.at(-1)?.end ?? 0
    let start = m.index
    while (start > floor) {
      const w = /[\uDC00-\uDFFF]/.test(text[start - 1]) && start - 2 >= floor && /[\uD800-\uDBFF]/.test(text[start - 2]) ? 2 : 1
      if (!LOCAL.test(text.slice(start - w, start))) break
      start -= w
    }
    out.push({ start, end: m.index + m[0].length })
  }
  return out
}

export function scanPrivacy(text: string): PrivacyHit[] {
  const hits: PrivacyHit[] = []
  for (const { start, end } of emails(text)) {
    const m = text.slice(start, end)
    if (!allowed(m)) hits.push({ kind: 'email', index: start, sample: mask(m) })
  }
  for (const re of KEYS) for (const m of text.matchAll(re)) hits.push({ kind: 'key', index: m.index, sample: mask(m[0]) })
  return hits.sort((a, b) => a.index - b.index)
}

// The text with each hit masked as its sample is. For commit subjects, which cannot be edited.
export function maskPrivacy(text: string): string {
  let out = '', at = 0
  for (const { start, end } of emails(text)) {
    const m = text.slice(start, end)
    out += text.slice(at, start) + (allowed(m) ? m : mask(m))
    at = end
  }
  out += text.slice(at)
  for (const re of KEYS) out = out.replace(re, mask)
  return out
}
