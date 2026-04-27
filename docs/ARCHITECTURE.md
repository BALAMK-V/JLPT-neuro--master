# Architecture

## Backend (`backend/`)

- `jlpt_neuro_master/` project settings + root URLs
- `apps/users/` profile + learning type (`balanced`/`focus_support`/`calm_structure`)
- `apps/content/` kanji + examples + vocabulary (CSV import/export via API + admin)
- `apps/listening/` listening questions + CSV/ZIP import (API + admin)
- `apps/assessment/` tests + test questions
- `apps/notes/` quick/context/session notes
- `apps/tracking/` progress (spaced repetition) + sessions + dashboard aggregate

## Frontend (`frontend/`)

- `src/app/` app shell, API client, user state, learning-style UI mode, hash routing
- `src/components/` reusable UI blocks (QuickNote, ProgressBar, cards, CSV editor)
- `src/pages/` screens (dashboard + imports + module pages)

## Learning-style behavior hooks

- Profile field `learning_type` drives UI mode.
- Calm Structure mode: `reduce-motion` class disables transitions/animations.
- Focus Support mode: prioritizes short sessions + always-visible progress + quick resume.
