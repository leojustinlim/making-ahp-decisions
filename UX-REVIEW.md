# Making AHP Decisions — UX iteration (v0.5)

## Implemented
- Renamed interface and browser title to **Making AHP Decisions**.
- More approachable four-stage labels and persistent step navigation.
- Guided **flat-criteria** pairwise comparison, with first/second/equal preference, Saaty 1–9 strength, progress, previous/next and clear judgment. Full matrix remains available.
- Both traditional AHP and direct manual percentage weighting remain available. The hierarchy editor and pairwise method also remain available in the existing advanced form.
- Short interpretation of the leading ranked alternative (explicitly not a success probability).
- Browser-local project snapshot library: save, open, duplicate, delete. Supports up to 15 snapshots; this is not cloud sync or durable backup.
- Session undo for regular edit operations (up to 30 revisions), preserving existing JSON project format.
- Improved keyboard focus and small-screen guided comparison layout.

## Verification
- `node --check ux-syntax-check.mjs`: passed.
- `node --test tests.mjs phase3-tests.mjs phase4-tests.mjs phase5-tests.mjs`: 28 tests passed (11 + 6 + 1 + 10).
- New user journeys (guided-comparison click behaviour, real localStorage restore, cross-browser, mobile) have **not** been verified end-to-end. Do not call this production-ready.

## Second-look audit / remaining priorities
1. Pairwise comparison UX on hierarchical sibling groups and alternative evaluation still uses the matrix; extend guided interaction consistently.
2. Current four-stage flow combines results and frontier; separate advanced analysis into dedicated workspace tabs.
3. Stronger project integrity: stale saved scenarios and sensitivity overrides can require clearing after structural edits.
4. Export remains Excel-compatible XML and print-to-PDF HTML, rather than native XLSX/PDF.
5. Add accessible live save status, focus retention after rerender and confirm-destructive changes for all delete actions.
6. Browser storage is local, quota-dependent and not automatic cross-device sync. Preserve JSON backups.
7. Test in actual hosted Safari, Chrome and Firefox on phone and desktop, particularly autosave and import.
8. Run security/accessibility audit (WCAG 2.2 AA target), including file import and keyboard-only flow.

## Known math boundary
Direct scores are normalized within each criterion and must represent higher-is-better utility, not raw cost values. Pareto analysis accepts separate raw measurable objectives with explicit maximize/minimize directions.
