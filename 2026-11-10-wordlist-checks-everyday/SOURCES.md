# Sources

Each text was cut from its source by the scripts in `scripts/`, before any check ran. All are works of the
United States government, so they are in the public domain. Retrieval times are the downloaded files' times.

| Id | Source | Retrieved (UTC) | sha256 of the download | Cut | Words | sha256 of the text |
|---|---|---|---|---|---|---|
| f1 | https://www.ecfr.gov/api/renderer/v1/content/enhanced/current/title-29?part=825&section=825.110 | 2026-11-10 09:16:44Z | `c964b3130378dd5862cfa4b89d5138535072522541619381f4a711b64a0773b9` | The whole section, with (c)(2) and (c)(3) left out. | 853 | `488197ca5eb561e39d9ab3b83626b95193cf00f5b269f22367ff8527a758293e` |
| f2 | https://www.law.cornell.edu/supremecourt/text/22-166 | 2026-11-10 09:18:54Z | `0929f83755c74896385d9390a91beaba642fdc4b41840bd19f40681bd575ee7c` | Caption, opening, Part I, and the closing paragraphs. | 697 | `72efe17ea632c20bf92da9702c3bd2d5431181ee2ba334706d4f1d81b87621cb` |
| f3 | https://www.cms.gov/regulations-and-guidance/guidance/manuals/downloads/bp102c08pdf.pdf | 2026-11-10 09:16:55Z | `9e6bd59dfad61dcce32921c6fb5f1981840f1eaa8a7ebe5c2b533e97c9e0974f` | Sections 20 and 20.1, up to 20.1.1. | 944 | `9020b2ee092f8fb2b4f6d26cb8914669ab6974df4d823b8961be4773e5df4e1e` |
| f4 | https://www.ntsb.gov/investigations/AccidentReports/Reports/HIR2308.pdf | 2026-11-10 09:16:46Z | `ee78af3c2be1115ba22262ddc875ee498940cac613a4fad381649fd208f70213` | Title and opening paragraph, section 2.2, section 3. Page headers, page numbers and footnotes removed; "59-yearold" corrected to "59-year-old". | 888 | `cf55e4f42b0df49e5262beaba1c6481213ac808d2ef8906e1b4579902aa29c22` |
| f5 | https://www.govinfo.gov/content/pkg/FR-2026-01-15/html/2026-00755.htm | 2026-11-10 09:17:01Z | `13807253f5048f1ffcd134539f20a56cc20ef5d20657f8768408b66c500b2d78` | The notice from its title to its end, with the ADDRESSES and FOR FURTHER INFORMATION CONTACT block left out. | 919 | `1e9c4448100efe0920f6e2ad8fea513351ca671213267d6739bc37fe8d146311` |

## Departures from the plan

- **f2** comes from the Cornell Legal Information Institute's copy of the opinion, not the court's PDF. The court now serves
  the opinion as its preliminary print (`598us2r27_aplc.pdf`). In that PDF, every "fi" pair is lost when the text is
  extracted ("filed" comes out as "fled", "beneficial" as "benefcial"), with both pdftotext and pypdf. Those slips would
  have shown up as false J01 findings. The opinion's words are the court's, a public-domain government work.
- **f5** leaves out the contact block, which names a staff member and gives an email address. This branch keeps email
  addresses out. An everyday reader of the notice does not need the block.
- **f3** is 944 words and **f5** 919, inside the plan's 400 to 1,000.
