# JLPT Neuro Master

![Version](https://img.shields.io/badge/version-0.4.0-blue)
![License](https://img.shields.io/badge/license-MIT-blue)
![Platform](https://img.shields.io/badge/platform-Docker-green)
![Stack](https://img.shields.io/badge/stack-Django--React-red)

**Smart JLPT Japanese Learning System (N5–N1)**

A full-stack, spaced-repetition-based study platform for mastering Japanese: kanji, vocabulary, listening, reading comprehension, and grammar. Features AI-driven personalization, role-based access control, three learning-style modes, Anki-style flashcard SRS (SM-2 & FSRS-4.5), progress tracking, and multi-format content management.

---

## Features

- **Anki-style Flashcards** — 3-D flip card, keyboard shortcuts (Space/1/2/3/4), color-coded ratings, configurable session size, SM-2 and FSRS-4.5 scheduling
- **Progress Tracking** — Session analytics, streak tracking, and mastery dashboards
- **Multi-Format Imports** — CSV / JSON / XLSX upload for kanji, vocab, listening, reading, grammar, and flashcards; import history with audit log
- **OCR Question Papers** — Upload and AI-parse printed JLPT papers into question banks
- **Role-Based Access** — Management users control content; learners focus on studying
- **User Management** — Create, promote, deactivate, and delete user accounts
- **Learning Modes** — Three UI modes adapting to cognitive preferences:
  - **Balanced** — Standard study rhythm
  - **Focus Support** — Short sessions with quick resume cues
  - **Calm Structure** — Reduced motion, minimalist UI
- **AI Features** — Grammar check, exam generation, sentence mining (powered by Claude)
- **Multiplayer Quiz** — Real-time quiz racing over WebSocket
- **Speaking Practice** — Browser speech recognition for vocabulary drills
- **Quick Notes** — Context, session, and freeform notes
- **Collapsible Sidebar** — Grouped navigation (Study / Practice / AI Tools / Social / Notebook / Settings / Management)
- **Auth System** — Register, forgot/reset password, change password, JWT sessions (2h access / 30d refresh)

---

## Tech Stack

| Layer    | Technology                          |
|----------|-------------------------------------|
| Backend  | Django 4 + Django REST Framework    |
| Auth     | SimpleJWT (access 2h / refresh 30d) |
| Database | PostgreSQL (Docker) / SQLite (dev)  |
| Frontend | React 18 + Vite + TypeScript        |
| Deploy   | Docker Compose                      |

---

## Quick Start

```bash
docker compose up --build
```

| Service | URL |
|---------|-----|
| UI      | http://127.0.0.1:5173/ |
| API     | http://127.0.0.1:8000/api/ |
| Admin   | http://127.0.0.1:8000/admin/ |

**Default credentials** (password `Test@123` for all):

| Username | Role | Access |
|----------|------|--------|
| `admin`  | Superuser | Django admin + all management features |
| `bala`   | Management | Imports, user management, all content |
| `demo`   | Learner | All study features only |

---

## Local Dev (no Docker)

```bash
cd backend
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_demo
python manage.py runserver
```

```bash
cd frontend
npm install
npm run dev
```

To wipe and re-seed the local database:

```bash
cd backend
rm db.sqlite3
python manage.py migrate
python manage.py seed_demo
```

---

## User Roles

| Role | `is_staff` | Capabilities |
|------|-----------|-------------|
| **Learner** | `false` | Flashcard review, kanji, vocab, listening, reading, grammar, AI tools, tests, notes, sessions, profile |
| **Management** | `true` | Everything above + CSV/JSON/XLSX imports, import history, OCR paper upload, user management |

Role is controlled by Django's `is_staff` flag. Management users see three extra sidebar sections: **Imports**, **Upload Paper**, and **User Management**.

---

## Monorepo Layout

```
backend/
  apps/
    content/        Kanji and vocabulary
    flashcards/     SRS engine (SM-2, FSRS) + ImportLog
    grammar/        Grammar questions + AI check
    import_utils.py Shared CSV/JSON/XLSX parser
    jlpt_exam/      Full exam simulation
    listening/      Audio comprehension
    neuro/          Learning-style assessment
    notes/          Notes
    ocr/            Question paper OCR + import
    quiz_room/      Multiplayer WebSocket quiz
    reading/        Reading comprehension
    tracking/       Sessions, progress, dashboard
    users/          Auth, profiles, roles, user management
frontend/
  public/templates/ Sample N2-level CSV import files
  src/
    app/            API client, routing, state, theme
    components/     SideMenu, PageHeader, imports/*, ui/*
    pages/          One file per route
    styles/         global.css (single stylesheet)
docs/               Architecture notes
docker-compose.yml
CLAUDE.md           Developer guide for Claude Code
```

---

## Import System

All imports require management role. Accepted formats: **CSV**, **JSON**, **XLSX**.

| Module | Endpoint | Required fields |
|--------|----------|----------------|
| Kanji | `POST /api/kanji/import/` | `character, meaning_en, jlpt_level` |
| Vocabulary | `POST /api/vocab/import/` | `word, reading, meaning_en, jlpt_level` |
| Grammar | `POST /api/grammar/import/` | `prompt, option_a–d, answer` |
| Reading | `POST /api/reading/import/` | `passage_title, passage_type, jlpt_level, text_jp, question, option_a–d, answer` |
| Listening | `POST /api/listening/import/` | `audio_file, question, option_a–d, answer` |
| Flashcards | `POST /api/flash/import/` | `front, back` |

Sample N2-level CSV templates: `frontend/public/templates/`.  
Max sizes: **5 MB** CSV/JSON/XLSX, **50 MB** ZIP audio.

Import history stored in `ImportLog` and viewable at `GET /api/flash/import-log/`.

---

## API Summary

All endpoints under `/api/`. Authentication: `Authorization: Bearer <access_token>`.

| Area | Endpoints |
|------|-----------|
| Auth | `/auth/token/`, `/auth/register/`, `/auth/forgot-password/`, `/auth/reset-password/`, `/auth/change-password/`, `/auth/me/` |
| User Management | `/auth/users/` (GET, POST), `/auth/users/<id>/` (PATCH, DELETE) |
| Flashcards | `/flash/decks/`, `/flash/cards/`, `/flash/next/`, `/flash/review/`, `/flash/import/`, `/flash/import-log/` |
| Content | `/kanji/`, `/vocab/`, `/grammar/questions/`, `/listening/questions/`, `/reading/passages/` |
| Exams | `/exams/`, `/exam-sessions/`, `/exam-results/`, `/exams/ai-generate/` |
| OCR | `/ocr/upload/`, `/ocr/papers/`, `/ocr/papers/<id>/ai-parse/`, `/ocr/import/` |
| Progress | `/dashboard/`, `/sessions/`, `/analysis/`, `/neuro/questions/`, `/neuro/submit/` |

---

## Changelog

### v0.4.0
- Anki-style 3-D flip card with CSS `preserve-3d` / `backface-visibility` (text no longer mirrored)
- Collapsible grouped sidebar navigation (8 sections with icons)
- Multi-format imports: CSV, JSON, XLSX for all content types
- Import history tab with `ImportLog` audit trail and per-entry delete
- Flashcard import: JLPT level + deck type + SRS algo when creating a deck; stats preview on existing deck
- Session limit picker (5–100 cards) on flashcard review
- Three demo accounts: `admin` (superuser), `bala` (management), `demo` (learner)
- JWT: access 2h / refresh 30d
- Squashed migrations — single `0001_initial.py` per app
- N2-level sample data in all import CSV templates

### v0.3.0
- Role-based access control, user management panel
- Auth redesign: forgot/reset password, change password
- Flashcard deck locking, FSRS-4.5 algorithm support
- OCR question paper pipeline

### v0.2.0
- Full JLPT exam simulation
- Multiplayer quiz (WebSocket)
- AI tools: grammar check, exam generation, sentence mining, speaking mode

### v0.1.0
- Initial release: kanji, vocab, listening, reading, grammar, flashcards, notes, tracking

---

## License

MIT License
