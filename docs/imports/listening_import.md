# Listening (JLPT-style)

## Sections

`section` values:
- `kadai` (課題理解)
- `point` (ポイント理解)
- `gaiyo` (概要理解)
- `sokuji` (即時応答)
- `togo` (統合理解)
- `other`

## Question types

`question_type` values:
- `gist` (main idea)
- `detail`
- `inference`
- `purpose`
- `response`
- `other`

## API

- Questions: `GET /api/listening/questions/`
- Import CSV (+ optional ZIP): `POST /api/listening/import/` (multipart: `csv_file`, optional `audio_zip`)
- Audio ZIP-only import: `POST /api/listening/audio/import/` (multipart: `audio_zip`)

## CSV format

Headers:

- `audio_file` (required; should match a filename in your ZIP)
- `section` (optional)
- `question_type` (optional)
- `audio_text` (optional; transcript)
- `question` (required)
- `option_a`..`option_d` (required)
- `answer` (required, A-D)
- `explanation` (optional)
- `jlpt_level` (optional; defaults to N2)

Notes:
- If your ZIP contains folders, the importer matches by basename (e.g. `audio/n2_kadai_01.wav` can be referenced as `n2_kadai_01.wav`).
