# Making AHP Decisions — Final Pre-Launch Audit (v0.7 candidate)

## Credit
Visible masthead and footer: **A project developed by JustinL**.

## Corrections
- Fixed hierarchical manual weight change handler: splits `group|criterion` identifier rather than destructuring individual characters. This previously prevented correct edits to hierarchy weights.
- Unentered comparisons in full matrix now display **Choose judgment…** rather than visually defaulting to "Equal". No judgment is entered until user explicitly selects a preference.
- Adding/removing criteria clears existing saved weight scenarios to prevent stale scenario dimensionality.

## Mathematics
- Classical principal-eigenvector priorities, RI consistency checks, reciprocal matrices and hierarchy weights covered by automated suites.
- Manual weights reject negative, missing, nonnumeric or non-100% sums. Pairwise judgment entries must be complete before valid rankings.
- Direct scores are nonnegative relative values, normalized separately by criterion; they are not automatically inverse cost utilities. Measured frontier objectives require separate values and directions.
- Two-dimensional projections and multidimensional Pareto classifications are explicitly distinguished.
- The engine passed existing core, Phase 3, Phase 4 and Phase 5 automated tests following the patch. Excel `.xlsx` reference workbook opened successfully with openpyxl and has eight worksheets.

## Usability / trust
- Guided AHP comparison, advanced matrix, manual weighting, separate results/analytics and local project library retained.
- Project privacy notice and backup recommendations retained; JSON backups are unencrypted.
- Interface remains incomplete in accessibility and real browser integration validation. Native PDF generation and guided AHP throughout all hierarchy levels are not implemented.

## Release blockers
1. Normal hosted Chrome/Firefox/Safari end-to-end flows, including storage persistence and JSON import/export. Chromium's local HTTP navigation is blocked in this environment.
2. Desktop Excel/LibreOffice export smoke test; automated openpyxl workbook parsing passes.
3. Keyboard/screen-reader accessibility testing and focus behaviour following rerenders.
4. Additional independent verification on broader, randomized and adversarial pairwise matrices and real-world AHP benchmarks.

**Conclusion:** Mathematically credible, improved pre-launch candidate, but not certified error-free or production-ready.
