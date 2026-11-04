import { expect, test } from 'claude-code/testing'
import { scanPrivacy } from '../hooks/core/privacy.ts'

const kinds = (t: string) => scanPrivacy(t).map(h => h.kind)
const a = (c: string, n: number) => c.repeat(n)

test('a personal address is found, with its place', () => {
  const hits = scanPrivacy('write to jane.doe@corp.io today')
  expect(hits).toEqual([{ kind: 'email', index: 9, sample: 'ja************io' }])
})

test('allowed addresses are not reported', () => {
  for (const ok of ['noreply@github.com', 'no-reply@acme.io', 'donotreply@acme.io', 'bot+noreply@acme.io',
    'x@example.com', 'x@example.org', 'x@example.net', '12+name@users.noreply.github.com', 'a@b.users.noreply.github.com']) {
    expect(scanPrivacy(ok)).toEqual([])
  }
})

test('each key shape is found on a made-up value', () => {
  const samples = [
    'sk-' + a('a', 24), 'sk-ant-' + a('b', 24), 'AKIA' + a('A', 16), 'ghp_' + a('c', 36), 'gho_' + a('d', 40),
    'github_pat_' + a('e', 22), 'xoxb-' + a('1', 12), 'AIza' + a('f', 35), '-----BEGIN RSA PRIVATE KEY-----',
    '-----BEGIN PRIVATE KEY-----']
  for (const k of samples) expect(kinds(`token: ${k} end`)).toEqual(['key'])
})

test('near misses are not keys', () => {
  expect(scanPrivacy('sk-short AKIA123 ghp_abc xoxb-1')).toEqual([])
})

test('sample never holds more than four characters of the match', () => {
  const hits = scanPrivacy('a@b.io ' + 'sk-' + a('z', 30) + ' jane@corp.io')
  expect(hits.length).toBe(3)
  for (const h of hits) expect(h.sample.replace(/\*/g, '').length).toBeLessThanOrEqual(4)
  expect(hits[1].sample.startsWith('sk')).toBe(true)
  expect(hits.map(h => h.index)).toEqual([...hits.map(h => h.index)].sort((x, y) => x - y))
})
