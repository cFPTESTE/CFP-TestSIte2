"""
Import new answers from the Google Form into content/people/.

Usage:
    python3 tools/import_form.py "Informação para o site do centro de física do Porto (Responses).xlsx"

- Creates content/people/<name>.yml for each answer.
- An existing file is only replaced if it is still a placeholder (pending: true),
  unless you pass --overwrite. Hand-edited profiles are never touched by default.
- Article links are kept as URLs; add the "title" and "journal" by hand afterwards
  (the site shows the link itself until a title is filled in).

Requires: pip install openpyxl pyyaml
"""
import re, sys, os, unicodedata
import openpyxl, yaml

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "content", "people")

CATEGORY = {"Docente": "faculty", "Investigador": "researcher",
            "Estudante de Doutoramento": "phd", "Estudante de Mestrado": "msc"}
# Form theme -> site area id (see content/areas.yml). Add new themes here.
THEME_TO_AREA = {
    "adS/cft": "qft-holography", "neural quantum states": "qft-holography",
    "topological defects in classical field theories": "qft-holography",
    "cosmology": "gravitation-cosmology",
    "low-dimensional materials": "quantum-materials", "quasi-periodic systems": "quantum-materials",
    "topological phases of matter": "quantum-materials", "topological materials": "quantum-materials",
    "correlated electronic systems": "quantum-materials", "non-linear optical response": "quantum-materials",
    "quantum computing": "quantum-computation", "physics education research": "physics-education",
}
THEME_TO_AREA = {k.lower(): v for k, v in THEME_TO_AREA.items()}
LINK_LABELS = [("inspirehep", "INSPIRE-HEP"), ("scholar.google", "Google Scholar"), ("scopus", "Scopus"),
               ("webofscience", "Web of Science"), ("linkedin", "LinkedIn"), ("sigarra", "SIGARRA"), ("github", "GitHub")]


def slug(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def col(headers, start):
    for i, h in enumerate(headers):
        if h and str(h).strip().lower().startswith(start.lower()):
            return i
    raise KeyError(start)


class Block(str):
    pass


yaml.add_representer(Block, lambda d, s: d.represent_scalar("tag:yaml.org,2002:str", s, style="|"))


def main(path, overwrite=False):
    ws = openpyxl.load_workbook(path, read_only=True).active
    rows = list(ws.iter_rows(values_only=True))
    H = rows[0]
    C = {k: col(H, v) for k, v in dict(name="Nome", cat="Categoria", aff="Afiliação", bio="Breve biografia",
         arts="1-5 links", themes="Principais temas", kw="Keywords", orcid="Link Orcid", links="Outros links",
         room="Localização", email="E-mail").items()}
    made = skipped = 0
    for r in rows[1:]:
        g = lambda k: ("" if r[C[k]] is None else str(r[C[k]]).strip())
        name = g("name")
        if not name:
            continue
        fn = os.path.join(OUT, slug(name) + ".yml")
        if os.path.exists(fn) and not overwrite:
            old = yaml.safe_load(open(fn)) or {}
            if not old.get("pending"):
                skipped += 1
                continue
        themes = [t.strip() for t in re.split(r"[;,]", g("themes")) if t.strip()]
        areas = []
        for t in themes:
            a = THEME_TO_AREA.get(t.lower())
            if a and a not in areas:
                areas.append(a)
            if not a:
                print(f"  ! {name}: theme '{t}' has no area — add it to THEME_TO_AREA or edit the file")
        orcid = re.search(r"\d{4}-\d{4}-\d{4}-\d{3}[\dX]", g("orcid"))
        links = []
        for u in re.findall(r"https?://[^\s,;]+", g("links")):
            label = next((l for k, l in LINK_LABELS if k in u), "Personal page")
            links.append({"label": label, "url": u})
        pubs = []
        for u in dict.fromkeys(re.findall(r"https?://[^\s;,]+", g("arts"))):
            pubs.append({"title": "", "journal": "", "year": None, "url": u.rstrip(".")})
        d = {"name": name, "category": CATEGORY.get(g("cat"), "phd"), "areas": areas}
        if g("aff") and g("aff") != "CFP":
            d["affiliation"] = g("aff")
        d["keywords"] = [k.strip().rstrip(".") for k in re.split(r"[,;\n]", g("kw")) if k.strip().rstrip(".")]
        d["email"] = g("email")
        if g("room") and g("room") not in ("-", "Não aplicável"):
            d["office"] = g("room")
        if orcid:
            d["orcid"] = orcid.group(0)
        if links:
            d["links"] = links
        d["photo"] = ""
        d["bio"] = Block(g("bio").replace("\xa0", " ") + "\n")
        if pubs:
            d["publications"] = pubs
        with open(fn, "w") as f:
            yaml.dump(d, f, allow_unicode=True, sort_keys=False, width=1000)
        made += 1
        print(f"  + {os.path.relpath(fn, ROOT)}")
    print(f"{made} profiles written, {skipped} existing profiles left untouched.")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(sys.argv[1], overwrite="--overwrite" in sys.argv)
