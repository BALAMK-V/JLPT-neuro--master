# Import Samples

These are example CSV formats for importing data.

## API endpoints

- Kanji CSV import: `POST /api/kanji/import/` (multipart field: `csv_file`)
- Vocabulary CSV import: `POST /api/vocab/import/` (multipart field: `csv_file`)
- Listening CSV+ZIP import: `POST /api/listening/import/` (multipart fields: `csv_file`, optional `audio_zip`)
- Audio ZIP-only import (returns filename list): `POST /api/listening/audio/import/` (multipart field: `audio_zip`)
- Reading CSV import: `POST /api/reading/import/` (multipart field: `csv_file`)
- Grammar CSV import: `POST /api/grammar/import/` (multipart field: `csv_file`)

## Listening (sections) sample

- CSV: `docs/imports/listening_n2_sections_import_sample.csv`
- ZIP (playable WAV tones): `docs/imports/listening_n2_audio_sample.zip`
- New CSV columns supported: `section`, `question_type`, `audio_text`

### Listening audio notes

- Audio is linked when you import with `audio_zip`, or if you previously uploaded the ZIP via `/api/listening/audio/import/` and the CSV `audio_file` matches an existing stored file.
- If your ZIP contains folders, the importer matches by basename (e.g. `audio/n2_kadai_01.wav` can be referenced as `n2_kadai_01.wav`).

## Reading / Grammar docs

- Reading: `docs/imports/reading_import.md`
- Grammar: `docs/imports/grammar_import.md`
- Flashcards: `docs/imports/flashcards_import.md`
