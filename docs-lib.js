export const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

export const sanitizeHref = (href) => {
  const trimmed = String(href).trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("#")) return trimmed;
  if (trimmed.startsWith("//")) return null;
  if (trimmed.startsWith("/") || trimmed.startsWith("./") || trimmed.startsWith("../")) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^mailto:/i.test(trimmed)) return trimmed;
  return null;
};

export const stripInlineMarkdown = (text) =>
  String(text)
    .replaceAll(/`([^`]+)`/g, "$1")
    .replaceAll(/\*\*([^*]+)\*\*/g, "$1")
    .replaceAll(/\*([^*]+)\*/g, "$1")
    .replaceAll(/\[([^\]]+)\]\([^)]+\)/g, "$1");

export const slugify = (text) =>
  stripInlineMarkdown(text)
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9\s-]/g, "")
    .replaceAll(/\s+/g, "-")
    .replaceAll(/-+/g, "-");

export const parseInline = (text) => {
  const renderStrong = (value) => {
    const input = String(value ?? "");
    const out = [];
    let lastIndex = 0;
    for (const match of input.matchAll(/\*\*([^*]+)\*\*/g)) {
      out.push(escapeHtml(input.slice(lastIndex, match.index)));
      out.push(`<strong>${escapeHtml(match[1])}</strong>`);
      lastIndex = match.index + match[0].length;
    }
    out.push(escapeHtml(input.slice(lastIndex)));
    return out.join("");
  };

  const renderLinksAndStrong = (value) => {
    const input = String(value ?? "");
    const out = [];
    let lastIndex = 0;
    for (const match of input.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)) {
      out.push(renderStrong(input.slice(lastIndex, match.index)));
      const label = match[1];
      const href = match[2];
      const safeHref = sanitizeHref(href);
      if (!safeHref) {
        out.push(renderStrong(label));
      } else {
        const rel = /^https?:\/\//i.test(safeHref) ? ' rel="noreferrer noopener"' : "";
        const target = /^https?:\/\//i.test(safeHref) ? ' target="_blank"' : "";
        out.push(`<a href="${escapeHtml(safeHref)}"${rel}${target}>${renderStrong(label)}</a>`);
      }
      lastIndex = match.index + match[0].length;
    }
    out.push(renderStrong(input.slice(lastIndex)));
    return out.join("");
  };

  const input = String(text ?? "");
  const out = [];
  let lastIndex = 0;
  for (const match of input.matchAll(/`([^`]+)`/g)) {
    out.push(renderLinksAndStrong(input.slice(lastIndex, match.index)));
    out.push(`<code>${escapeHtml(match[1])}</code>`);
    lastIndex = match.index + match[0].length;
  }
  out.push(renderLinksAndStrong(input.slice(lastIndex)));
  return out.join("");
};

export const parseMarkdown = (markdown) => {
  const lines = String(markdown ?? "").replaceAll("\r\n", "\n").split("\n");
  const parts = [];
  const toc = [];

  const slugCounts = new Map();
  const uniqueSlug = (base) => {
    const key = base || "section";
    const next = (slugCounts.get(key) ?? 0) + 1;
    slugCounts.set(key, next);
    return next === 1 ? key : `${key}-${next}`;
  };

  let i = 0;
  let inCode = false;
  let codeLang = "";
  let codeLines = [];

  const flushParagraph = (buffer) => {
    const paragraph = buffer.join(" ").trim();
    if (!paragraph) return;
    parts.push(`<p>${parseInline(paragraph)}</p>`);
  };

  const isHr = (line) => /^-{3,}\s*$/.test(line.trim());
  const isCodeFence = (line) => line.trim().startsWith("```");
  const headingMatch = (line) => line.match(/^(#{1,6})\s+(.*)$/);
  const ulMatch = (line) => line.match(/^\s*[-*+]\s+(.*)$/);
  const olMatch = (line) => line.match(/^\s*(\d+)[.)]\s+(.*)$/);
  const quoteMatch = (line) => line.match(/^\s*>\s?(.*)$/);

  while (i < lines.length) {
    const line = lines[i];

    if (inCode) {
      if (line.trim() === "```") {
        const languageClass = codeLang ? ` class="language-${escapeHtml(codeLang)}"` : "";
        parts.push(`<pre><code${languageClass}>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
        inCode = false;
        codeLang = "";
        codeLines = [];
        i += 1;
        continue;
      }

      codeLines.push(line);
      i += 1;
      continue;
    }

    if (isCodeFence(line)) {
      const fenceLine = line.trim();
      codeLang = fenceLine.slice(3).trim();
      inCode = true;
      codeLines = [];
      i += 1;
      continue;
    }

    if (!line.trim()) {
      i += 1;
      continue;
    }

    if (isHr(line)) {
      parts.push("<hr />");
      i += 1;
      continue;
    }

    const h = headingMatch(line);
    if (h) {
      const level = h[1].length;
      const raw = h[2].trim();
      const id = uniqueSlug(slugify(raw));
      const text = stripInlineMarkdown(raw).trim() || raw;
      toc.push({ level, text, id });
      parts.push(`<h${level} id="${escapeHtml(id)}">${parseInline(raw)}</h${level}>`);
      i += 1;
      continue;
    }

    const quote = quoteMatch(line);
    if (quote) {
      const buffer = [];
      while (i < lines.length) {
        const q = quoteMatch(lines[i]);
        if (!q) break;
        buffer.push(q[1]);
        i += 1;
      }
      const text = buffer.join(" ").trim();
      parts.push(`<blockquote><p>${parseInline(text)}</p></blockquote>`);
      continue;
    }

    const ul = ulMatch(line);
    const ol = olMatch(line);
    if (ul || ol) {
      const listTag = ol ? "ol" : "ul";
      const items = [];
      while (i < lines.length) {
        const nextLine = lines[i];
        const ulNext = ulMatch(nextLine);
        const olNext = olMatch(nextLine);
        if (listTag === "ul" && ulNext) {
          items.push(ulNext[1]);
          i += 1;
          continue;
        }
        if (listTag === "ol" && olNext) {
          items.push(olNext[2]);
          i += 1;
          continue;
        }
        break;
      }
      parts.push(`<${listTag}>${items.map((item) => `<li>${parseInline(item.trim())}</li>`).join("")}</${listTag}>`);
      continue;
    }

    const paragraphBuffer = [];
    while (i < lines.length) {
      const l = lines[i];
      if (!l.trim()) break;
      if (isHr(l) || isCodeFence(l) || headingMatch(l) || ulMatch(l) || olMatch(l) || quoteMatch(l)) break;
      paragraphBuffer.push(l.trim());
      i += 1;
    }
    flushParagraph(paragraphBuffer);
  }

  if (inCode) {
    const languageClass = codeLang ? ` class="language-${escapeHtml(codeLang)}"` : "";
    parts.push(`<pre><code${languageClass}>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
  }

  return { html: parts.join("\n"), toc };
};

