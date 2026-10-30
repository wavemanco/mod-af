# dynamics: details

The full rules the checker applies, how it reads numbers in quotes, and how the plugin's tools use
your Claude Code permissions. The [README](./README.md) explains what the plugin is for; the sources
behind each rule are in [`REFERENCES.md`](./REFERENCES.md).

## What the checker checks, and what it does not

Checked mechanically, with the source for each rule (see [`REFERENCES.md`](./REFERENCES.md)):

| Area | Rules |
|---|---|
| Notation | Flows run between stocks and clouds; every stock has a flow; links never end on a stock, constant, cloud or shadow; one sign per link, + or −; clouds say why they are outside; every element states its status, so a misspelt field cannot turn something into "observed"; ids are unique regardless of case (Ford 2019; MIT D-4498; Sterman 2001; Richardson 1997) |
| Evidence | Every observed element has at least one exact quote that the check finds in its cited file, as whole words and whole numbers, in the cited lines when they are given (lines are recommended, and a warning says where the quote sits); a web address alone is not enough; inferred parts carry a claim; a number the page states as fact that is in no checked quote or modelled claim is flagged, the page and its sources being read by one reader and a quote lending only the numbers its file gives inside the quote, the file read as a whole (so a quote cut from a call or list opened on an earlier line lends that call's or list's items) (an element's own text against its own sources; a loop's name and story against the elements on the loop and those that link into them; a behaviour pattern against its own checked quotes, and a suspected one's "why"; page-wide prose, cloud labels included, against the whole model; title, question, horizon, loop goals, units and component names excepted); observed code backed only by documents is flagged, judged by the file's extension or name (a document's name such as README, CHANGELOG or HISTORY counts with no extension, a document extension or .txt, whatever "kind" says), and for any other .txt or .html file by its declared "kind", or with none by its folder or a saved extract's "from"; a file Claude Code refuses to read is reported in its words, except that a notebook, PDF or image is named for what it is, with the tool's first sentence when it names another problem; a person's refusal is reported in their words (Shreckengost; Naugle 2024) |
| Loops | Every closed causal path is a declared loop; a loop the model missed is reported with its route and no verdict, so the modeller traces it first; loop ids are R1… or B1…, and the letter must match the type, which is the product of the signs with a flow + into the stock it fills and − out of the one it drains; every loop contains a stock; loops through parts that are not built are listed separately; at most 40 loops a figure (Naugle 2024; Sterman 2000; Sterman 2001; Ford 2019; Johnson 1975) |
| Structure tests without simulation | What stops each outflow when its stock is empty (a net + path from the stock to its outflow, built or recorded as intended or missing; a stock that reaches its outflow only through net − paths, built or not, is flagged); information delays on loops, which hide a stock; units of flows against their stocks; elements that affect nothing; variables with no inputs (Forrester & Senge 1980; Schwaninger & Groesser 2009; Sterman 2001; Trimble 2014) |
| Page | The legend lists exactly the marks drawn, one entry per combination; a copy of an element (a shadow) shows that element's status and highlight, and selecting it shows the claim and sources of what it copies; layout warnings for overlaps and crossings; a figure that cannot be drawn is not written |

Not machine-checked, and said so on every run: whether a quote supports what is drawn (the facts
review does that), whether prose is true, whether a text extract of a web page or PDF matches the
original (the method requires a tool-made extract and records the command), whether a number in
page-wide prose comes from the element it is about, numbers in prose written as compound durations
or versions with more than two parts (hex and scientific forms are compared by value), numbers in a
locale's own format (every number is read the English way: "1.000" is 1, "3,5" is 3 and 5), digits
in brackets on the page, which are read as a list in code ("[1,500]" is 1 and 500), which text in a
source is a comment (guessed by its marker, `#`, `//`, `--` or `/*`, and read as prose), and
anything about behaviour over time. Most of these checks are warnings: the model must resolve each one
or say why it stands.

## How numbers in quotes are read

Numbers are read one way on the page and in its sources, and a checked quote lends the numbers its
file gives inside the quote, the file read as a whole. Digits joined by commas in threes are one
number, quoted or not, unless they are an item of a list in code: between commas or brackets (spaces
and line breaks allowed) inside `[ ]`, `{ }`, or a `(` that follows `=`, a comma, an opening bracket, a
name with no space (a call), or SQL's `IN` or `VALUES` in capitals, and not inside a string or a
comment opened after that bracket. A comment is read as prose, as a string is, and is guessed by its
marker alone, outside a string: `#`, `//` or `--` to the end of the line, and `/*` to `*/`; quote
marks inside a comment are not counted. So
`[100,250,500]`, `range(1,100)` and `IN (500,502,503)` give their items, while "(up to 1,500 jobs)",
`limit (1,500)` and `log("over 1,500 jobs")` give 1500, and `// waits 500, 1,000, 2,000 ms` inside a
function body gives 500, 1000 and 2000. The page is read the same way: "[1,500]" in the answer is 1
and 500, and a warning for such an item names the list it came from; write one number outside
brackets, and a list as plain numbers (`[1000, 5000]`). Known limits: a CSV row `8,120` reads as 8120;
a list held in a string (`"retry_on": "500,502,503"`) is one number; a bracket written inside a string
or a comment still opens a list (`"see [1,000, 5,000]"` gives 1, 0, 5 and 0, and a Lua `--[[ ]]` block
is read as code on every line); a marker that is no comment (Python's floor division `//`, a `#` that
is not a comment, a decrement `--`) makes the items after it, in a bracket opened before it, read as
prose to the end of its line (after `/*`, to the next `*/`), so such a list is one number; a `/*` that
opens no comment stops the count of quote marks until the next `*/`, so a string after it may be read
as code; a `(` after a name and a space (`return (1,500)`, `x (1,500)`), after a colon, after
lower-case `in` or after a closing bracket (`handlers[0](1,500)`, `make_clamp(n)(1,500)`) is prose, so
its digits are one number. A page number taken from any of these is flagged (E04); accept the warning
and say why.

## Permissions and file access

The plugin's two tools (`mcp__dynamics__check`, `mcp__dynamics__render`) work under your own
permission settings:
- Every file they read, the model included, is read through Claude Code's own Read tool, and the page
  is written through its Write tool. Your rules, permission mode, hooks and dialogs therefore decide
  each read and write exactly as they would for Claude's own calls: in default mode you are asked
  before the page is written; in accept-edits mode it is written.
- `render` writes only where the page lands inside the model file's folder, never onto a symbolic link,
  and never over a
  file dynamics did not write or one changed since. The page carries a fingerprint of its own
  content, so this holds on any machine and after a git checkout; reformatting that only changes
  whitespace is not counted as a change. A hook that strips comments from the page as it is written
  removes the fingerprint; the render says so, and later renders will not replace that page until it
  is deleted. While such a hook runs, each new page loses its fingerprint too, so also exclude the page
  from the hook.
- An explicit allow, ask or deny rule for the tools themselves is honoured (an ask rule is put to you
  as a question). Known limit: a PreToolUse hook that matches the tools' own names
  (`mcp__dynamics__…`) is not run for them, because a plugin's own tool is answered by the plugin;
  hooks on Read and Write still run for every file the tools touch.
- Nothing is read past 2 MB or from anything but a regular file. One Read call returns about 25,000
  tokens by default (`CLAUDE_CODE_FILE_READ_MAX_OUTPUT_TOKENS` changes it) and dynamics asks for at
  most 2,000 lines, so a large file takes several calls (a
  1.5 MB file of mostly 270-character lines took 30 in a real session; a file of very short lines takes one
  call per 2,000 lines). In default mode a file outside the working folder is asked about on each Read
  call; adding its folder with `/add-dir` avoids that.
- Known limits of reading through the Read tool: it reads whole lines, so a file with a very long line
  (minified JSON, a one-line bundle) cannot be read, and it returns PDFs and images as non-text.
  Notebooks are cited through an extract by choice: dynamics cites line numbers, which a notebook's
  cells do not have and a script extract does. Cite a text extract made with a tool instead (a
  pretty-printed copy, `jupyter nbconvert --to script`, `pdftotext`), and record the command in the
  evidence's `from`.
