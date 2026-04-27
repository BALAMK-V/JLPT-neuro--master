# Reading (JLPT-style)

## Patterns supported

`passage_type`:
- `short` (短文)
- `medium` (中文)
- `long` (長文)
- `integrated` (統合理解)
- `info_search` (情報検索)

## Question types

`question_type` (optional):
- `main_idea`
- `detail`
- `inference`
- `purpose`
- `vocab`
- `reference`
- `info_search`
- `other`

## API

- Passages: `GET /api/reading/passages/`
- Questions: `GET /api/reading/questions/`
- Import CSV: `POST /api/reading/import/` (multipart: `csv_file`)

## Admin

- Admin -> Reading -> Reading passages -> Import Reading (CSV)

## CSV format (single file)

Headers:

- `passage_title` (required)
- `passage_type` (required)
- `jlpt_level` (required, N5..N1)
- `text_jp` (required)
- `text_en` (optional)
- `source` (optional)
- `tags` (optional, `tag1;tag2`)
- `question_type` (optional)
- `question` (required)
- `option_a`..`option_d` (required)
- `answer` (required, A-D)
- `explanation` (optional)
- `order` (optional, integer)

Rows with the same `passage_title + jlpt_level + passage_type` are grouped into one passage.
