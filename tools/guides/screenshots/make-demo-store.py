#!/usr/bin/env python3
"""Makes the demo workspace for the screenshots: E1's test fixture with neutral names.
Usage: python3 make-demo-store.py <E1 checkout> <work folder>"""
import json, os, sys
e1, work = sys.argv[1], sys.argv[2]
text = open(os.path.join(e1, "tests/fixtures/workspace-drawn-sheet.json"), encoding="utf-8").read()
project = next(n for n in json.loads(text)["tree"][0]["children"] if n.get("type") == "project")["name"]
doc = json.loads(text.replace('"%s' % project, '"Demo Plant').replace(" %s" % project, " Demo Plant"))
doc["meta"]["name"] = "Demo Company"
os.makedirs(os.path.join(work, "store"), exist_ok=True)
json.dump(doc, open(os.path.join(work, "store", "base.json"), "w"))
json.dump(doc, open(os.path.join(work, "store", "db.json"), "w"))
print("Start E1 with: E1_DB=%s E1_AI_MODE=off npx vite --port 5173" % os.path.join(work, "store", "db.json"))
