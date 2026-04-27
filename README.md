# JLPT Neuro Master

![Version](https://img.shields.io/badge/version-0.2.0-blue)
![License](https://img.shields.io/badge/license-MIT-blue)
![Platform](https://img.shields.io/badge/platform-Docker-green)
![Stack](https://img.shields.io/badge/stack-Django--React-red)

**Smart JLPT Japanese Learning System (N5–N1)**

A full-stack, spaced-repetition-based study platform for mastering Japanese: kanji, vocabulary, listening, reading comprehension, and grammar. Features AI-driven personalization, three learning-style modes (Balanced / Focus Support / Calm Structure), progress tracking, and CSV-based content import/export.

---

## Features

- **Spaced Repetition** - Adaptive review scheduling based on performance
- **Progress Tracking** - Session analytics and mastery dashboards
- **Multi-Format Imports** - CSV/ZIP import for kanji, vocab, listening, reading, grammar
- **Admin Panel** - One-click exports and imports
- **Learning Modes** - Three UI modes adapting to cognitive preferences:
  - **Balanced** - Standard study rhythm
  - **Focus Support** - Short sessions with quick resume
  - **Calm Structure** - Reduced motion, minimalist UI
- **Quick Notes** - Context, session, and freeform notes

---

## Tech Stack

| Layer    | Technology                     |
|----------|-------------------------------|
| Backend  | Django + Django REST Framework |
| Database | PostgreSQL                    |
| Frontend | React (Vite)                  |
| Deploy   | Docker Compose                |

---

## Quick Start

```bash
docker compose up --build
```

| Service  | URL                            |
|----------|-------------------------------|
| UI       | http://127.0.0.1:5173/         |
| API      | http://127.0.0.1:8000/api/    |
| Admin    | http://127.0.0.1:8000/admin/  |

**Default Credentials:**
- Admin: `admin` / `Test@123`
- Demo: `demo` / `Test@123`

---

## Monorepo Layout

```
backend/            Django + Django REST Framework + PostgreSQL
frontend/           React (Vite) UI
docs/
docker-compose.yml  Container orchestration
```

---

## Content Modules

| Module       | Description                          |
|--------------|--------------------------------------|
| Kanji        | Characters with readings and examples |
| Vocabulary   | Word lists with definitions           |
| Listening    | Audio-based comprehension questions  |
| Reading      | Passage-based comprehension           |
| Grammar      | Sentence and text grammar questions |

---

## License

MIT License