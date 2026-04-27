# Flashcards (Anki-like)

You can create user decks and cards, then review with the buttons:
`Again` / `Hard` / `Good` / `Easy`.

## API

- Decks: `GET /api/flash/decks/`
- Cards: `GET /api/flash/cards/`
- Due queue: `GET /api/flash/next/?deck_id=<id>`
- Apply review: `POST /api/flash/review/` JSON: `{ "card_id": 123, "rating": "good" }`
- Import CSV: `POST /api/flash/import/` (multipart: `csv_file`, plus optional `deck_id`)

## CSV format

Headers (case-insensitive):

- `front` (recommended)
- `back` (recommended)
- `tags` (optional; `tag1;tag2`)
- `kanji_character` (optional; links existing Kanji if found)
- `vocab_word` (optional; links existing Vocabulary if found)
- `vocab_reading` (optional; helps match vocab)

Rules:
- If `front`/`back` are present, they are used as-is.
- If `front`/`back` are empty but you provide `kanji_character` or `vocab_word`, the importer auto-builds `front/back` from your existing Kanji/Vocab data.

