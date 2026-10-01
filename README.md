# Project Planning & Proposal
Run: `npm install` then `npm start` -> http://localhost:3000   (optional env: PORT, DB_FILE)
Stack: Node + Express, SQLite (planner.db), vanilla JS. Uploads are stored in /uploads.

## Pages
- public/schema.js (Sheet1 headings) + public/checklists.json (Sheet2 headings) drive the 16 form pages.
- **Dashboard** (`#dashboard`): overall/plan/execution progress, 10 proposal-ready checks, budget donut with
  cost-per-beneficiary and salary-share notes, project maturity ladder, and a "What's left" list showing exactly which fields/items are missing.
- **Proposal** (`#proposal`): auto-compiled proposal document. Print / Save as PDF, or download as Word (.doc).
- **Export / Import**: Export downloads project-plan.json; Import restores it (validated, all-or-nothing, replaces matching sections; uploaded files are not included).

## Code layout
- public/app.js: forms, tracker, autosave, uploads. public/insights.js: dashboard, proposal, import.
- public/validate.js is shared by browser AND server so both enforce identical rules.
