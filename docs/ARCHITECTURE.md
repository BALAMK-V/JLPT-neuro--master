# Architecture

## Backend (`backend/`)

- `jlpt_neuro_master/` — project settings, root URLs, ASGI/WSGI
- `apps/import_utils.py` — shared `parse_import_file()` handling CSV / JSON / XLSX; used by all content import views
- `apps/users/` — profile, learning type, appearance settings, user management, `seed_demo` command
- `apps/content/` — kanji + examples + vocabulary; CSV/JSON/XLSX import via `parse_import_file`
- `apps/grammar/` — grammar questions; CSV/JSON/XLSX import; AI grammar check
- `apps/listening/` — listening questions + ZIP audio import; CSV/JSON/XLSX import
- `apps/reading/` — reading passages + comprehension questions; CSV/JSON/XLSX import
- `apps/flashcards/` — SRS engine (SM-2, FSRS-4.5), deck management, `ImportLog` model, flashcard import
- `apps/assessment/` — tests + test questions
- `apps/jlpt_exam/` — full JLPT exam simulation (sections, timers, scoring)
- `apps/ocr/` — question paper upload, AI parse, import pipeline
- `apps/neuro/` — learning-style questionnaire + profile derivation
- `apps/notes/` — quick / context / session notes
- `apps/tracking/` — study sessions, user progress, dashboard aggregation
- `apps/quiz_room/` — multiplayer WebSocket quiz (Django Channels)

### Migrations

All apps have a single `0001_initial.py` (squashed clean slate, v0.4.0).  
No incremental migration files remain.

### Import audit

Every successful import call logs an `ImportLog` (in `apps/flashcards/models.py`):
`user, content_type, filename, file_format, rows_imported, rows_skipped, rows_updated, extra, imported_at`

API: `GET /api/flash/import-log/` (last 100), `DELETE /api/flash/import-log/<id>/`

---

## Frontend (`frontend/`)

- `src/app/api/` — `client.ts` (JWT Bearer fetch with auto-refresh on 401), `form.ts` (multipart helper)
- `src/app/state/` — `route.ts` (hash router + `managementOnly` flag), `user.tsx`, `appearance.tsx`
- `src/app/theme/` — `neuro.ts` (CSS variable injection per learning style)
- `src/app/learningStyle.ts` — session card limits, study cues per learning alias
- `src/components/SideMenu.tsx` — collapsible nav groups with chevron toggle
- `src/components/imports/` — `CsvEditor`, `validators.ts`, `ValidationSummary`, `csv.ts`
- `src/components/ui/` — shared primitives: Badge, Divider, EmptyState, FormField, Modal, Notice, SectionHeader, Stack, Text
- `src/pages/` — one file per route
- `src/styles/global.css` — single stylesheet, BEM-like prefixes

### Sidebar navigation groups

Collapsible; active route's group starts expanded; management group hidden from non-staff.

| Group | Routes |
|-------|--------|
| Dashboard | dashboard |
| Study | kanji, vocab, grammar, listening, reading |
| Practice | flashcards, tests, jlptExam |
| AI Tools | aiExamGen, grammarCheck, speakingMode, sentenceMining |
| Social | multiplayerQuiz |
| Notebook | notes, sessions |
| Settings | profile, neuroAnalysis, appearance |
| Management *(staff only)* | imports, paperUpload, userManagement |

### Flashcard review UI

- `.fc-anki-card` — `transform-style: preserve-3d`, explicit `height: 320px`
- `.fc-anki-front` / `.fc-anki-back` — direct children, `backface-visibility: hidden`; back pre-rotated `rotateY(180deg)`
- On flip: parent rotates 180° → back returns to 0°, front hides
- Session limit state in `FlashcardsPage` (default from `getLearningStylePlan`), passed to `ReviewView`

---

## Auth

- JWT: access 2h, refresh 30d (`SIMPLE_JWT` in `settings.py`)
- Tokens stored in `localStorage`; auto-refreshed by `api()` client on 401
- Only `docker compose down -v` (volume wipe) invalidates existing tokens

---

## Learning-style behavior

- `profile.learning_type` drives UI mode via CSS variable injection
- **Calm Structure** — `reduce-motion` class disables transitions/animations
- **Focus Support** — short sessions (10–15 min), always-visible progress, quick resume
- **Balanced** — standard 25-min sessions

---

## Demo accounts (`seed_demo` command)

| Username | `is_staff` | `is_superuser` |
|----------|-----------|----------------|
| `admin`  | ✓ | ✓ |
| `bala`   | ✓ | ✗ |
| `demo`   | ✗ | ✗ |

All passwords: `Test@123`. Command is idempotent.
