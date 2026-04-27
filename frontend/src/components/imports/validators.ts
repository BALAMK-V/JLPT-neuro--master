export type ValidationError = { rowIndex: number; field?: string; message: string };

function normHeaders(headers: string[]) {
  return new Set(headers.map((h) => h.trim().toLowerCase()));
}

export function validateRequiredHeaders(headers: string[], required: string[]): string[] {
  const have = normHeaders(headers);
  return required.filter((r) => !have.has(r.toLowerCase()));
}

export function validateKanji(headers: string[], rows: Array<Record<string, string>>): ValidationError[] {
  const errors: ValidationError[] = [];
  const required = ["character", "meaning_en"];
  const missing = validateRequiredHeaders(headers, required);
  if (missing.length) return [{ rowIndex: -1, message: `Missing headers: ${missing.join(", ")}` }];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const ch = (r["character"] ?? "").trim();
    if (!ch || ch.length !== 1) errors.push({ rowIndex: i, field: "character", message: "character must be exactly 1 kanji." });
    if (!(r["meaning_en"] ?? "").trim()) errors.push({ rowIndex: i, field: "meaning_en", message: "meaning_en is required." });

    const lvl = (r["jlpt_level"] ?? "").trim();
    if (lvl && !["N5", "N4", "N3", "N2", "N1"].includes(lvl)) {
      errors.push({ rowIndex: i, field: "jlpt_level", message: "jlpt_level must be N5..N1." });
    }
  }

  return errors;
}

export function validateVocab(headers: string[], rows: Array<Record<string, string>>): ValidationError[] {
  const errors: ValidationError[] = [];
  const required = ["word", "meaning_en"];
  const missing = validateRequiredHeaders(headers, required);
  if (missing.length) return [{ rowIndex: -1, message: `Missing headers: ${missing.join(", ")}` }];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!(r["word"] ?? "").trim()) errors.push({ rowIndex: i, field: "word", message: "word is required." });
    if (!(r["meaning_en"] ?? "").trim()) errors.push({ rowIndex: i, field: "meaning_en", message: "meaning_en is required." });

    const lvl = (r["jlpt_level"] ?? "").trim();
    if (lvl && !["N5", "N4", "N3", "N2", "N1"].includes(lvl)) {
      errors.push({ rowIndex: i, field: "jlpt_level", message: "jlpt_level must be N5..N1." });
    }
  }

  return errors;
}

export function validateListening(headers: string[], rows: Array<Record<string, string>>): ValidationError[] {
  const required = ["audio_file", "question", "option_a", "option_b", "option_c", "option_d", "answer"];
  const missing = validateRequiredHeaders(headers, required);
  if (missing.length) return [{ rowIndex: -1, message: `Missing headers: ${missing.join(", ")}` }];

  const errors: ValidationError[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    for (const f of required) {
      if (!(r[f] ?? "").trim()) errors.push({ rowIndex: i, field: f, message: `${f} is required.` });
    }

    const ans = (r["answer"] ?? "").trim().toUpperCase();
    if (ans && !["A", "B", "C", "D"].includes(ans)) errors.push({ rowIndex: i, field: "answer", message: "answer must be A-D." });

    const section = (r["section"] ?? "").trim();
    if (section && !["kadai", "point", "gaiyo", "sokuji", "togo", "other"].includes(section)) {
      errors.push({ rowIndex: i, field: "section", message: "section must be kadai/point/gaiyo/sokuji/togo/other." });
    }

    const qtype = (r["question_type"] ?? "").trim();
    if (qtype && !["gist", "detail", "inference", "purpose", "response", "other"].includes(qtype)) {
      errors.push({ rowIndex: i, field: "question_type", message: "question_type must be gist/detail/inference/purpose/response/other." });
    }

    const lvl = (r["jlpt_level"] ?? "").trim();
    if (lvl && !["N5", "N4", "N3", "N2", "N1"].includes(lvl)) {
      errors.push({ rowIndex: i, field: "jlpt_level", message: "jlpt_level must be N5..N1." });
    }
  }

  return errors;
}

