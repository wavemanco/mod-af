import { expect, test } from 'claude-code/testing'
import { maskPrivacy, scanPrivacy } from '../hooks/core/privacy.ts'

const kinds = (t: string) => scanPrivacy(t).map(h => h.kind)
const a = (c: string, n: number) => c.repeat(n)

test('a personal address is found, with its place', () => {
  const hits = scanPrivacy('write to jane.doe@corp.io today')
  expect(hits).toEqual([{ kind: 'email', index: 9, sample: 'ja************io' }])
})

test('allowed addresses are not reported', () => {
  for (const ok of ['x@example.com', 'x@example.org', 'x@example.net', '12+name@users.noreply.github.com']) {
    expect(scanPrivacy(ok)).toEqual([])
  }
})

test('a no-reply local part at an unlisted domain is a hit', () => {
  for (const hit of ['noreply@github.com', 'no-reply@acme.io', 'donotreply@acme.io']) expect(kinds(hit)).toEqual(['email'])
})

test('the no-reply allow list matches its domain exactly, and no "+noreply" local part', () => {
  for (const hit of ['bot+noreply@acme.io', 'a@b.users.noreply.github.com', 'a@evilusers.noreply.github.com'])
    expect(kinds(hit)).toEqual(['email'])
})

test('a word that ends in "sk" before a hyphen is no key', () => {
  expect(scanPrivacy('Merge branch feature/task-add-the-export-endpoint')).toEqual([])
  expect(kinds('key=sk-' + a('a', 24))).toEqual(['key'])
})

test('maskPrivacy masks each hit as its sample does, and leaves the rest', () => {
  const t = 'ask jane.doe@gmail.com or noreply@example.com, key sk-' + a('q', 24)
  const m = maskPrivacy(t)
  expect(scanPrivacy(m)).toEqual([])
  expect(m).toBe('ask ' + scanPrivacy(t)[0].sample + ' or noreply@example.com, key ' + scanPrivacy(t)[1].sample)
})

test('each key shape is found on a made-up value', () => {
  const samples = [
    'sk-' + a('a', 24), 'sk-ant-' + a('b', 24), 'AKIA' + a('A', 16), 'ghp_' + a('c', 36), 'gho_' + a('d', 40),
    'github_pat_' + a('e', 22), 'xoxb-' + a('1', 12), 'AIza' + a('f', 35), '-----BEGIN RSA PRIVATE KEY-----',
    '-----BEGIN PRIVATE KEY-----', '-----BEGIN PGP PRIVATE KEY BLOCK-----', 'sk_live_' + a('g', 24), 'rk_live_' + a('h', 24), 'glpat-' + a('i', 20),
    'npm_' + a('j', 36), 'ASIA' + a('B', 16), 'whsec_' + a('k', 32),
    'eyJ' + a('l', 12) + '.eyJ' + a('m', 12) + '.' + a('n', 16)]
  for (const k of samples) expect([k, kinds(`token: ${k} end`)]).toEqual([k, ['key']])
})

test('an address whose domain has non-ASCII letters is found; a percent-encoded one is not, at the owner\'s choice', () => {
  expect(kinds('write to jane@bücher.de today')).toEqual(['email'])
  expect(kinds('write to jane@corp.рф today')).toEqual(['email'])
  expect(scanPrivacy('write to jane%40corp.io today')).toEqual([])
})

test('an address whose local part ends in an accented letter or a mark is found; a wholly CJK one has an at-name\'s shape', () => {
  for (const hit of ['josé@corp.io', 'zoë@corp.io', 'josé@corp.io', 'éva@corp.io'])
    expect([hit, kinds(`write to ${hit} today`)]).toEqual([hit, ['email']])
  expect(scanPrivacy('ask 漢字@corp.io today')).toEqual([])
})

test('a PGP private block is masked whole, END line and all; a PGP public block is no key', () => {
  const m = maskPrivacy('before -----BEGIN PGP PRIVATE KEY BLOCK-----\nlQOYBFAKEFAKE\n-----END PGP PRIVATE KEY BLOCK----- after')
  expect([m.includes('FAKE'), m.includes('BLOCK')]).toEqual([false, false])
  expect(m.endsWith(' after')).toBe(true) // the mask stops at the END line
  expect(scanPrivacy('-----BEGIN PGP PUBLIC KEY BLOCK-----\nmQENBFAKEFAKE\n-----END PGP PUBLIC KEY BLOCK-----')).toEqual([])
})

