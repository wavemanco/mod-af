import { expect, test } from 'claude-code/testing'
import { checkText, DEFAULT_GLOSSARY, loadLists } from '../hooks/check.ts'
import { EXCEPTIONS, FAMILIARITY, REPLACEMENTS } from '../hooks/data.ts'

// A smoke test of the shipped word lists through the path the plugin uses: hooks/register.ts builds
// its lists with loadLists(FAMILIARITY, REPLACEMENTS, EXCEPTIONS) and hands them to checkText.
// tests/data.test.ts pins each list's raw text; check.test.ts pins the checks on small inline lists;
// plugin.test.ts runs register.ts (so the real lists) but pins the wiring. This test pins what the
// loaded lists say about a few known words, and what the checker then does with them.

test('the shipped lists load through loadLists, and the checker reads them as intended', () => {
  const lists = loadLists(FAMILIARITY, REPLACEMENTS, EXCEPTIONS)

  // The lists themselves, as loadLists builds them.
  expect((lists.familiarity.get('house') ?? 0) >= DEFAULT_GLOSSARY.cutoff).toBe(true) // a common word
  expect(lists.familiarity.has('idempotent')).toBe(false) // not on the list: unfamiliar
  expect(lists.replacements.find(r => r.from === 'utilize')?.to).toContain('use')
  expect(lists.exceptions.has('implement')).toBe(true)
  expect(lists.replacements.find(r => r.from === 'implement')).toBeDefined() // so the exception is what silences it

  // The same words through the checker.
  const text = [
    'We build the house. The house is old.',
    'Each job is idempotent. A retry is idempotent too.',
    'Utilize the queue to implement the plan.',
  ].join('\n\n')
  const { findings } = checkText({ text, lists, codes: ['J01', 'J07'] })
  const j01 = findings.filter(f => f.code === 'J01').map(f => f.term?.toLowerCase())
  const j07 = findings.filter(f => f.code === 'J07')
  expect(j01).toContain('idempotent') // used twice, not common, not defined
  expect(j01).not.toContain('house') // used twice, but common
  expect(j07.find(f => f.term?.toLowerCase() === 'utilize')?.suggestion).toContain('use')
  expect(j07.map(f => f.term?.toLowerCase())).not.toContain('implement') // an exception
})
