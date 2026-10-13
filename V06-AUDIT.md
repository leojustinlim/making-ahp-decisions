# Making AHP Decisions v0.6 — audit and release notes

## Changes
- Separated *Results* (overall rankings and interpretation) from *Advanced analytics* (sensitivity controls, scenario comparisons, ranking robustness and Pareto analysis).
- Added a prominent inline manual-weight validation message. The mathematical engine continues to strictly reject negative/non-finite weights and totals different from 100%, rather than silently normalising incorrect percentages. Hierarchical manual weights are checked separately at each sibling level.
- Added guidance about browser-only autosave, JSON file portability, plaintext sensitivity, absence of cloud synchronisation, and exporting frequent backups. The project library repeats the warning.
- Replaced legacy Excel 2003 XML with offline native `.xlsx` generation based on OOXML zipped sheets. Includes rankings, criteria, contributions, consistency diagnostics, measurable objectives, Pareto classification, scenarios and methodology.

## Privacy statement scope
A source scan of application HTML/JS found no fetch, WebSocket, XMLHttpRequest, beacon, or remote script URLs. The version supplied runs the decision calculations and saves projects in local browser storage and does not contain a project-data backend. This is not a guarantee about logs held by whatever hosting provider is chosen. JSON backups are unencrypted plaintext. Public deployment should review hosting, privacy policy, cookies and security headers.

## Checks run
- Node syntax check of application module and exporter.
- Existing mathematical and regression suites (core, Phase 3, Phase 4 and Phase 5) passed.
- Generated actual `.xlsx` test file from synthetic report; Python zipfile CRC verification and XML parsing of all parts succeeded.

## Outstanding validation
- End-to-end tests in normal hosted Chrome/Safari/Firefox on desktop and mobile.
- Test `.xlsx` user experience in desktop Excel and LibreOffice, including opened file warning behaviour, and refine formatting.
- Storage persistence/eviction under real browser sessions; offline/file-hosted restrictions.
- Accessibility tests using keyboard and screen readers.

## Important limitations
The downloadable XLSX is a structured analysis export, not a living AHP spreadsheet with editable formulas. PDF is still a printable HTML report. Weight/score changes may change rankings, and Pareto status is determined by the provided measurable objectives.
