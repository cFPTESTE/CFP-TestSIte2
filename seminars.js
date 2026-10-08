// Seminars and journal clubs, from up to three sources merged together:
//   1. content/seminars.yml          (hand-written entries)
//   2. content/seminars.csv          (a table that can be edited on GitHub, or exported from a spreadsheet)
//   3. a published Google Sheet      (site.yml -> seminars.sheet_csv: "File > Share > Publish to web > CSV" link)
// The sheet is read at every build (nightly); the last good copy is kept in .cache/ so a sheet that
// disappears or is offline for a night does not empty the list. Rows without a valid date are ignored.
import fs from "node:fs";
import path from "node:path";

const FIELDS = ["date", "time", "type", "speaker", "affiliation", "title", "abstract", "room", "online", "area", "paper", "slides", "video"];
// Accept Portuguese/English header names from a spreadsheet
const ALIASES = {
  data: "date", hora: "time", tipo: "type", orador: "speaker", oradora: "speaker", "afiliação": "affiliation", afiliacao: "affiliation",
  "título": "title", titulo: "title", resumo: "abstract", sala: "room", "link online": "online", link: "online", "área": "area",
  artigo: "paper", "gravação": "video", gravacao: "video",
};

export function parseCsv(text) {
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim()));
}

function rowsToSeminars(rows) {
  if (!rows.length) return [];
  const head = rows[0].map((h) => { const k = h.trim().toLowerCase(); return ALIASES[k] || k; });
  return rows.slice(1).map((r) => {
    const s = {};
    head.forEach((h, i) => { if (FIELDS.includes(h) && (r[i] || "").trim()) s[h] = r[i].trim(); });
    return s;
  });
}

// "2026-10-15", "15/10/2026" or a spreadsheet date like "10/15/2026" with a 4-digit year at the end
function parseDate(v) {
  if (v instanceof Date) return v;
  const s = String(v || "").trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
  if (m) { const a = +m[1], b = +m[2]; const [d, mo] = a > 12 ? [a, b] : b > 12 ? [b, a] : [a, b]; return new Date(Date.UTC(+m[3], mo - 1, d)); }
  return null;
}

async function readSheet(url, cacheFile) {
  if (!url || process.env.SKIP_SHEET) return [];
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000), redirect: "follow" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    if (/^\s*</.test(text)) throw new Error("not a CSV (is the sheet published as CSV?)");
    fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
    fs.writeFileSync(cacheFile, text);
    return rowsToSeminars(parseCsv(text));
  } catch (err) {
    console.warn(`[seminars] could not read the sheet (${err.message}); using the last saved copy`);
    return fs.existsSync(cacheFile) ? rowsToSeminars(parseCsv(fs.readFileSync(cacheFile, "utf8"))) : [];
  }
}

// Recording: a video on the channel published within 45 days after the talk whose title has the speaker's surname
function findVideo(s, videos) {
  const sur = (s.speaker || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").trim().split(/\s+/).pop();
  if (!sur || sur.length < 3) return null;
  const re = new RegExp(`\\b${sur.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
  return videos.find((v) => {
    const days = (v.date - s.date) / 864e5;
    return days >= -1 && days <= 45 && re.test(v.title.normalize("NFKD").replace(/[̀-ͯ]/g, ""));
  }) || null;
}

export async function loadSeminars({ contentDir, sheetUrl, videos = [] }) {
  const out = [];
  const yml = path.join(contentDir, "seminars.yml");
  if (fs.existsSync(yml)) {
    const yaml = await import("js-yaml");
    out.push(...(yaml.load(fs.readFileSync(yml, "utf8")) || []));
  }
  const csv = path.join(contentDir, "seminars.csv");
  if (fs.existsSync(csv)) out.push(...rowsToSeminars(parseCsv(fs.readFileSync(csv, "utf8"))));
  out.push(...(await readSheet(sheetUrl, path.join(".cache", "seminars-sheet.csv"))));

  const seen = new Set(), list = [];
  for (const raw of out) {
    const date = parseDate(raw.date);
    if (!date || !raw.speaker && !raw.title) continue;
    const key = `${date.toISOString().slice(0, 10)}|${(raw.speaker || raw.title).toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const s = { ...raw, date };
    if (!s.video) { const v = findVideo(s, videos); if (v) s.video = v.url; }
    list.push(s);
  }
  list.sort((a, b) => a.date - b.date);
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  console.log(`[seminars] ${list.length} seminars (${list.filter((s) => s.date >= today).length} upcoming)`);
  return { upcoming: list.filter((s) => s.date >= today), past: list.filter((s) => s.date < today).reverse() };
}
