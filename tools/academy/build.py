#!/usr/bin/env python3
"""Builds the E1 Academy syllabus from the user guides.

Source (edit this): tools/academy/syllabus.json
  paths       the learning paths, in the order they are taken
  courses     each course: its path, level, summary, outcome and modules;
              each module lists user guide feature ids, in teaching order
  guideOnly   available features that are taught by the user guides only

Reads: assets/data/user-guide-features.json (python3 tools/guides/build.py writes it)

Writes:
  assets/js/academy-syllabus.js   window.E1_SYLLABUS: the Academy page, the account's
                                  Academy and the course player's preview all read it
  docs/ACADEMY-SYLLABUS.md        the same syllabus to read and review

Lessons: the features of a module are packed, in order, into lessons of up to
PACK guide-minutes (the features' own `training.minutes`); a lesson's film
length is those minutes plus one minute for its goal and recap. Every course
ends with its assessment (`assessmentMinutes`).

Run: python3 tools/academy/build.py            (build)
     python3 tools/academy/build.py --check    (fail when a feature is unknown, not
                                                available, taught twice or not at all,
                                                or the written files are out of date)
"""
import json
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SOURCE = os.path.join(ROOT, "tools", "academy", "syllabus.json")
FEATURES = os.path.join(ROOT, "assets", "data", "user-guide-features.json")
OUT_JS = os.path.join(ROOT, "assets", "js", "academy-syllabus.js")
OUT_MD = os.path.join(ROOT, "docs", "ACADEMY-SYLLABUS.md")
PACK = 7          # guide-minutes per lesson, at most (a single bigger feature is its own lesson)
INTRO = 1         # minutes per lesson for its goal and recap
LEVELS = ["Beginner", "Intermediate", "Advanced"]


def lesson_title(topics):
    """The lesson's topics in teaching order, as the user guides name them."""
    return " · ".join(topics) if len(topics) <= 3 else " · ".join(topics[:3]) + " · …"


def build():
    src = json.load(open(SOURCE, encoding="utf-8"))
    cat = json.load(open(FEATURES, encoding="utf-8"))
    feats = {f["id"]: f for f in cat["features"]}
    errors = []
    seen = {}
    paths = {p["key"]: p for p in src["paths"]}
    courses = []
    for ci, c in enumerate(src["courses"]):
        if c["path"] not in paths:
            errors.append(f"{c['key']}: unknown path {c['path']}")
        if c["level"] not in LEVELS:
            errors.append(f"{c['key']}: unknown level {c['level']}")
        modules = []
        n = 0
        for m in c["modules"]:
            groups, cur, cur_min = [], [], 0
            for fid in m["features"]:
                f = feats.get(fid)
                if not f:
                    errors.append(f"{c['key']}: unknown feature {fid}")
                    continue
                if f["status"] != "available":
                    errors.append(f"{c['key']}: {fid} is {f['status']}, not available")
                if fid in seen:
                    errors.append(f"{fid} is taught twice: {seen[fid]} and {c['key']}")
                seen[fid] = c["key"]
                mins = int(f.get("training", {}).get("minutes") or 2)
                if cur and cur_min + mins > PACK:
                    groups.append(cur)
                    cur, cur_min = [], 0
                cur.append(f)
                cur_min += mins
            if cur:
                groups.append(cur)
            lessons = []
            for g in groups:
                n += 1
                topics = []
                for f in g:
                    t = f.get("training", {}).get("topic") or f["title"]
                    if t not in topics:
                        topics.append(t)
                minutes = sum(int(f.get("training", {}).get("minutes") or 2) for f in g) + INTRO
                title = lesson_title(topics)
                if lessons and lessons[-1]["title"].split(" (part")[0] == title:
                    title += f" (part {sum(1 for x in lessons if x['title'].split(' (part')[0] == title) + 1})"
                lessons.append({
                    "id": f"{c['key']}-{n:02d}",
                    "title": title,
                    "minutes": minutes,
                    "features": [{"id": f["id"], "title": f["title"], "summary": f.get("summary", ""), "page": f["page"]} for f in g],
                })
            modules.append({"title": m["title"], "lessons": lessons})
        lesson_min = sum(l["minutes"] for m in modules for l in m["lessons"])
        courses.append({
            "key": c["key"], "path": c["path"], "order": ci + 1, "level": c["level"],
            "title": c["title"], "summary": c["summary"], "outcome": c["outcome"],
            "lessons": sum(len(m["lessons"]) for m in modules),
            "minutes": lesson_min + src["assessmentMinutes"],
            "assessmentMinutes": src["assessmentMinutes"],
            "modules": modules,
        })
    for fid in src["guideOnly"]["features"]:
        if fid not in feats:
            errors.append(f"guideOnly: unknown feature {fid}")
        if fid in seen:
            errors.append(f"{fid} is both taught ({seen[fid]}) and guide only")
        seen[fid] = "guideOnly"
    missing = [f["id"] for f in cat["features"] if f["status"] == "available" and f["id"] not in seen]
    for fid in missing:
        errors.append(f"{fid} is available but in no course (add it, or to guideOnly)")

    out_paths = []
    for p in src["paths"]:
        cs = [c for c in courses if c["path"] == p["key"]]
        out_paths.append({**p, "courses": [c["key"] for c in cs], "minutes": sum(c["minutes"] for c in cs),
                          "lessons": sum(c["lessons"] for c in cs)})
    syllabus = {
        "title": src["title"],
        "paths": out_paths,
        "courses": courses,
        "totals": {
            "paths": len(out_paths), "courses": len(courses),
            "lessons": sum(c["lessons"] for c in courses),
            "minutes": sum(c["minutes"] for c in courses),
            "features": len([k for k, v in seen.items() if v != "guideOnly"]),
        },
    }
    return syllabus, errors


