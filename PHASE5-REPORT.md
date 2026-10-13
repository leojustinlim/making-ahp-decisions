# Phase 5 verification report — 13 October 2026

## Delivered
1. Two-level criteria hierarchy editor (parent groups and subcriteria), manual or pairwise comparisons within each level. Global leaf weights are used in all existing scoring and analytics.
2. SpreadsheetML 2003 XML export (not XLSX), printable HTML report (browser print-to-PDF rather than native PDF), and existing full project JSON export.
3. Mathematical unit tests of manual and pairwise hierarchy, invalid structures, aggregation totals, and report escaping. Legacy projects without hierarchy are supported.

## Tests actually executed
- `node --test tests.mjs phase3-tests.mjs phase5-tests.mjs`: **27/27 passed**.
- `node phase4-tests.mjs`: **11/11 passed**.
- Existing NumPy reference checks: **5/5 eigenvector comparisons**, plus existing phase-4 cross-checks.
- Node syntax: browser module passes `node --check`.
- Spreadsheet XML: parsed successfully with `lxml.etree`.

## Known limitations / unsatisfied test gates
- Isolated Chromium test attempted but phase-5 inlined-bundle harness failed to initialise, so no phase-5 browser functionality tests are reported as passed.
- HTTP-served application navigation, autosave after true browser restart, print CSS, Excel application interoperability, Safari/iOS, accessibility and mobile responsive layout remain unverified.
- Reports currently expose global weights, contributions, rankings, CR diagnostics and objectives, but not complete input pairwise judgment matrices, reference sources, or native .xlsx/.pdf.
- The hierarchy has **one nested group level**. Parent group comparisons may be incomplete and are correctly rejected when requested for calculation. Additional testing is needed for all editing/removal sequences and saved-project migrations.
- Do not use v0.4 for critical decisions without independently reviewing the inputs, calculations and saved outputs.
