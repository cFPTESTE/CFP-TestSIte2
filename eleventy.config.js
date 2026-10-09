import fs from "node:fs";
import path from "node:path";
import * as yaml from "js-yaml";
import { HtmlBasePlugin } from "@11ty/eleventy";
import markdownIt from "markdown-it";
import { fetchVideos } from "./youtube.js";
import { loadSeminars } from "./seminars.js";
import { loadCfpPublications } from "./publications.js";

const CONTENT = "content";
const readYaml = (f) => yaml.load(fs.readFileSync(path.join(CONTENT, f), "utf8"));

const CATEGORY_ORDER = ["faculty", "researcher", "phd", "msc"];
const CATEGORY_LABEL = { faculty: "Faculty", researcher: "Researchers", phd: "PhD students", msc: "MSc students" };
const CATEGORY_SINGULAR = { faculty: "Faculty", researcher: "Researcher", phd: "PhD student", msc: "MSc student" };

function slugify(s) {
  return s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
// Sort by surname-ish: last word, then full name
const sortKey = (n) => { const w = n.split(/\s+/); return (w[w.length - 1] + " " + n).toLowerCase(); };

function loadPeople() {
  const dir = path.join(CONTENT, "people");
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"))
    .map((f) => {
      const p = yaml.load(fs.readFileSync(path.join(dir, f), "utf8"));
      p.slug = path.basename(f).replace(/\.ya?ml$/, "");
      p.areas = p.areas || [];
      p.keywords = p.keywords || [];
      p.links = p.links || [];
      p.publications = (p.publications || []).sort((a, b) => (b.year || 0) - (a.year || 0));
      p.categoryLabel = CATEGORY_SINGULAR[p.category] || p.category;
      // prefer a local copy of the photo (tools/fetch_photos.py downloads remote photos before the build)
      for (const ext of ["jpg", "jpeg", "png", "webp"]) {
        if (fs.existsSync(path.join("src", "assets", "people", `${p.slug}.${ext}`))) { p.photo = `/assets/people/${p.slug}.${ext}`; break; }
      }
      p.initials = p.name.split(/\s+/).filter((w) => /^\p{Lu}/u.test(w)).map((w) => w[0]).filter((_, i, a) => i === 0 || i === a.length - 1).join("");
      return p;
    })
    .sort((a, b) => sortKey(a.name).localeCompare(sortKey(b.name), "pt"));
}

export default async function (eleventyConfig) {
  eleventyConfig.addPlugin(HtmlBasePlugin);
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  eleventyConfig.addWatchTarget(CONTENT);

  const people = loadPeople();
  // Preview only: PHOTO_DEMO="slug:/assets/people/file.jpg" shows how a profile photo looks
  if (process.env.PHOTO_DEMO) { const [s, f] = process.env.PHOTO_DEMO.split(":"); const p = people.find((x) => x.slug === s); if (p) p.photo = f; }
  const areas = readYaml("areas.yml");
  const site = readYaml("site.yml");
  if (process.env.SITE_THEME !== undefined) site.theme = process.env.SITE_THEME;
  const projects = (readYaml("projects.yml") || []).filter((p) => !p.hidden);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  // YouTube: read once (more than shown, so recordings of older seminars can be matched)
  const allVideos = await fetchVideos(site.youtube && site.youtube.channel_id, 30);
  // Seminars & journal clubs: content/seminars.yml + content/seminars.csv + the published sheet (site.yml)
  const seminars = await loadSeminars({ contentDir: CONTENT, sheetUrl: site.seminars && site.seminars.sheet_csv, videos: allVideos });

  // Author lists for the papers in the profiles (content/publication-authors.yml), with CFP members flagged
  const pubAuthors = fs.existsSync(path.join(CONTENT, "publication-authors.yml")) ? readYaml("publication-authors.yml") || {} : {};
  const pubKey = (u) => { const m = (u || "").match(/10\.\d{4,9}\/\S+/); return (m ? m[0].replace(/\.$/, "") : (u || "")).toLowerCase(); };
  const toks = (s) => (s || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z]+/g, " ").trim().split(" ").filter(Boolean);
  function memberFor(a) {
    if (a.orcid) { const byO = people.find((p) => p.orcid === a.orcid); if (byO) return byO; }
    const t = toks(a.name); if (!t.length) return null;
    return people.find((p) => {
      if (a.orcid && p.orcid) return false;          // both have ORCIDs and they differ
      const pt = toks(p.name);
      return t[t.length - 1] === pt[pt.length - 1] && t[0][0] === pt[0][0];
    }) || null;
  }
  for (const p of people) for (const pub of p.publications) {
    const d = pubAuthors[pubKey(pub.url || pub.title)];
    if (!d || !d.authors || !d.authors.length) continue;
    pub.authorsAll = d.authors.map((a, i) => {
      const m = memberFor(a);
      return { name: a.name, member: !!m, slug: m && !m.pending ? m.slug : "", person: m, i };
    });
  }

  // Publications: merge duplicates across members (same URL)
  const pubMap = new Map();
  for (const p of people) {
    for (const pub of p.publications) {
      const key = (pub.url || pub.title).toLowerCase();
      if (!pubMap.has(key)) pubMap.set(key, { ...pub, members: [], areas: new Set() });
      const e = pubMap.get(key);
      if (!e.members.some((m) => m.slug === p.slug)) e.members.push({ name: p.name, slug: p.slug });
      p.areas.forEach((a) => e.areas.add(a));
      // co-authors from CFP who did not list the paper themselves
      for (const a of pub.authorsAll || []) if (a.person && !e.members.some((m) => m.slug === a.person.slug)) {
        e.members.push({ name: a.person.name, slug: a.person.slug }); a.person.areas.forEach((x) => e.areas.add(x));
      }
    }
  }
  // Only papers from a CFP author's time at the centre (member_since, from the team lists) count as CFP publications
  const sinceOf = (slug) => { const p = people.find((x) => x.slug === slug); return p && p.member_since ? p.member_since : 0; };
  const publications = [...pubMap.values()].filter((e) => !e.year || e.members.some((m) => sinceOf(m.slug) <= e.year))
    .map((e) => ({ ...e, areas: [...e.areas] }))
    .sort((a, b) => (b.year || 0) - (a.year || 0) || a.title.localeCompare(b.title));
  const pubYears = [...new Set(publications.map((p) => p.year))].sort((a, b) => b - a);

  // Full list of CFP-affiliated works from OpenAlex (empty if it could not be fetched)
  const { list: cfpWorks } = await loadCfpPublications(people, site.publications);
  // Authors: full list, CFP members highlighted and linked to their profile.
  // Very long lists (collaborations) show the first authors plus the CFP members, with the rest behind "show all".
  const memberByOrcid = new Map(people.filter((p) => p.orcid).map((p) => [p.orcid, p]));
  // Manual corrections (content/author-fixes.yml): OpenAlex sometimes attributes a member's
  // authorship to someone else. Each fix says: in this paper, the author shown as X is member Y.
  const authorFixes = fs.existsSync(path.join(CONTENT, "author-fixes.yml")) ? readYaml("author-fixes.yml") || [] : [];
  const idOf = (s) => String(s || "").toLowerCase().replace(/^https?:\/\/(dx\.)?doi\.org\//, "").trim();
  for (const w of cfpWorks) for (const f of authorFixes) {
    if (!f || !f.work || ![w.url, w.doi].some((u) => u && idOf(u) === idOf(f.work))) continue;
    const m = people.find((p) => p.slug === f.member); if (!m) continue;
    const a = w.authors.find((x) => (x.name || "").trim().toLowerCase() === String(f.openalex_name || "").trim().toLowerCase());
    if (a) a.fixMember = m;
    if (!w.members.some((x) => x.slug === m.slug)) w.members.push({ name: m.name, slug: m.slug, pending: !!m.pending });
    for (const ar of m.areas) if (!w.areas.includes(ar)) w.areas.push(ar);
  }
  for (const w of cfpWorks) {
    // CFP members are shown with the name from their profile (OpenAlex sometimes merges
    // author records and shows someone else's name); placeholder authors are dropped.
    const all = w.authors.filter((a) => !/^(anonymous|unknown|n\/a)$/i.test((a.name || "").trim()))
      .map((a, i) => {
        // by ORCID; else a manual fix; else an author with CFP affiliation whose name matches a member
        const m = memberByOrcid.get(a.orcid) || a.fixMember || (a.cfp && !memberByOrcid.has(a.orcid) ? memberFor({ name: a.name.includes(",") ? a.name.split(",").reverse().join(" ") : a.name }) : null);
        return { name: m ? m.name : a.name, member: !!m, slug: m && !m.pending ? m.slug : "", person: m, i };
      });
    w.authorsAll = all;
    for (const a of all) if (a.person && !w.members.some((x) => x.slug === a.person.slug)) {
      w.members.push({ name: a.person.name, slug: a.person.slug, pending: !!a.person.pending });
      for (const ar of a.person.areas) if (!w.areas.includes(ar)) w.areas.push(ar);
    }
    w.longList = all.length > 25;
    const shown = w.longList ? all.filter((a) => a.i < 10 || a.member) : all;
    w.authorsShort = shown.map((a, k) => ({ ...a, gap: k > 0 && a.i !== shown[k - 1].i + 1 }));
    w.moreAuthors = all.length - shown.length;
  }
  for (const p of people) p.cfpPublications = cfpWorks.filter((w) => w.members.some((m) => m.slug === p.slug));

  // Profile visual: an animated scene chosen from the profile's keywords (or "visual:" in the profile)
  // [scene, keywords (counted), areas where it may be used (empty = any)]
  const SCENES = [
    ["solitons", /soliton|kink|vortex|vortic|topological defect|sine-gordon|\bbps\b|lump|monopole|domain wall|breather/g, []],
    ["chain", /hubbard|bethe|integrab|one-dimensional|\b1d\b|spin-charge/g, ["quantum-materials"]],
    ["lensing", /black hole|horizon|photon sphere|shadow|compact object/g, []],
    ["bloch", /quantum algorithm|quantum comput|qubit|neural quantum|quantum data|quantum simul/g, []],
    ["bootstrap", /bootstrap|conformal|\bcft\b|ads\/cft|holograph|gauge theor|gauge\/gravity|duality|supersymm|yang-mills|s-matrix|string|matrix quantum|quantum field/g, []],
    ["cosmos", /cosmolog|dark energy|dark matter|hubble|inflation|universe|supernova|gravitational wave|modified gravity/g, []],
    ["dirac", /graphene|moir|2d material|dirac|topological (insulator|material|semimetal|phase)|semimetal|quasiperiod|exciton|hall|superconduct|condensed|materials?\b/g, ["quantum-materials"]],
  ];
  const AREA_SCENE = { "nonlinear-physics": "solitons", "quantum-materials": "dirac", "qft-holography": "bootstrap", "gravitation-cosmology": "cosmos", "quantum-computation": "bloch" };
  for (const p of people) {
    const text = [...p.keywords, p.bio || ""].join(" ").toLowerCase();
    let best = "", bestN = 0;
    for (const [name, re, areasOk] of SCENES) {
      if (areasOk.length && !areasOk.some((a) => p.areas.includes(a))) continue;
      const n = (text.match(re) || []).length;
      if (n > bestN) { best = name; bestN = n; }
    }
    p.scene = p.visual === false ? "" : p.visual || best || AREA_SCENE[p.areas[0]] || "";
    // Featured works: "featured:" in the profile (DOIs, links or title words), else the selected publications, else recent CFP papers
    const pool = [...p.publications.map((x) => ({ title: x.title, url: x.url, venue: x.journal, year: x.year })),
                  ...p.cfpPublications.map((w) => ({ title: w.title, url: w.url, venue: w.journal, year: w.year }))];
    const pick = (f) => pool.find((x) => (x.url || "").toLowerCase().includes(String(f).toLowerCase()) || (x.title || "").toLowerCase().includes(String(f).toLowerCase()));
    const chosen = (p.featured || []).map(pick).filter(Boolean);
    p.featuredWorks = (chosen.length ? chosen : pool).filter((x) => x.title).slice(0, 3);
  }
  const cfpYears = [...new Set(cfpWorks.map((w) => w.year))].filter(Boolean).sort((a, b) => b - a);

  // Official logos: any file named src/assets/logos/<name>.{svg,png,webp,jpg}
  // cfp (wordmark, header), cfp-white (for dark backgrounds), cfp-icon (browser tab),
  // cfp-full (full logo), cf-um-up, lapmet, fct / fct-white
  const logos = {};
  for (const name of ["cfp", "cfp-white", "cfp-icon", "cfp-full", "cf-um-up", "cf-um-up-white", "lapmet", "lapmet-white", "fct", "fct-white"]) {
    for (const ext of ["svg", "png", "webp", "jpg", "jpeg"]) {
      if (fs.existsSync(path.join("src", "assets", "logos", `${name}.${ext}`))) { logos[name] = `/assets/logos/${name}.${ext}`; break; }
    }
  }
  eleventyConfig.addGlobalData("logos", logos);

  eleventyConfig.addGlobalData("site", site);
  eleventyConfig.addGlobalData("people", people);
  eleventyConfig.addGlobalData("profiles", people.filter((p) => !p.pending));
  eleventyConfig.addGlobalData("areas", areas);
  eleventyConfig.addGlobalData("projects", projects);
  eleventyConfig.addGlobalData("seminars", seminars);
  eleventyConfig.addGlobalData("videos", allVideos.slice(0, 8));
  eleventyConfig.addGlobalData("publications", publications);
  eleventyConfig.addGlobalData("pubYears", pubYears);
  eleventyConfig.addGlobalData("cfpWorks", cfpWorks);
  eleventyConfig.addGlobalData("cfpYears", cfpYears);
  eleventyConfig.addGlobalData("categories", CATEGORY_ORDER.map((id) => ({ id, label: CATEGORY_LABEL[id] })));
  eleventyConfig.addGlobalData("build", { year: new Date().getFullYear() });

  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  eleventyConfig.addFilter("day", (d) => new Date(d).getUTCDate());
  eleventyConfig.addFilter("month", (d) => MONTHS[new Date(d).getUTCMonth()]);
  eleventyConfig.addFilter("year", (d) => new Date(d).getUTCFullYear());
  eleventyConfig.addFilter("dateLong", (d) => { const x = new Date(d); return `${x.getUTCDate()} ${MONTHS[x.getUTCMonth()]} ${x.getUTCFullYear()}`; });
  eleventyConfig.addFilter("isoDate", (d) => new Date(d).toISOString().slice(0, 10));
  eleventyConfig.addFilter("newest", (list) => [...(list || [])].sort((a, b) => b.date - a.date));
  eleventyConfig.addFilter("inCategory", (list, c) => list.filter((p) => p.category === c));
  eleventyConfig.addFilter("inArea", (list, a) => list.filter((p) => (p.areas || []).includes(a)));
  eleventyConfig.addFilter("byYear", (list, y) => list.filter((p) => p.year === y));
  eleventyConfig.addFilter("area", (id) => areas.find((a) => a.id === id) || { id, name: id, color: "muted" });
  eleventyConfig.addFilter("slugify2", slugify);
  eleventyConfig.addFilter("map", (list, key) => (list || []).map((x) => x[key]));
  // Stylesheets are inlined in every page, so a new page paints with its final look straight away
  eleventyConfig.addFilter("inlineCss", (name) => fs.readFileSync(path.join("src", "assets", "css", name), "utf8"));
  eleventyConfig.addWatchTarget("src/assets/css/");
  const md = markdownIt({ html: true, linkify: true });
  // Markdown text from the YAML files; external links open in a new tab
  eleventyConfig.addFilter("md", (s) => md.render(s || "").replace(/<a href="http/g, '<a target="_blank" rel="noopener" href="http'));
  eleventyConfig.addFilter("json", (v) => JSON.stringify(v));
  eleventyConfig.addFilter("paragraphs", (s) => (s || "").trim().split(/\n\s*\n/).map((x) => x.trim()));
  eleventyConfig.addFilter("senior", (list) => list.filter((p) => p.category === "faculty" || p.category === "researcher"));
  eleventyConfig.addFilter("students", (list) => list.filter((p) => p.category === "phd" || p.category === "msc"));

  return {
    dir: { input: "src", includes: "_includes", output: "_site" },
    templateFormats: ["njk", "md"],
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    // Set by the GitHub Action for project pages (https://<user>.github.io/<repo>/)
    pathPrefix: process.env.PATH_PREFIX || "/",
  };
}