def hours(m):
    h, r = divmod(m, 60)
    return f"{h} h {r:02d} min" if h else f"{r} min"


def write_js(s):
    return ("/* Generated by tools/academy/build.py from tools/academy/syllabus.json and the user guides."
            " Do not edit. */\nwindow.E1_SYLLABUS = " + json.dumps(s, ensure_ascii=False, separators=(",", ":")) + ";\n")


def write_md(s):
    t = s["totals"]
    out = ["# E1 Academy syllabus", "",
           "Generated by `tools/academy/build.py` from `tools/academy/syllabus.json` and the user guides. Do not edit; change the source and build.", "",
           f"**{t['paths']} learning paths, {t['courses']} courses, {t['lessons']} lessons, about {hours(t['minutes'])} of film** "
           f"(lessons plus one assessment per course), teaching {t['features']} user guide features.", "",
           "| # | Path | Courses | Lessons | Length |", "| --- | --- | --- | --- | --- |"]
    for i, p in enumerate(s["paths"], 1):
        out.append(f"| {i} | {p['title']} | {len(p['courses'])} | {p['lessons']} | {hours(p['minutes'])} |")
    by = {c["key"]: c for c in s["courses"]}
    for p in s["paths"]:
        out += ["", f"## {p['title']}", "", p["summary"]]
        for k in p["courses"]:
            c = by[k]
            out += ["", f"### {c['order']}. {c['title']} ({c['level']}, {c['lessons']} lessons, {hours(c['minutes'])})", "",
                    c["summary"], "", f"Afterwards: {c['outcome']}", ""]
            for m in c["modules"]:
                out.append(f"- **{m['title']}**")
                for l in m["lessons"]:
                    out.append(f"  - {l['title']} ({l['minutes']} min) `{' '.join(f['id'] for f in l['features'])}`")
            out.append(f"- **Assessment** ({c['assessmentMinutes']} min)")
    return "\n".join(out) + "\n"


def main():
    check = "--check" in sys.argv
    s, errors = build()
    js, md = write_js(s), write_md(s)
    if check:
        for path, text in ((OUT_JS, js), (OUT_MD, md)):
            try:
                same = open(path, encoding="utf-8").read() == text
            except FileNotFoundError:
                same = False
            if not same:
                errors.append(f"{os.path.relpath(path, ROOT)} is out of date: run python3 tools/academy/build.py")
    else:
        open(OUT_JS, "w", encoding="utf-8").write(js)
        open(OUT_MD, "w", encoding="utf-8").write(md)
    t = s["totals"]
    print(f"{t['courses']} courses, {t['lessons']} lessons, {hours(t['minutes'])}, {t['features']} features")
    for e in errors:
        print("ERROR", e)
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()
