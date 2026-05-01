# JLPT Neuro Master — Claude Code Guide

## Project Overview

Full-stack JLPT Japanese study platform.  
**Backend**: Django 4 + Django REST Framework + SimpleJWT  
**Frontend**: React 18 + Vite + TypeScript (no external component library)  
**Database**: PostgreSQL (Docker) / SQLite (local dev)  
**Auth**: JWT stored in `localStorage` (`access_token`, `refresh_token`)

---

## Running Locally

```bash
# Docker (full stack)
docker compose up --build

# Backend only (SQLite dev mode)
cd backend
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_demo          # creates admin/demo accounts
python manage.py runserver

# Frontend only
cd frontend
npm install
npm run dev
```

| Service | URL |
|---------|-----|
| UI      | http://127.0.0.1:5173/ |
| API     | http://127.0.0.1:8000/api/ |
| Admin   | http://127.0.0.1:8000/admin/ |

**Demo accounts** (both password `Test@123`):
- `admin` — management user (`is_staff=True`), sees all features
- `demo` — regular user (`is_staff=False`), sees learning features only

---

## User Roles

The app has two roles, determined by Django's built-in `is_staff` flag:

| Role | `is_staff` | What they see |
|------|-----------|---------------|
| **User** | `false` | All learning features (flashcards, kanji, vocab, listening, reading, grammar, tests, AI tools, notes, sessions, profile, appearance) |
| **Management** | `true` | All user features + **Imports**, **Upload Paper**, **User Management** |

- The frontend exposes `me.is_staff` from `GET /api/auth/me/`.
- Management routes are filtered out of the sidebar for regular users.
- Backend import endpoints (kanji, vocab, grammar, reading, listening, flashcard CSV, all OCR endpoints) enforce `IsManagementUser` from `apps/users/permissions.py`.

---

## Architecture

### Backend apps

```
apps/
  assessment/     Test management
  content/        Kanji, Vocabulary, Reading passages
  flashcards/     Deck + card SRS (SM-2 and FSRS-4.5)
  grammar/        Grammar questions + AI check
  jlpt_exam/      Full JLPT exam simulation
  listening/      Audio comprehension + ZIP audio import
  neuro/          Learning-style assessment
  notes/          Quick / context / session notes
  ocr/            Question paper OCR + AI parse + import
  quiz_room/      Multiplayer WebSocket quiz
  reading/        Reading comprehension
  tracking/       Sessions, progress, dashboard
  users/          Auth, profiles, appearance, user management
```

### Key user app files

| File | Purpose |
|------|---------|
| `users/permissions.py` | `IsManagementUser` permission class (used by all import views) |
| `users/serializers.py` | `MeSerializer` — exposes `is_staff` (read-only) |
| `users/views.py` | `MeView`, `RegisterView`, `ChangePasswordView`, `ForgotPasswordView`, `ResetPasswordView`, `UserManagementListView`, `UserManagementDetailView` |
| `users/auth_urls.py` | All auth + user management URL patterns under `/api/auth/` |

### User management API

| Method | URL | Auth | Description |
|--------|-----|------|-------------|
| GET | `/api/auth/users/` | Management | List all users |
| POST | `/api/auth/users/` | Management | Create user (can set `is_staff`) |
| PATCH | `/api/auth/users/<id>/` | Management | Update role / active / password |
| DELETE | `/api/auth/users/<id>/` | Management | Delete user |

### Frontend structure

```
src/
  app/
    api/          client.ts (JWT fetch wrapper), form.ts (multipart)
    state/        route.ts (hash routing + managementOnly flag), user.tsx, appearance.tsx
    theme/        neuro.ts (CSS var injection per learning style)
    labels.ts     learning style labels and aliases
    learningStyle.ts  session/reminder/question count plans
  components/     Shared: PageHeader, SideMenu, QuickNoteButton, FocusAudioWidget, CompanionWidget, imports/*
  pages/          One file per route
  styles/         global.css (single stylesheet, BEM-like naming)
  types.ts        All TypeScript types
```

### Routing

Hash-based (`/#flashcards`, `/#kanji`, etc.) with two path exceptions:
- `/neuro-analysis` → `neuroAnalysis` route
- `/settings/appearance` → `appearance` route

Routes marked `managementOnly: true` in `route.ts` are filtered from the sidebar for non-staff users.

---

## CSS Conventions

Single stylesheet at `frontend/src/styles/global.css`. Class naming conventions:

| Prefix | Used for |
|--------|---------|
| `.fc-*` | Flashcard review UI |
| `.auth-*` | Auth page (login / register / reset) |
| `.um-*` | User Management page |
| `.deck-*` | Flashcard deck sidebar items |
| `.neuro-*` | Neuro analysis page |
| `.notice--ok/bad` | Status banners |
| `.btn--primary/danger` | Button variants |
| `.pill` | Inline metadata tags |

---

## Import System

All CSV imports are **management-only** (enforced at both frontend sidebar filter and backend `IsManagementUser` permission).

| Content type | Endpoint | Key CSV headers |
|-------------|----------|----------------|
| Kanji | `POST /api/kanji/import/` | `character, onyomi, kunyomi, meaning_en, jlpt_level` |
| Vocabulary | `POST /api/vocab/import/` | `word, reading, meaning_en, jlpt_level` |
| Grammar | `POST /api/grammar/import/` | `jlpt_level, section, prompt, option_a–d, answer` |
| Reading | `POST /api/reading/import/` | `title, jlpt_level, text_jp, text_en` |
| Listening | `POST /api/listening/import/` | `section, question_type, audio_text, question, option_a–d, answer` |
| Listening audio | `POST /api/listening/audio/import/` | ZIP file of audio files |
| Flashcards | `POST /api/flash/import/` | `front, back, tags, deck_id` |

Frontend validation happens in `frontend/src/components/imports/validators.ts` before upload.  
Max file size: **5 MB** CSV, **50 MB** ZIP (enforced in each import view).

---

## Auth Flow

- **Login**: `POST /api/auth/token/` → stores `access_token` + `refresh_token` in localStorage
- **Register**: `POST /api/auth/register/`
- **Forgot password**: `POST /api/auth/forgot-password/` — returns `dev_token` (uid:token) in dev mode; production should send email
- **Reset password**: `POST /api/auth/reset-password/` with `uid`, `token`, `new_password`
- **Change password**: `POST /api/auth/change-password/` (authenticated)
- **Token refresh**: automatic via `api()` client on 401

---

## Flashcard SRS

Two algorithms available per deck: **SM-2** (default) and **FSRS-4.5**.  
Rating buttons: `Again (1) / Hard (2) / Good (3) / Easy (4)` — keyboard shortcuts active during review.  
Leeches (8+ lapses) shown in a banner with unsuspend option.

---

## Learning Styles

Three modes stored in `profile.learning_type` + `profile.ui_prefs.learning_alias`:

| Alias | Type | Behaviour |
|-------|------|----------|
| `balanced` | balanced | 25-min sessions, standard UI |
| `quick_reset` | focus_support | 10-min sessions, quick reset cues |
| `focus_support` | focus_support | 15-min sessions, focus prompts |
| `calm_structure` | calm_structure | 20-min sessions, reduced motion, low complexity |

CSS variables injected by `applyNeuroUiMode()` in `app/theme/neuro.ts`.
