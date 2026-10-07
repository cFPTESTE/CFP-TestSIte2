// Full publication lists with CFP affiliation, built from OpenAlex (which links works to ORCID iDs
// and keeps each author's affiliation as printed on the paper).
//
// For every member with an ORCID in content/people/*.yml, all works are fetched and kept only if
// that member's affiliation on the paper matches one of the patterns in content/site.yml
// (publications.affiliation_patterns). Results are cached in .cache/openalex.json so a failed
// request never empties the list.
import fs from "node:fs";
import path from "node:path";

const CACHE = path.join(".cache", "openalex.json");
const SKIP_TYPES = new Set(["paratext", "erratum", "retraction", "peer-review", "dataset", "editorial", "letter", "supplementary-materials"]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const normalize = (s) => (s || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
const cleanTitle = (s) => (s || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
const titleKey = (s) => normalize(cleanTitle(s)).replace(/[^a-z0-9]+/g, "");
const orcidOf = (s) => ((s || "").match(/\d{4}-\d{4}-\d{4}-\d{3}[\dX]/) || [])[0];

function readCache() {
  try { return JSON.parse(fs.readFileSync(CACHE, "utf8")); } catch { return { byOrcid: {} }; }
}
function writeCache(c) {
  fs.mkdirSync(path.dirname(CACHE), { recursive: true });
  fs.writeFileSync(CACHE, JSON.stringify(c));
}

async function getJson(url, tries = 4) {
  for (let i = 0; i < tries; i++) {
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (res.ok) return res.json();
    if (res.status === 429 || res.status >= 500) { await sleep(1500 * 2 ** i); continue; }
    throw new Error(`HTTP ${res.status}`);
  }
  throw new Error("too many retries");
}

async function fetchWorksForOrcid(orcid, mailto) {
  if (process.env.OPENALEX_TEST_DIR) {
    const f = path.join(process.env.OPENALEX_TEST_DIR, `${orcid}.json`);
    return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")).results : [];
  }
  const select = "id,doi,display_name,title,publication_year,publication_date,type,primary_location,biblio,authorships";
  let cursor = "*", out = [];
  while (cursor) {
    const url = `https://api.openalex.org/works?filter=author.orcid:${orcid}&per-page=200&cursor=${encodeURIComponent(cursor)}&select=${select}` + (mailto ? `&mailto=${encodeURIComponent(mailto)}` : "");
    const data = await getJson(url);
    out = out.concat(data.results || []);
    cursor = data.meta && data.meta.next_cursor && (data.results || []).length ? data.meta.next_cursor : null;
    await sleep(150);
  }
  return out;
}

function affiliationsOf(authorship) {
  const a = [];
  (authorship.raw_affiliation_strings || []).forEach((s) => a.push(s));
  (authorship.affiliations || []).forEach((x) => x.raw_affiliation_string && a.push(x.raw_affiliation_string));
  (authorship.institutions || []).forEach((x) => x.display_name && a.push(x.display_name));
  return a;
}

function toEntry(w, res = []) {
  const src = (w.primary_location && w.primary_location.source) || {};
  const b = w.biblio || {};
  let journal = src.display_name || "";
  if (b.volume) journal += ` ${b.volume}`;
  if (b.first_page) journal += `, ${b.first_page}`;
  const doi = w.doi ? w.doi.replace(/^https?:\/\/doi\.org\//, "") : "";
  return {
    key: w.id,
    title: cleanTitle(w.display_name || w.title),
    year: w.publication_year,
    date: w.publication_date || String(w.publication_year || ""),
    type: w.type,
    journal: journal.trim(),
    url: doi ? `https://doi.org/${doi}` : (w.primary_location && w.primary_location.landing_page_url) || w.id,
    // cfp: this author's printed affiliation matches the CFP patterns (used to recognise members
    // whose authorship OpenAlex did not link to their ORCID)
    authors: (w.authorships || []).map((a) => ({
      name: (a.author && a.author.display_name) || a.raw_author_name || "",
      orcid: orcidOf(a.author && a.author.orcid),
      cfp: res.length > 0 && affiliationsOf(a).map(normalize).some((s) => res.some((r) => r.test(s))),
    })),
  };
}

export function filterCfp(works, orcid, patterns) {
  const res = patterns.map((p) => new RegExp(p, "i"));
  const kept = [], rejected = [];
  for (const w of works) {
    if (SKIP_TYPES.has(w.type)) continue;
    const me = (w.authorships || []).find((a) => orcidOf(a.author && a.author.orcid) === orcid);
    if (!me) continue;
    const affs = affiliationsOf(me).map(normalize);
    (affs.some((s) => res.some((r) => r.test(s))) ? kept : rejected).push(toEntry(w, res));
  }
  return { kept, rejected };
}

// Merge works of all members: one entry per paper, preferring the published version over the preprint.
export function merge(perMember) {
  const byKey = new Map();
  for (const { person, works } of perMember) {
    for (const w of works) {
      const k = titleKey(w.title);
      if (!k) continue;
      const cur = byKey.get(k);
      if (!cur) { byKey.set(k, { ...w, members: [{ name: person.name, slug: person.slug, pending: !!person.pending }], areas: new Set(person.areas) }); continue; }
      if (!cur.members.some((m) => m.slug === person.slug)) cur.members.push({ name: person.name, slug: person.slug, pending: !!person.pending });
      person.areas.forEach((a) => cur.areas.add(a));
      if (cur.type === "preprint" && w.type !== "preprint") Object.assign(cur, { ...w, members: cur.members, areas: cur.areas });
    }
  }
  return [...byKey.values()].map((e) => ({ ...e, areas: [...e.areas] }))
    .sort((a, b) => (b.date || "").localeCompare(a.date || "") || a.title.localeCompare(b.title));
}

export async function loadCfpPublications(people, cfg = {}) {
  const patterns = cfg.affiliation_patterns || [];
  const members = people.filter((p) => p.orcid);
  if (!patterns.length || !members.length || process.env.SKIP_OPENALEX) return { list: [], report: [] };
  const cache = readCache();
  const perMember = [], report = [];
  for (const p of members) {
    let works, source = "live";
    try {
      works = await fetchWorksForOrcid(p.orcid, cfg.openalex_mailto);
      cache.byOrcid[p.orcid] = { at: new Date().toISOString(), works };
    } catch (err) {
      works = (cache.byOrcid[p.orcid] || {}).works || [];
      source = works.length ? "cache" : `failed (${err.message})`;
    }
    const { kept, rejected } = filterCfp(works, p.orcid, patterns);
    perMember.push({ person: p, works: kept });
    report.push({ name: p.name, orcid: p.orcid, source, total: works.length, cfp: kept.length, other: rejected.length });
  }
  writeCache(cache);
  const list = merge(perMember);
  console.log(`[openalex] ${list.length} CFP-affiliated works from ${members.length} ORCIDs`);
  report.forEach((r) => console.log(`[openalex]   ${r.name}: ${r.cfp} with CFP affiliation, ${r.other} without (${r.source})`));
  return { list, report };
}
