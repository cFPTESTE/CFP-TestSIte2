import fs from "node:fs";
import path from "node:path";
import * as yaml from "js-yaml";
import { HtmlBasePlugin } from "@11ty/eleventy";
import { fetchVideos } from "./youtube.js";
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
  const areas = readYaml("areas.yml");
  const site = readYaml("site.yml");
  if (process.env.SITE_THEME !== undefined) site.theme = process.env.SITE_THEME;
  const projects = (readYaml("projects.yml") || []).filter((p) => !p.hidden);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const seminars = (readYaml("seminars.yml") || []).map((s) => ({ ...s, date: new Date(s.date) }))
    .sort((a, b) => a.date - b.date);
  const upcoming = seminars.filter((s) => s.date >= today);
  const past = seminars.filter((s) => s.date < today).reverse();

  // Publications: merge duplicates across members (same URL)
  const pubMap = new Map();
  for (const p of people) {
    for (const pub of p.publications) {
      const key = (pub.url || pub.title).toLowerCase();
      if (!pubMap.has(key)) pubMap.set(key, { ...pub, members: [], areas: new Set() });
      const e = pubMap.get(key);
      e.members.push({ name: p.name, slug: p.slug });
      p.areas.forEach((a) => e.areas.add(a));
    }
  }
  const publications = [...pubMap.values()].map((e) => ({ ...e, areas: [...e.areas] }))
    .sort((a, b) => (b.year || 0) - (a.year || 0) || a.title.localeCompare(b.title));
  const pubYears = [...new Set(publications.map((p) => p.year))].sort((a, b) => b - a);

  // Full list of CFP-affiliated works from OpenAlex (empty if it could not be fetched)
  const { list: cfpWorks } = await loadCfpPublications(people, site.publications);
  const memberOrcids = new Set(people.filter((p) => p.orcid).map((p) => p.orcid));
  for (const w of cfpWorks) {
    // Long author lists: first 6 authors, plus any CFP member further down the list
    const all = w.authors.map((a, i) => ({ name: a.name, member: memberOrcids.has(a.orcid), i }));
    const shown = all.length > 8 ? all.filter((a) => a.i < 6 || a.member) : all;
    w.authorsShort = shown.map((a, k) => ({ ...a, gap: k > 0 && a.i !== shown[k - 1].i + 1 }));
    w.moreAuthors = all.length - shown.length;
  }
  for (const p of people) p.cfpPublications = cfpWorks.filter((w) => w.members.some((m) => m.slug === p.slug));
  const cfpYears = [...new Set(cfpWorks.map((w) => w.year))].filter(Boolean).sort((a, b) => b - a);

  eleventyConfig.addGlobalData("site", site);
  eleventyConfig.addGlobalData("people", people);
  eleventyConfig.addGlobalData("profiles", people.filter((p) => !p.pending));
  eleventyConfig.addGlobalData("areas", areas);
  eleventyConfig.addGlobalData("projects", projects);
  eleventyConfig.addGlobalData("seminars", { upcoming, past });
  eleventyConfig.addGlobalData("videos", () => fetchVideos(site.youtube && site.youtube.channel_id, 8));
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
