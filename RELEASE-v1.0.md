# Making AHP Decisions — interface refresh

Updated branding to "A project developed by Justin Lim" and simplified the tagline. Reorganised the crowded toolbar into a grouped Project workspace, positioned local-save status at top right, improved field/focus spacing, introduced Load sample data and New / clear project, and provided confirmation before either replaces current work.

The sample illustrates a facilities management partner selection with four fictional suppliers, four weighted criteria and three independent trade-off objectives. The scores are illustrative performance ratings (not monetary cost figures); actual annual cost is represented separately as a minimisation objective. The sample appears as explicitly labelled fictional data.

A new installation opens with a blank working project, while existing saved projects are retained. The clear function creates an empty starter structure with valid IDs, removes weights and entered scores, and keeps the app operable. JSON project exports are recommended before destructive changes. Clear does not delete older project-library snapshots.

## Deployment
Upload index.html, all .mjs runtime modules (ahp-engine.mjs, project-validation.mjs, hierarchy.mjs, reporting.mjs, xlsx-export.mjs, advanced-analytics.mjs) to the root of the same GitHub Pages repository. Hard refresh after deployment.

## Verification
Static inspection of the public v0.9 website; JavaScript syntax validation; pre-existing automated core, Phase 3–5 suites. Manual live-browser visual, Safari/mobile, reload/persistence and complete end-to-end acceptance testing remain necessary. The public site was not edited directly, only the attached replacement build.
