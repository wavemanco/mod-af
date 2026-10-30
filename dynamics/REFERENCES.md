# References

Every external source behind `dynamics`: what it is, whether its content was checked, and which part
of the plugin rests on it. Short tags such as *(Ford 2019)* in `prompt.md`, the checker's messages and
the rendered page point here.

**Verification status** (as of 2026-10-20; Meadows 1999 added 2026-10-30):
- **Full text**: the work itself, or a verbatim reproduction that names it, was read.
- **Record**: the bibliographic record and/or abstract was read (Crossref, publisher or index page), not the full text.
- **Unverified**: known only from search snippets or memory; nothing in the plugin depends on it alone.

## Provenance

The method generalizes a stock-and-flow model of a research codebase built and reviewed in October
2026. That build used Sterman (2000) for drawing conventions and Naugle, Langarudi & Clancy (2024)
for the defining characteristics of system dynamics, including the rule that every feedback loop
contains a stock; a search also surfaced Ford (2019), but its full text was not fetched at the time.
Everything else below was researched for this plugin on 2026-10-20, and the Ford glossary was read
in full then.

## System-dynamics notation and definitions

| Tag | Reference | Status | Used for |
|---|---|---|---|
| Sterman 2000 | Sterman, J. D. (2000). *Business Dynamics: Systems Thinking and Modeling for a Complex World*. Irwin/McGraw-Hill. ISBN 0-07-231135-5. | Record (book). Table 5-1 and Fig. 3-1 read in full via the MIT OCW reproduction below. | Link polarity defined against the counterfactual, including flow-to-stock links (inflow +, outflow −); the modelling process (problem articulation, dynamic hypothesis, formulation, testing, policy); the model boundary chart. |
| Siddiqi 2011 | Siddiqi, A. (2011). *ESD.00 Introduction to Engineering Systems*, Lecture 2. MIT OpenCourseWare. Reproduces Sterman (2000) Table 5-1 and Fig. 3-1. https://ocw.mit.edu/courses/esd-00-introduction-to-engineering-systems-spring-2011/816df198baedb3b544ab4148ce86927d_MITESD_00S11_lec02.pdf | Full text | The source through which Sterman's polarity table and process figure were read. |
| Sterman 2001 | Sterman, J. D. (2001). "Fine-Tuning Your Causal Loop Diagrams", Parts I and II. *The Systems Thinker* 12(5) and 12(6). https://thesystemsthinker.com/wp-content/uploads/pdfs/120502pk.pdf · https://thesystemsthinker.com/wp-content/uploads/pdfs/120602pk.pdf | Full text | + / − rather than s / o; no ambiguous links (split pathways); loop polarity by counting negative links and by tracing a change around the loop; every balancing loop has a goal; links must be causal, not correlational; actual vs perceived; delay marks; name and number loops; do not put every loop in one diagram. |
| Ford 2019 | Ford, D. N. (2019). "A system dynamics glossary". *System Dynamics Review* 35(4): 369–379. doi:10.1002/sdr.1641. CC-BY copy: https://web.mit.edu/blossoms/sites/default/files/video/download/Ford-2019-System_Dynamics_Review.pdf | Full text | Definitions of stock, flow, auxiliary, connector ("never stocks"), cloud (outside the boundary, inconsequential to the behaviour of interest), conserved flow, delay (material and information), loop polarity as the product of link signs, reference mode, dynamic hypothesis, exogenous variable. The plugin does **not** adopt the glossary's "same direction / opposite direction" wording for link polarity (see Richardson 1997). |
| Naugle 2024 | Naugle, A., Langarudi, S., & Clancy, T. (2024). "What is (quantitative) system dynamics modeling? Defining characteristics and the opportunities they create". *System Dynamics Review* 40(2). doi:10.1002/sdr.1762. arXiv:2307.11801. | Full text (arXiv version) | The four building blocks (stocks, flows, auxiliaries, constants); "Any feedback loop in a system dynamics model must include at least one stock"; stating the source of, and confidence in, the causal structure. The plugin draws qualitative structure, not the quantitative models the paper defines, and says so on every page. |
| Richardson 1997 | Richardson, G. P. (1997). "Problems in causal loop diagrams revisited". *System Dynamics Review* 13(3): 247–252. doi:10.1002/(SICI)1099-1727(199723)13:3<247::AID-SDR128>3.0.CO;2-9 | Record (abstract) | Why s / o notation fails for flows into and out of stocks, and why + / − is used. |
| Richardson 1986 | Richardson, G. P. (1986). "Problems with causal-loop diagrams". *System Dynamics Review* 2(2): 158–170. doi:10.1002/sdr.4260020207 | Record (metadata only) | Background only; no rule depends on it. |
| Schaffernicht 2007 | Schaffernicht, M. (2007). "Causality and diagrams for system dynamics". *Proceedings of the 2007 International System Dynamics Conference*. https://proceedings.systemdynamics.org/2007/proceed/papers/SCHAF239.pdf | Full text | Worked example showing why polarity must be defined against "what it would have been". |
| MIT D-4498 | MIT System Dynamics in Education Project. "Road Maps Glossary" (D-4498). https://ocw.mit.edu/courses/15-988-system-dynamics-self-study-fall-1998-spring-1999/c8a435c4649cb265aadf0b8f718c9f9f_glossary.pdf | Full text | Stocks are changed only by flows; connectors reach converters and flows, not stocks; converters drawn as circles. |
| Hines | Hines, J. "Standard Method" handout, MIT 15.879 Research Seminar in System Dynamics (Spring 2014). https://ocw.mit.edu/courses/15-879-research-seminar-in-system-dynamics-spring-2014/da344570c02fbb708eec93084927c4bd_MIT15_879S14_ModelProcOver.pdf | Full text | Elicitation order (variables, reference modes, problem statement, hypotheses, one loop at a time); "a variable is something that can go up, go down, or stay the same". |
| Trimble 2014 | Trimble, J. (2014). "Boundary Concepts in System Dynamics". *Proceedings of the 2014 International System Dynamics Conference*. https://proceedings.systemdynamics.org/2014/proceed/papers/P1175.pdf | Full text | Exogenous variables lie on the boundary; excluded variables lie outside it. The plugin keeps the two lists apart. |
| Lane 2008 | Lane, D. C. (2008). "The emergence and use of diagramming in system dynamics: a critical account". *Systems Research and Behavioral Science* 25(1): 3–23. doi:10.1002/sres.826 | Record (abstract) | Diagrams alone do not establish behaviour; the plugin claims structure only. |
| Vensim | Ventana Systems. Vensim Help, "Defined and Shadow Variables". https://www.vensim.com/documentation/22890.html | Full text | Shadow variables: defined elsewhere, drawn in angle brackets, no arrows may enter them. |
| isee | isee systems. Stella Help, "Creating a Variable Alias (Ghost)". https://iseesystems.com/resources/help/v2/Content/03-BuildingModels/Creating_variable_aliases.htm | Full text | Ghosts add no structure; nothing can go into them. |

