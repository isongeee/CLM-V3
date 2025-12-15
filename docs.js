import { escapeHtml, parseMarkdown } from "./docs-lib.js";
import "./landing/app.js";

const PAGES = {
  readme: {
    title: "Overview",
    file: "README_ENTERPRISE_CLM.md",
  },
  context: {
    title: "Design Context",
    file: "CONTEXT_ENTERPRISE_CLM.md",
  },
  database: {
    title: "Database Reference",
    file: "DATABASE_REFERENCE_ENTERPRISE_CLM.md",
  },
};

const contentEl = document.getElementById("content");
const statusEl = document.getElementById("status");
const tocEl = document.getElementById("toc");
const rawLinkEl = document.getElementById("raw-link");
const tabEls = Array.from(document.querySelectorAll("[data-doc]"));

const hasRequiredDom = () => Boolean(contentEl && statusEl && tocEl && rawLinkEl);

const setActiveTab = (key) => {
  tabEls.forEach((tab) => {
    const isActive = tab.getAttribute("data-doc") === key;
    if (isActive) tab.setAttribute("aria-current", "page");
    else tab.removeAttribute("aria-current");
  });
};

const setToc = (toc) => {
  tocEl.innerHTML = "";
  const filtered = toc.filter((item) => item.level >= 2 && item.level <= 4);
  if (!filtered.length) {
    tocEl.innerHTML = `<div class="muted">No headings</div>`;
    return;
  }
  tocEl.innerHTML = filtered
    .map(
      (item) =>
        `<a href="#${escapeHtml(item.id)}" data-level="${item.level}">${escapeHtml(item.text)}</a>`
    )
    .join("");
};

const resolvePageKey = () => {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = (params.get("doc") || "").trim().toLowerCase();
  if (fromQuery in PAGES) return fromQuery;

  const fromHash = (location.hash || "").slice(1).trim().toLowerCase();
  if (fromHash in PAGES) {
    const url = new URL(window.location.href);
    url.searchParams.set("doc", fromHash);
    url.hash = "";
    history.replaceState(null, "", url.toString());
    return fromHash;
  }

  return "readme";
};

const renderPage = async () => {
  if (!hasRequiredDom()) {
    console.error("docs.js missing required DOM elements");
    return;
  }

  const key = resolvePageKey();
  const page = PAGES[key];

  setActiveTab(key);
  statusEl.textContent = `Loading ${page.title}...`;
  rawLinkEl.href = page.file;
  rawLinkEl.textContent = `View raw Markdown`;

  try {
    const res = await fetch(page.file, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const md = await res.text();
    const parsed = parseMarkdown(md);
    contentEl.innerHTML = parsed.html || `<p class="muted">No content.</p>`;
    setToc(parsed.toc);
    statusEl.textContent = "";
  } catch (err) {
    statusEl.textContent = "Failed to load documentation.";
    contentEl.innerHTML =
      `<p class="muted">If you opened this file directly, run <code>npm run dev</code> and open <code>http://localhost:5173/docs.html</code> (or serve the repo over HTTP with any static server).</p>`;
    tocEl.innerHTML = "";
    console.error(err);
  }
};

tabEls.forEach((tab) => {
  tab.addEventListener("click", (e) => {
    const key = tab.getAttribute("data-doc");
    if (!key || !(key in PAGES)) return;
    e.preventDefault();
    const url = new URL(window.location.href);
    url.searchParams.set("doc", key);
    history.pushState(null, "", url.toString());
    window.scrollTo({ top: 0, behavior: "smooth" });
    renderPage();
  });
});

window.addEventListener("popstate", () => {
  renderPage();
});

renderPage();