export function validateReading(headers: string[], rows: Array<Record<string, string>>): ValidationError[] {
  const required = [
    "passage_title",
    "passage_type",
    "jlpt_level",
    "text_jp",
    "question",
    "option_a",
    "option_b",
    "option_c",
    "option_d",
    "answer",
  ];
  const missing = validateRequiredHeaders(headers, required);
  if (missing.length) return [{ rowIndex: -1, message: `Missing headers: ${missing.join(", ")}` }];

  const errors: ValidationError[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];

    const ptype = (r["passage_type"] ?? "").trim();
    if (ptype && !["short", "medium", "long", "integrated", "info_search"].includes(ptype)) {
      errors.push({ rowIndex: i, field: "passage_type", message: "passage_type must be short/medium/long/integrated/info_search." });
    }

    const qtype = (r["question_type"] ?? "").trim();
    if (
      qtype &&
      !["main_idea", "detail", "inference", "purpose", "vocab", "reference", "info_search", "other"].includes(qtype)
    ) {
      errors.push({ rowIndex: i, field: "question_type", message: "question_type is invalid." });
    }

    const ans = (r["answer"] ?? "").trim().toUpperCase();
    if (ans && !["A", "B", "C", "D"].includes(ans)) errors.push({ rowIndex: i, field: "answer", message: "answer must be A-D." });

    const lvl = (r["jlpt_level"] ?? "").trim();
    if (lvl && !["N5", "N4", "N3", "N2", "N1"].includes(lvl)) {
      errors.push({ rowIndex: i, field: "jlpt_level", message: "jlpt_level must be N5..N1." });
    }
  }

  return errors;
}

export function validateGrammar(headers: string[], rows: Array<Record<string, string>>): ValidationError[] {
  const required = ["prompt", "option_a", "option_b", "option_c", "option_d", "answer"];
  const missing = validateRequiredHeaders(headers, required);
  if (missing.length) return [{ rowIndex: -1, message: `Missing headers: ${missing.join(", ")}` }];

  const errors: ValidationError[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];

    const ans = (r["answer"] ?? "").trim().toUpperCase();
    if (ans && !["A", "B", "C", "D"].includes(ans)) errors.push({ rowIndex: i, field: "answer", message: "answer must be A-D." });

    const section = (r["section"] ?? "").trim();
    if (section && !["bunpo_form", "sentence_build", "text_grammar", "other"].includes(section)) {
      errors.push({ rowIndex: i, field: "section", message: "section must be bunpo_form/sentence_build/text_grammar/other." });
    }

    const qtype = (r["question_type"] ?? "").trim();
    if (qtype && !["choose", "fill_blank", "reorder", "error_find", "other"].includes(qtype)) {
      errors.push({ rowIndex: i, field: "question_type", message: "question_type must be choose/fill_blank/reorder/error_find/other." });
    }

    const lvl = (r["jlpt_level"] ?? "").trim();
    if (lvl && !["N5", "N4", "N3", "N2", "N1"].includes(lvl)) {
      errors.push({ rowIndex: i, field: "jlpt_level", message: "jlpt_level must be N5..N1." });
    }
  }

  return errors;
}

export function crossCheckAudioFilenames(rows: Array<Record<string, string>>, uploadedNames: string[]): ValidationError[] {
  if (!uploadedNames.length) return [];
  const have = new Set(uploadedNames.map((n) => n.trim()));
  const errors: ValidationError[] = [];

  for (let i = 0; i < rows.length; i++) {
    const name = (rows[i]["audio_file"] ?? "").trim();
    if (name && !have.has(name)) errors.push({ rowIndex: i, field: "audio_file", message: `audio_file not found in uploaded ZIP: ${name}` });
  }
  return errors;
}