test('near misses are not keys', () => {
  expect(scanPrivacy('sk-short AKIA123 ghp_abc xoxb-1 sk_live_short glpat-short npm_abc ASIA123 whsec_abc eyJa.eyJb.c')).toEqual([])
})

test('sample never holds more than four characters of the match', () => {
  const hits = scanPrivacy('a@b.io ' + 'sk-' + a('z', 30) + ' jane@corp.io')
  expect(hits.length).toBe(3)
  for (const h of hits) expect(h.sample.replace(/\*/g, '').length).toBeLessThanOrEqual(4)
  expect(hits[1].sample.startsWith('sk')).toBe(true)
  expect(hits.map(h => h.index)).toEqual([...hits.map(h => h.index)].sort((x, y) => x - y))
})

// the small check of the second round (HK-088): the older PGP label passed, and a long run of letters made the address
// scan grow with its square
test('a PGP block under the older SECRET KEY label is a key and is masked whole', () => {
  const m = maskPrivacy('before -----BEGIN PGP SECRET KEY BLOCK-----\nlQOYBFAKEFAKE\n-----END PGP SECRET KEY BLOCK----- after')
  expect([m.includes('FAKE'), m.includes('BLOCK'), m.endsWith(' after')]).toEqual([false, false, true])
  expect(kinds('token: -----BEGIN PGP SECRET KEY BLOCK----- end')).toEqual(['key'])
})

test('a long run of mixed letters is scanned in linear time, and a 64-letter local part is still found', () => {
  const t0 = performance.now()
  expect(scanPrivacy('a.é'.repeat(40_000) + ' end')).toEqual([])
  expect(performance.now() - t0).toBeLessThan(1000)
  expect(kinds(`write to ${'a'.repeat(64)}@corp.io today`)).toEqual(['email'])
  // a longer local part is masked whole, though the pattern reads only its last 64 characters
  const long = 'b'.repeat(36) + 'a'.repeat(64)
  expect(maskPrivacy(`write to ${long}@corp.io today`)).toBe(`write to bb${'*'.repeat(long.length + 8 - 4)}io today`)
  expect(scanPrivacy(`write to ${long}@corp.io today`)[0].index).toBe(9)
  // the narrow check (HK-091): a letter outside the BMP stopped the widening, and words before an address were masked
  const astral = `zq${'r'.repeat(18)}\u{2000B}${'a'.repeat(70)}`
  expect(maskPrivacy(`write to ${astral}@corp.io today`)).toBe(`write to zq${'*'.repeat(astral.length + 8 - 4)}io today`)
  // words written straight before an address are masked with it, and an address's non-ASCII first letters are never shown
  expect(maskPrivacy('请联系jane@corp.io的回复')).toBe('请联**************回复')
  expect(maskPrivacy('écrire à éva@corp.io')).toBe('écrire à év*******io')
  // the re-check (HK-092): an apostrophe stopped the widening, and the head could be half a surrogate pair
  expect(maskPrivacy("cc: anne-marie.o'neil@corp.io")).toBe(`cc: an${'*'.repeat(21)}io`)
  expect(maskPrivacy(' é\u{2000B}jane@corp.io')).toBe(` é${'*'.repeat(12)}io`)
  expect(maskPrivacy('x 𝐚𝐛c@corp.io')).toBe(`x 𝐚${'*'.repeat(9)}io`) // the head is one whole letter of two units
  // the closing round (HK-093): a typographic apostrophe, and a secret an address's widening reached into
  expect(maskPrivacy('cc: jane.o’neil@corp.io')).toBe(`cc: ja${'*'.repeat(15)}io`)
  const secret = 'whsec_abcdefghij/' + 'Q'.repeat(24)
  const both = maskPrivacy(`x '${secret}''jane@corp.io'`)
  expect([both.includes('abcdefghij'), both.includes('QQQ'), scanPrivacy(both)]).toEqual([false, false, []])
  expect(both.length).toBe(`x '${secret}''jane@corp.io'`.length)
})