## Validation without simulation

| Tag | Reference | Status | Used for |
|---|---|---|---|
| Forrester & Senge 1980 | Forrester, J. W., & Senge, P. M. (1980). "Tests for building confidence in system dynamics models". In A. A. Legasto, J. W. Forrester & J. M. Lyneis (Eds.), *System Dynamics*, TIMS Studies in the Management Sciences 14, North-Holland, pp. 209–228. | Read through two secondary accounts: Shreckengost's reproduction, and one recorded only as "Baik 1997", not traced to a full citation; original not seen | Structure verification, parameter verification, extreme conditions, boundary adequacy and dimensional consistency as structure tests. |
| Shreckengost | Shreckengost, R. C. "Dynamic simulation models: how valid are they?" MIT System Dynamics in Education Project, D-4463. https://ocw.mit.edu/courses/15-988-system-dynamics-self-study-fall-1998-spring-1999/2a6354d179f7f6e46d9d192d7a7a6e27_dynamic.pdf | Full text | "Every element of the model should have a real-world counterpart" — the reason every element carries evidence. |
| Schwaninger & Groesser 2009 | Schwaninger, M., & Groesser, S. (2009). "System Dynamics Modeling: Validation for Quality Assurance". In *Encyclopedia of Complexity and Systems Science*, Springer, pp. 9000–9014. doi:10.1007/978-0-387-30440-3_540. https://www.alexandria.unisg.ch/id/eprint/46696 | Full text | Which tests need no simulation (structure and parameter examination, direct extreme conditions, boundary adequacy of structure, dimensional consistency) and which do (behaviour, sensitivity, loop dominance) — the line between what the plugin checks and what it states only as a labelled hypothesis. |
| Barlas 1996 | Barlas, Y. (1996). "Formal aspects of model validity and validation in system dynamics". *System Dynamics Review* 12(3): 183–210. doi:10.1002/(SICI)1099-1727(199623)12:3<183::AID-SDR103>3.0.CO;2-4 | Record (abstract) | Structure validity comes first; behaviour tests need runs. |

## Process and practice

| Tag | Reference | Status | Used for |
|---|---|---|---|
| Martinez-Moyano & Richardson 2013 | Martinez-Moyano, I. J., & Richardson, G. P. (2013). "Best practices in system dynamics modeling". *System Dynamics Review* 29(2): 102–123. doi:10.1002/sdr.1495 | Record (abstract) | Background: practice is organised by modelling stage. No individual practice is quoted. |
| Richardson 2011 | Richardson, G. P. (2011). "Reflections on the foundations of system dynamics". *System Dynamics Review* 27(3): 219–243. doi:10.1002/sdr.462 | Record | The endogenous point of view. |
| Meadows 1999 | Meadows, D. H. (1999). "Leverage Points: Places to Intervene in a System". The Sustainability Institute. | Unverified | The idea and term of leverage points. The prototype used the term without a citation; added here unverified. The report's leverage points are hypotheses read from the model's own structure, so nothing rests on this source alone. |

