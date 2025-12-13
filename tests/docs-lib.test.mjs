import test from "node:test";
import assert from "node:assert/strict";
import { parseInline, parseMarkdown, sanitizeHref } from "../docs-lib.js";

test("sanitizeHref rejects protocol-relative and javascript/data urls", () => {
  assert.equal(sanitizeHref("//evil.example"), null);
  assert.equal(sanitizeHref("javascript:alert(1)"), null);
  assert.equal(sanitizeHref("data:text/html;base64,AAAA"), null);
});

test("sanitizeHref allows safe local and external urls", () => {
  assert.equal(sanitizeHref("#section"), "#section");
  assert.equal(sanitizeHref("./file.md"), "./file.md");
  assert.equal(sanitizeHref("../file.md"), "../file.md");
  assert.equal(sanitizeHref("/docs.html"), "/docs.html");
  assert.equal(sanitizeHref("https://example.com"), "https://example.com");
  assert.equal(sanitizeHref("mailto:test@example.com"), "mailto:test@example.com");
});

test("parseInline escapes raw html and hardens external links", () => {
  const html = parseInline('X <img src=x onerror=alert(1)> [a](https://example.com)');
  assert.ok(html.includes("&lt;img"));
  assert.ok(html.includes('href="https://example.com"'));
  assert.ok(html.includes('rel="noreferrer noopener"'));
  assert.ok(html.includes('target="_blank"'));
});

test("parseMarkdown generates unique heading ids", () => {
  const { toc, html } = parseMarkdown("# Title\n\n## Same\n\n## Same\n");
  const ids = toc.filter((t) => t.level === 2).map((t) => t.id);
  assert.equal(ids.length, 2);
  assert.notEqual(ids[0], ids[1]);
  assert.ok(html.includes(`id="${ids[0]}"`));
  assert.ok(html.includes(`id="${ids[1]}"`));
});

