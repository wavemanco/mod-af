# The scratch change for part 2

One line of `hooks/check.ts` at commit 7eb9cac, changed in a scratch copy only, never on the code branch:

```
const NEVER_ENDS = new Set(['mr', 'mrs', 'ms', 'dr', 'prof', 'st', 'vs', 'cf', 'fig', 'approx', 'eg', 'ie', 'viz', 'ca', 'app', 'arg', 'f', 'fed', 'id', 'minn', 'n', 'no', 'pp', 'pub', 'reg', 'rev', 's', 'stat', 'subds', 'supp', 'tr', 'u', 'w', 'v'])
```

`stock.json` is J03 with the checker as it is; `patched.json` with this change. Both from `scripts/run_j03.ts`.
