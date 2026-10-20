#!/usr/bin/env python3
"""Turn a built site into a portable copy with relative links, for static hosting at FCUP.

    python3 tools/relativize.py _site _site_fcup /CFP-TestSIte2/

Copies SRC to DEST and rewrites every link that starts with PREFIX (the path prefix the site
was built with) into a link relative to the page it is in, so the copy works in any folder of
any web server – and also when opened straight from the disk. Links to folders get an explicit
"index.html" for the same reason.
"""
import os, re, shutil, sys

src, dest, prefix = sys.argv[1], sys.argv[2], sys.argv[3]
if not prefix.endswith("/"):
    prefix += "/"
if os.path.exists(dest):
    shutil.rmtree(dest)
shutil.copytree(src, dest)

P = re.escape(prefix)
ATTR = re.compile(r'(\s(?:href|src|poster|action|data-[\w-]+)\s*=\s*)(["\'])' + P + r'(?!/)([^"\'<>\s]*)\2')
SRCSET = re.compile(r'(\ssrcset\s*=\s*)(["\'])([^"\']*)\2')
CSSURL = re.compile(r'url\(\s*(["\']?)' + P + r'([^"\')\s]*)\1\s*\)')

def relative(target, here):
    path, sep, rest = _split(target)
    full = os.path.join(dest, path)
    if path == "" or path.endswith("/") or os.path.isdir(full):
        full = os.path.join(full, "index.html")
    rel = os.path.relpath(full, here).replace(os.sep, "/")
    return rel + sep + rest

def _split(t):
    m = re.search(r"[#?]", t)
    return (t, "", "") if not m else (t[: m.start()], t[m.start()], t[m.start() + 1 :])

changed = 0
for root, _, files in os.walk(dest):
    for f in files:
        if not f.endswith((".html", ".css", ".js", ".xml", ".json", ".svg", ".webmanifest")):
            continue
        p = os.path.join(root, f)
        s = open(p, encoding="utf-8").read()
        t = ATTR.sub(lambda m: m.group(1) + m.group(2) + relative(m.group(3), root) + m.group(2), s)
        t = SRCSET.sub(lambda m: m.group(1) + m.group(2) + ", ".join(
            (relative(u[len(prefix):], root) if u.startswith(prefix) else u) + (" " + d if d else "")
            for u, _, d in (x.strip().partition(" ") for x in m.group(3).split(",") if x.strip())) + m.group(2), t)
        t = CSSURL.sub(lambda m: "url(" + m.group(1) + relative(m.group(2), root) + m.group(1) + ")", t)
        if t != s:
            open(p, "w", encoding="utf-8").write(t)
            changed += 1
left = sum(len(ATTR.findall(open(os.path.join(r, f), encoding="utf-8", errors="ignore").read()))
           for r, _, fs in os.walk(dest) for f in fs if f.endswith(".html"))
print(f"[relativize] {changed} files rewritten; {left} root-absolute links left")
