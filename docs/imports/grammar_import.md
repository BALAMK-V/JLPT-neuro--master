# Grammar (JLPT-style)

## Sections

`section` values:
- `bunpo_form` (文法形式の判断)
- `sentence_build` (文の組み立て)
- `text_grammar` (文章の文法)
- `other`

## Question types

`question_type` values:
- `choose`
- `fill_blank`
- `reorder`
- `error_find`
- `other`

## API

- Questions: `GET /api/grammar/questions/`
- Import CSV: `POST /api/grammar/import/` (multipart: `csv_file`)

## CSV format

Headers:

- `jlpt_level` (optional; defaults to N2)
- `section` (optional)
- `question_type` (optional)
- `context_text_jp` (optional)
- `prompt` (required)
- `option_a`..`option_d` (required)
- `answer` (required, A-D)
- `explanation` (optional)
- `tags` (optional, `tag1;tag2`)
