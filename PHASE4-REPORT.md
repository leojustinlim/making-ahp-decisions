# Phase 4 audit report — v0.3

## Implementation

- `advanced-analytics.mjs`: independent pure functions for score contributions, exact one-criterion sensitivity, named scenario comparisons, reproducible Monte Carlo perturbation, and full-dimension vs two-axis Pareto flags.
- `index.html`: integrated dashboard, scenario creation/application/removal, thresholds, robustness, weighted contributions, and Pareto projection warning.
- `project-validation.mjs`: backwards-compatible optional `scenarios` import validation, including criterion ID/order mapping and normalized nonnegative weights.
- Uses the original `ahp-engine.mjs` unchanged for AHP eigenvectors and synthesis.

## Tests run

- Existing `tests.mjs`: 11 passing.
- Existing `phase3-tests.mjs`: 6 passing.
- `reference_check.py`: 5 independent NumPy checks passing.
- New `phase4-tests.mjs`: 11 passing.
- New `phase4-reference.py`: 1001 independently evaluated weight/score comparisons, 8 anchor checks and 1000 generated simplex checks passing.
- `phase4-inline-browser-check.py`: 7 passing in Chromium with substituted inline modules and simulated browser storage. Includes scenario JSON export/import.
- JavaScript syntax validation passed.

## Mathematical notes

- Sensitivity thresholds are **exact** for a fixed matrix of local alternative priorities when only one weight changes and all other criteria weights are proportionally redistributed. They are not exact under changes to alternative judgments or a change of normalisation method.
- Monte Carlo is a reproducible 2,000-draw perturbation analysis with independently sampled uniform multiplicative changes to input weights, followed by renormalization. First-place frequency is not a probability of real-world success and varies with perturbation model/seed. Original zero weights remain zero.
- Pareto dominance is evaluated on separate measurable objectives; 2D visual projections can disagree with dominance status in the full objective set.
- AHP criterion weights are not objective data; raw costs need explicit minimize direction in Pareto view.
- The current direct score evaluation is relative normalization of nonnegative, higher-is-better scores, **not** raw cost modelling.
- Existing engine max size is 10 criteria and alternatives; full hierarchy editor not yet implemented.

## Outstanding (do not claim production readiness)

- Chromium forbids navigation to localhost in the evaluation environment (`ERR_BLOCKED_BY_ADMINISTRATOR`); real HTTP-served browser reload/storage and Safari/mobile verification remain open.
- Isolated browser testing uses inlined module content and simulated storage, so it cannot replace normal browser integration testing.
- No third-party penetration/accessibility audit, randomized broad fuzzing, or independent scientific peer review has been completed.
- Excel/PDF report export and visual hierarchy editor are Phase 5 scope.