## System dynamics of software (background for the survey guide)

| Tag | Reference | Status |
|---|---|---|
| Abdel-Hamid & Madnick 1991 | Abdel-Hamid, T., & Madnick, S. E. (1991). *Software Project Dynamics: An Integrated Approach*. Prentice Hall. ISBN 0-13-822040-9. | Record |
| Abdel-Hamid 1989 | Abdel-Hamid, T. K. (1989). "The dynamics of software project staffing: a system dynamics based simulation approach". *IEEE Transactions on Software Engineering* 15(2): 109–119. doi:10.1109/32.21738 | Record |
| Rahmandad & Weiss 2009 | Rahmandad, H., & Weiss, D. M. (2009). "Dynamics of concurrent software development". *System Dynamics Review* 25(3): 224–249. doi:10.1002/sdr.425 | Record |
| Madachy 2007 | Madachy, R. J. (2007). *Software Process Dynamics*. Wiley-IEEE Press. doi:10.1002/9780470192719 | Record |
| Franco et al. 2016 | Franco, E. F., Rocha, J., Carvalho, H., Marcelo, M., & Hirama, K. (2016). "An Analysis of Technical Debt Management Through Resources Allocation Policies in Software Maintenance Process". arXiv:1609.06868 | Record (arXiv page) |

## Algorithms in the checker

| Tag | Reference | Status | Used for |
|---|---|---|---|
| Johnson 1975 | Johnson, D. B. (1975). "Finding all the elementary circuits of a directed graph". *SIAM Journal on Computing* 4(1): 77–84. doi:10.1137/0204007 | Record (Crossref) | Enumerating every feedback loop. |
| Tarjan 1972 | Tarjan, R. (1972). "Depth-first search and linear graph algorithms". *SIAM Journal on Computing* 1(2): 146–160. doi:10.1137/0201010 | Record (Crossref) | Strongly connected components inside Johnson's algorithm. |

## Plugin rules (no external source)

These come from building and reviewing the stock-and-flow model the method generalizes, not from the
literature, and are tagged "plugin rule" where they appear:
- every number the page states as fact must appear in a cited quote, or in the claim of a part marked
  modelled (E04, a warning);
- requirement is not supply: what a part needs and what it gets are separate quantities;
- a text extract of a web page or PDF is made with a tool, never retyped or summarised, and the command
  is recorded;
- one id namespace across every kind of element, unique regardless of case; loop ids are R1… or B1…;
- every element states its status: nothing defaults to "observed";
- at most 40 elements and 40 loops in one figure, and 400 nodes, flows and links in a model (N12, L08;
  the advice against one comprehensive diagram is Sterman 2001's, the limits are the plugin's);
- a figure with more than about twelve loops is flagged as hard to read (L07; the advice against one
  comprehensive diagram is Sterman 2001's, the threshold is the plugin's);
- titles of two to four words (T01);
- the legend lists exactly the marks drawn, one entry per combination of shape, status and highlight;
- review: a draft first, three lenses, the number of rounds agreed with the person up front (2 by default) and recorded as `review.agreed`, later rounds on the fixes and what they touched, no round beyond the agreed number without the person's yes, the fixes no round reviewed said so in the footer, a later correction reviewed only with the person's yes, and a triage list for what is left (V01 warns when no agreed number is recorded or more rounds ran than were agreed; the full rule is step 7 of `prompt.md`).

## From the earlier `dynamics` prototype (no external source)

The prototype on branch `add-dynamics-plugin` of this repository cited no sources. Taken from it: the three survey angles (the engine, growth and memory, control and governance) with their product-docs variants; reference modes named as patterns (growth, S-curve, decline, oscillation, overshoot); the "should this be modelled at all?" check; the research step for guesses that carry the answer; and leverage points, missing feedback and which loop likely dominates (a hypothesis) in the report.

## Considered, not used

- **XMILE 1.0** (OASIS Standard, 2015; http://docs.oasis-open.org/xmile/xmile/v1.0/xmile-v1.0.html, full text) and
  **PySD** (Martin-Martinez et al. 2022, *JOSS* 7(78): 4329, doi:10.21105/joss.04329; docs read): a runnable model
  needs an initial value and an equation for every stock and flow. A code-grounded structural model does not have
  them, and inventing them would put unsourced numbers on the page, so the plugin emits no simulation files.
- **BPTK-Py**, **SDEverywhere**, **Insight Maker**: simulation and authoring tools; nothing in the plugin depends on them.
