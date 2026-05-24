/**
 * Client-side security utilities.
 *
 * Provides helpers for sanitising untrusted content before it is inserted
 * into the DOM, and for validating URLs to prevent injection attacks.
 *
 * Why not DOMPurify?
 * ------------------
 * This project avoids external runtime dependencies where a first-party
 * solution is sufficient.  The sanitisation here is *allowlist*-based:
 * only explicitly permitted tags and attributes survive.  If richer HTML
 * (tables, code blocks, formatting) is needed in the future, swap the
 * `sanitizeHtml` implementation for DOMPurify.
 */

// ── HTML sanitisation ─────────────────────────────────────────────────────────

/** Tags that are safe to preserve in user-supplied HTML content. */
const ALLOWED_TAGS = new Set([
  "b", "strong", "i", "em", "u", "s", "del",
  "br", "p", "span", "ruby", "rt", "rp",
]);

/** Attributes allowed on permitted tags (no event handlers, no src on arbitrary tags). */
const ALLOWED_ATTRS = new Set(["class", "lang", "dir"]);

/**
 * Strip all HTML tags and attributes that are not on the allowlist.
 *
 * This uses the browser's own HTML parser (`DOMParser`) so the input is
 * always parsed consistently regardless of how malformed it might be.
 * Script elements, `on*` event handlers, `javascript:` hrefs, and any
 * tag not in `ALLOWED_TAGS` are removed entirely.
 *
 * @param html Untrusted HTML string from the server or user input.
 * @returns    Safe HTML string suitable for `dangerouslySetInnerHTML`.
 *
 * @example
 * ```ts
 * // In a React component:
 * <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(card.back) }} />
 * ```
 */
export function sanitizeHtml(html: string): string {
  if (!html) return "";

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  function cleanNode(node: Node): Node | null {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.cloneNode(false);
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return null; // Remove comments, processing instructions, etc.
    }

    const el = node as Element;
    const tagName = el.tagName.toLowerCase();

    if (!ALLOWED_TAGS.has(tagName)) {
      // Replace disallowed tag with its text content (unwrap, don't delete).
      const fragment = document.createDocumentFragment();
      for (const child of Array.from(el.childNodes)) {
        const cleaned = cleanNode(child);
        if (cleaned) fragment.appendChild(cleaned);
      }
      return fragment;
    }

    const cleaned = document.createElement(tagName);

    for (const attr of Array.from(el.attributes)) {
      if (ALLOWED_ATTRS.has(attr.name.toLowerCase())) {
        cleaned.setAttribute(attr.name, attr.value);
      }
    }

    for (const child of Array.from(el.childNodes)) {
      const cleanedChild = cleanNode(child);
      if (cleanedChild) cleaned.appendChild(cleanedChild);
    }

    return cleaned;
  }

  const output = document.createElement("div");
  for (const child of Array.from(doc.body.childNodes)) {
    const cleaned = cleanNode(child);
    if (cleaned) output.appendChild(cleaned);
  }

  return output.innerHTML;
}

/**
 * Escape all HTML special characters in a plain-text string.
 *
 * Use this when you need to embed a raw text value inside HTML markup
 * without treating it as HTML.
 *
 * @param text Plain-text string that may contain `<`, `>`, `&`, etc.
 * @returns    HTML-escaped string safe to inject into HTML contexts.
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ── URL validation ────────────────────────────────────────────────────────────

/** Protocols considered safe for `src` and `href` attributes. */
const SAFE_PROTOCOLS = new Set(["https:", "http:", "data:", "blob:"]);

/**
 * Validate that a URL uses a safe protocol (not `javascript:`, `vbscript:`, etc.).
 *
 * @param url Candidate URL string.
 * @returns   The original URL if safe, or an empty string if potentially malicious.
 *
 * @example
 * ```tsx
 * <img src={safeUrl(card.image)} alt="" />
 * <audio src={safeUrl(card.audio)} />
 * ```
 */
export function safeUrl(url: string | null | undefined): string {
  if (!url) return "";
  try {
    const parsed = new URL(url, window.location.href);
    return SAFE_PROTOCOLS.has(parsed.protocol) ? url : "";
  } catch {
    // Relative URLs without a protocol are safe.
    return url.startsWith("/") || url.startsWith("./") || url.startsWith("../")
      ? url
      : "";
  }
}

// ── Input sanitisation ────────────────────────────────────────────────────────

/**
 * Trim whitespace and remove null bytes from a user-supplied string.
 *
 * Null bytes (`\0`) can bypass some server-side validators and should be
 * stripped before the value is sent to the API.
 *
 * @param value Raw string from a form input.
 * @returns     Cleaned string.
 */
export function sanitizeInput(value: string): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/\0/g, "").trim();
}

/**
 * Return true when the string is a plausible email address.
 * This is a lightweight structural check, not RFC 5322 compliance.
 *
 * @param email Candidate email string.
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
