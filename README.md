# AHP calculation engine v0.1

Dependency-free ES module supporting classical pairwise AHP, directly entered weights, tree-wide global weights, distributive alternative synthesis, and Pareto dominance.

## Method contract
- Pairwise comparisons use reciprocal positive matrices (1/9 to 9 for input judgments). All comparisons must be filled; partial matrices are rejected.
- Principal eigenvector via convergent power iteration, normalized to sum to one. Maximum eigenvalue computed from mean(Aw/w) once convergence is reached; residual is checked.
- Consistency index CI=(lambda_max-n)/(n-1), consistency ratio CR=CI/RI; n=1 or 2 => CI=CR=0. Saaty RI reference [0,0,0,.58,.90,1.12,1.24,1.32,1.41,1.45,1.49]. Maximum matrix dimension 10. CR<=.10 guideline.
- Direct/manual weights can contain zeros, cannot be negative, require positive total; percent mode enforces 100% total.
- AHP hierarchical weights multiply parent and child local priorities; siblings normalize within each parent.
- Distributive-mode synthesis requires local alternative priorities under each leaf criterion to sum to 1. Scores are weighted sums. Adding or deleting alternatives may change scores/ranks (rank reversal). Ideal-mode synthesis is NOT yet implemented.
- Objective scores and measured costs must not be conflated. `linearUtility` is an explicitly labeled, fixed-anchor performance transformation (not pairwise AHP).
- Pareto-efficient points are those not dominated in all directions by another alternative. Duplicates are both considered efficient absent other dominating points. Epsilon handles near-equality, but with large epsilon dominance may not be transitive: use it only for floating point tolerance, not user-defined indifference.
- Sensitivity/frontier visualizations and saving will be UI-layer concerns; recompute synthesis for each scenario using the same engine.

## Reference verification
Run `node --test tests.mjs`, and `python reference_check.py` to compare against independent NumPy eigenvectors and expected outcomes. JS and Python tests do not share the same eigenvector algorithm.

## API example
```js
import {calculateComparisons, manualWeights, synthesize, paretoFront} from './ahp-engine.mjs';
const result=calculateComparisons(3,[[0,1,2],[0,2,4],[1,2,2]]);
const scores=synthesize(['A','B'],result.weights,[[.75,.25],[.4,.6],[.6,.4]]);
const frontier=paretoFront([{id:'A',objectives:{cost:80,quality:90}},{id:'B',objectives:{cost:90,quality:80}}],{cost:'minimize',quality:'maximize'});
```

## Release boundaries
The package includes an **early browser interface prototype** (`index.html`) featuring project setup, direct and pairwise weighting, option evaluations, rankings, what-if weight sliders, Pareto plots, browser-local autosaving and JSON project import/export. The numerical engine has passed its specified tests; **the browser interface has only passed JavaScript syntax validation**, not comprehensive browser/end-to-end testing. It is not production-ready. In particular, verify file import validation, all user workflows, mobile layouts, and persistence before public release. Excel/PDF export, hierarchical editing and ideal-mode synthesis are not in the prototype.

## Phase 3 validation (13 October 2026)

Tests: `node --test tests.mjs phase3-tests.mjs` and `python reference_check.py`.

17 Node automated tests and 5 independent NumPy eigensolver comparisons pass. The additional tests include malformed imports, null unfinished entries, maximum supported matrix dimension, Pareto invariance and synthesis permutation invariance. The standalone `project-validation.mjs` now validates JSON projects on import and startup. Empty score/weight fields preserve an explicit missing value rather than silently interpreting them as zero. When deleting a criterion or alternative, dependent references are cleaned or reset. The browser saves locally and supports JSON export/import, but persistence is not a substitute for external backup.

**Browser test limitation:** End-to-end Chromium testing was attempted in this execution environment. The browser was blocked from navigating to local or network URLs by administrator policies (`ERR_BLOCKED_BY_ADMINISTRATOR`). An isolated Chromium DOM test with bundled inlined application modules and simulated localStorage passed 9/9 checks, covering switching modes, pairwise matrices, CR display, rankings, Pareto chart, JSON download/import, and missing score warnings. This **does not prove real origin-based autosave/reload or cross-browser compatibility**. `browser_check.py` documents this constrained test setup. Full production browser verification is still required. Phase 3 is therefore **not fully signed off**. No production readiness claim is made.

