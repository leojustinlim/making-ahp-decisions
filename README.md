# Making AHP Decisions

**Current interface version: 1.6.0** · A privacy-conscious, browser-based Analytic Hierarchy Process (AHP) decision-making tool.

**Live tool:** https://leojustinlim.github.io/making-ahp-decisions/

Making AHP Decisions helps people compare alternatives across multiple criteria, examine trade-offs, and understand how their priorities affect a ranking. It is designed for both first-time AHP users and people comfortable working with pairwise comparison matrices.

## Getting started

1. **Define Decision:** Enter a title, criteria and alternatives. Optionally group criteria into a two-level hierarchy.
2. **Assign Importance:** Compare criteria pairwise (recommended) or enter direct percentages. In a hierarchy, compare parent groups, then criteria within each parent.
3. **Evaluate Options:** Compare alternatives under each criterion, or assign direct scores.
4. **Results:** Review the ranked alternatives, relative priorities, and their interpretation.
5. **Advanced Analytics:** Explore weighted contributions, criterion-weight adjustments, potential winner changes, scenarios, robustness and Pareto analysis when supported by the chosen scoring mode.

Use **Load Standard Sample** for a one-level laptop decision and **Load Complex Sample** for a two-level facilities management decision. Both contain fictional data for demonstration only.

## Comparison experiences

**Guided Comparisons** presents one judgment at a time, including preference strength and completion progress. **Full Matrix** offers direct entry of reciprocal pairwise comparisons. Both modes use the same underlying AHP judgments and mathematical engine.

For the complex two-level sample, the Assign Importance page now provides Guided Comparisons for **Level 1 parent groups** and each **Level 2 subcriteria group**. Use the **Compare within** selector to switch sets. These are separate local comparisons; the resulting global weight of a leaf criterion equals its parent weight multiplied by its within-group weight.

Traditional AHP uses the Saaty 1–9 scale and reports consistency ratios, with CR ≤ 0.10 as a common guideline rather than a quality guarantee. Manual percentages are an alternative and have no pairwise consistency ratio.

## Storage and privacy

Project data is saved in **browser local storage**, not sent to an application server. The website host can still collect routine access logs. My Projects contains browser-local snapshots; these **do not sync** across browsers or devices and are not durable backups. Use **Backup File (JSON)** regularly. JSON files are readable plaintext, not encrypted.

## Reports

- **Download XLSX Report:** Generates an OpenXML workbook in the browser containing report values (not live spreadsheet AHP formulas).
- **Download as PDF:** Uses a printable HTML/browser print flow; the browser produces the PDF via Print → Save as PDF.
- **Open File (JSON)** and **Backup File (JSON):** Import/export project inputs and stored scenario data.

Fixed 0–10 scoring is a distinct mode. Some advanced analyses and report exports are unavailable in this mode; the application labels these limitations.

## Technical architecture

The application is a dependency-free static site. Main components:

| File | Purpose |
| --- | --- |
| `index.html` | UI, workflow state and event handling |
| `design-system.css` | Shared typography, spacing, controls, palette and responsive styles |
| `ahp-engine.mjs` | AHP matrix calculations, synthesis and Pareto functions |
| `hierarchy.mjs` | Parent/subcriterion local and global weights |
| `project-validation.mjs` | Project input/import validation |
| `advanced-analytics.mjs` | Sensitivity, scenario and robustness analysis |
| `reporting.mjs` | Result-report preparation |
| `xlsx-export.mjs` | Native XLSX report generation |

### Mathematical boundaries

- Pairwise judgments range from 1/9 to 9. Reciprocal matrix entries are inferred.
- Priorities use a principal-eigenvector calculation; RI-based consistency ratios are provided for supported sizes.
- Global hierarchy weights multiply parent and local child weights.
- Distributive synthesis normalizes alternative scores within criteria and may exhibit rank reversal after changing the alternative set.
- Relative performance scores are higher-is-better utilities: raw costs are **not** automatically inverted.
- Pareto objectives are separate measurable quantities with minimize/maximize directions.
- Rankings show fit under user-supplied judgments, **not** a probability of success or a guaranteed outcome.

## Local checks

Run from the repository root with Node.js:

```bash
node --test tests.mjs phase3-tests.mjs phase4-tests.mjs phase5-tests.mjs
node --check ahp-engine.mjs
```

Historical verification and known limitations are documented in `FINAL-AUDIT.md`, `UX-REVIEW.md` and the phase-specific reports. Those files reflect their audit dates, rather than the current version.

## Release status and open validation

The numerical engine has a history of automated tests, but **production readiness is not certified**. Hosted end-to-end testing remains important for Safari, Chrome and Firefox (including mobile), keyboard and screen-reader accessibility, storage/import/export continuity, hierarchy guided comparisons, and generated reports. Changes to the current UI should be independently tested in a real browser before relying on it for consequential decisions.

## Interface updates

**v1.6.0 (19 October 2026)** — Centralized visual styles into `design-system.css`, normalized shared text/control/spacing tokens, and added guided parent and child comparisons to two-level hierarchy weighting. Updated documentation to the current workflow.

**v1.5.0** — Five-stage workflow with separated Results and Advanced Analytics, matrix and guided comparison features, sensitivity controls, fixed-scale scoring option, local projects and reporting.
