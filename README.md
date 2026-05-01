# JLPT Neuro Master

![Version](https://img.shields.io/badge/version-0.3.0-blue)
![License](https://img.shields.io/badge/license-MIT-blue)
![Platform](https://img.shields.io/badge/platform-Docker-green)
![Stack](https://img.shields.io/badge/stack-Django--React-red)

**Smart JLPT Japanese Learning System (N5–N1)**

A full-stack, spaced-repetition-based study platform for mastering Japanese: kanji, vocabulary, listening, reading comprehension, and grammar. Features AI-driven personalization, role-based access control, three learning-style modes, flashcard SRS (SM-2 & FSRS), progress tracking, and CSV-based content management.

---

## Features

- **Spaced Repetition** — SM-2 and FSRS-4.5 adaptive scheduling per flashcard deck
- **Progress Tracking** — Session analytics, streak tracking, and mastery dashboards
- **Multi-Format Imports** — CSV/ZIP import for kanji, vocab, listening, reading, grammar, flashcards
- **OCR Question Papers** — Upload and AI-parse printed JLPT papers into question banks
- **Role-Based Access** — Management users control content; regular users focus on studying
- **User Management** — Create, promote, deactivate, and delete user accounts
- **Learning Modes** — Three UI modes adapting to cognitive preferences:
  - **Balanced** — Standard study rhythm
  - **Focus Support** — Short sessions with quick resume cues
  - **Calm Structure** — Reduced motion, minimalist UI
- **AI Features** — Grammar check, exam generation, sentence mining (powered by Claude)
- **Multiplayer Quiz** — Real-time quiz racing over WebSocket
- **Speaking Practice** — Browser speech recognition for vocabulary drills
- **Quick Notes** — Context, session, and freeform notes
- **Anki-style Flashcard UI** — Card flip, keyboard shortcuts (Space/1/2/3/4), color-coded ratings
- **Auth System** — Register, forgot/reset password, change password, JWT-based sessions

---

## Tech Stack

| Layer    | Technology                          |
|----------|-------------------------------------|
| Backend  | Django 4 + Django REST Framework    |
| Auth     | SimpleJWT (access + refresh tokens) |
| Database | PostgreSQL (Docker) / SQLite (dev)  |
| Frontend | React 18 + Vite + TypeScript        |
| Deploy   | Docker Compose                      |

---

## Quick Start

```bash
docker compose up --build
```

| Service | URL                           |
|---------|-------------------------------|
| UI      | http://127.0.0.1:5173/        |
| API     | http://127.0.0.1:8000/api/    |
| Admin   | http://127.0.0.1:8000/admin/  |

**Default credentials** (password `Test@123` for both):

| Account | Role       | Access |
|---------|-----------|--------|
| `admin` | Management | All features including imports, paper upload, user management |
| `demo`  | User       | All learning features (study only) |

---

## User Roles

| Role       | Who | Capabilities |
|-----------|-----|-------------|
| **User** | Students | Flashcard review, kanji, vocab, listening, reading, grammar, AI tools, tests, notes, profile |
| **Management** | Teachers / admins | Everything above + CSV imports, OCR paper upload, user management panel |

Role is controlled by Django's `is_staff` flag. Management users see three extra sidebar sections: **Imports**, **Upload Paper**, and **User Management**.

---

## Monorepo Layout

```
backend/            Django apps + settings + manage.py
  apps/
    content/        Kanji and vocabulary
    flashcards/     SRS engine (SM-2, FSRS)
    grammar/        Grammar questions + AI check
    jlpt_exam/      Full exam simulation
    listening/      Audio comprehension
    neuro/          Learning-style assessment
    notes/          Quick / context / session notes
    ocr/            Question paper OCR + import
    quiz_room/      Multiplayer WebSocket quiz
    reading/        Reading comprehension
    tracking/       Sessions, progress, dashboard
    users/          Auth, profiles, roles, user management
frontend/           React (Vite + TypeScript) SPA
docs/               Additional documentation
docker-compose.yml  Container orchestration
CLAUDE.md           Developer guide for Claude Code
```

---

## Content Modules

| Module    | Import endpoint              | Key fields |
|-----------|------------------------------|------------|
| Kanji     | `POST /api/kanji/import/`    | character, onyomi, kunyomi, meaning_en, jlpt_level |
| Vocabulary| `POST /api/vocab/import/`    | word, reading, meaning_en, jlpt_level |
| Listening | `POST /api/listening/import/`| section, question_type, audio_text, question, option_a–d, answer |
| Reading   | `POST /api/reading/import/`  | title, jlpt_level, text_jp, text_en |
| Grammar   | `POST /api/grammar/import/`  | jlpt_level, section, prompt, option_a–d, answer |
| Flashcards| `POST /api/flash/import/`    | front, back, tags, deck_id |

Max file sizes: **5 MB** CSV, **50 MB** ZIP. All import endpoints require management role.

---

## API Summary

All endpoints are under `/api/`. Authentication uses JWT Bearer tokens.

| Area | Endpoints |
|------|-----------|
| Auth | `/auth/token/`, `/auth/register/`, `/auth/forgot-password/`, `/auth/reset-password/`, `/auth/change-password/`, `/auth/me/` |
| User Management | `/auth/users/` (GET list, POST create), `/auth/users/<id>/` (PATCH, DELETE) |
| Flashcards | `/flash/decks/`, `/flash/cards/`, `/flash/next/`, `/flash/review/`, `/flash/import/` |
| Content | `/kanji/`, `/vocab/`, `/grammar/questions/`, `/listening/questions/`, `/reading/passages/` |
| Exams | `/exams/`, `/exam-sessions/`, `/exam-results/`, `/exams/ai-generate/` |
| OCR | `/ocr/upload/`, `/ocr/papers/`, `/ocr/papers/<id>/ai-parse/`, `/ocr/import/` |
| Progress | `/dashboard/`, `/sessions/`, `/analysis/`, `/neuro/questions/`, `/neuro/submit/` |

---

## License

MIT License