### Known scope limitations
- This prototype's UI has flat criteria, even though the mathematical engine supports hierarchies.
- Direct scores are relative-normalized positive benefit scores, not automatically converted raw costs.
- AHP judgments use the principal eigenvector and the documented RI table through 10 items.
- Distributive AHP synthesis can exhibit rank reversal.
- Browser storage can be cleared. Export JSON regularly.

## Phase 4 (v0.3)

`advanced-analytics.mjs` adds exact one-criterion winner-switch sensitivity (with proportional redistribution), weighted score contributions, up to 12 saved weighting scenarios, repeatable 2,000-draw weight robustness simulations, and a distinction between full-dimensional Pareto classification and the current two-dimensional projection. Scenarios persist in JSON and local storage; project schema remains version 1 with an optional `scenarios` field.

Run `node phase4-tests.mjs`, `python phase4-reference.py`, and `python phase4-inline-browser-check.py`. See `PHASE4-REPORT.md` for scope, tests and open limitations. Browser navigation for normal HTTP hosting remains to be verified outside this restricted environment.

## Phase 5 (v0.4) — hierarchy editor and decision reporting

- Optional two-level criterion hierarchy. Assign each leaf criterion to exactly one named parent group. Root group weights and sibling leaf weights can independently use **manual 100% allocation** or **Saaty pairwise comparisons**. The product of the group and local criterion weight is the global leaf weight used in the unchanged distributive synthesis and Phase 4 analytics. The hierarchy uses a single method for both levels per project; flat AHP/manual weighting remains available.
- Hierarchical weights and pairwise judgments are saved in the optional `hierarchy` project property; version-1 projects without that property remain readable. Enabling hierarchy for an existing project creates one group containing the existing criteria.
- Two user-facing exports: **SpreadsheetML 2003 XML** (`.xml`, opens as a multi-sheet workbook in compatible versions of Excel; not `.xlsx`) and **self-contained printable HTML** (`.html`, use browser Print → Save as PDF; not a directly generated PDF). Both export criterion global weights, ranked scores, per-criterion contributions, available consistency ratios, and performance/Pareto data, with methodological cautions. These outputs use completed analytical results; exported project JSON remains available for full data backup.
- Enhanced two-level visual outline, explicit guidance, accessible focus outlines, and toolbar exports.
- Run `node --test tests.mjs phase3-tests.mjs phase5-tests.mjs`, `node phase4-tests.mjs`, `python reference_check.py`, and `python phase4-reference.py`. An independent XML parser confirmed the generated SpreadsheetML is well formed.
- **Status:** calculation-unit tests and syntax checks pass. The isolated Chromium phase-5 bundling harness currently fails to initialise, and real hosted browser storage/Safari/mobile operation has not been validated. Phase 5 is a development build, **not a production sign-off**. In-browser clickthrough, import/export, print layout, and multi-device tests are required before public release.


## Making AHP Decisions v0.5 UX update
See `UX-REVIEW.md` for implemented guided pairwise workflow, local project library and audit limitations. The existing project schema remains unchanged.

## v0.6 changes
The application is branded **Making AHP Decisions**. Results and Advanced analytics are now separate wizard steps; the Results step explains current AHP rankings, and the Advanced analytics step contains sensitivity, scenarios, robustness and Pareto analysis.

**Backup and privacy:** Local autosave and snapshots do not sync across devices and can disappear when browser/site data is cleared, evicted, or used in private browsing. Export a JSON project backup regularly and keep it secure; it contains readable plaintext input data, not an encrypted archive. This build contains no project-data server or backend network requests. Static website hosting may independently log access metadata.

**Excel:** The report button now generates genuine `.xlsx` OpenXML in the browser without network access. It contains report values but not recalculating AHP formulas. PDF reporting remains HTML for print-to-PDF. See `V06-AUDIT.md` for testing coverage and limitations.


## Final audit (v0.7 candidate)
See `FINAL-AUDIT.md`. A project developed by JustinL.
