"""
Extract a Fuzzy Cognitive Map (FCM) graph for Wales from the 8 SoNaRR 2025
Power BI portal spreadsheets.

Design notes (see docs/blueprint.md):
- SoNaRR is DPSIR-structured: Driver -> Pressure -> State -> Impact(service).
- SoNaRR names the KEY pressures and rates the CONFIDENCE and TREND of each,
  but does NOT populate a numeric relevance/strength per causal link. So edge
  weights start from a documented uniform prior; confidence sets uncertainty;
  the user sets the weights in the app. We do not invent strengths.
- Signals we DO have and use:
    * State level (Low/Med/High assessment) -> initial activation of state nodes.
    * Pressure trend (Deteriorating/Improving/...) -> node metadata / baseline story.
    * Relative importance (High/Med/Low) -> weight of state -> service edges.
- Sign convention (documented, user-overridable in app):
    driver  -> pressure : +  (a driver increases its pressures)
    pressure-> state    : -  (a pressure degrades the ecosystem/resource state)
    state   -> service  : +  (better state delivers more of the service)
"""
import json
import re
import warnings
from pathlib import Path

import openpyxl

warnings.filterwarnings("ignore")

DATA = Path("/Users/lukemaggs/Desktop/Claude/WALES")
OUT = DATA / "prototype" / "model.json"

PRESS_ECO = "SoNaRR2025 Portal - Drivers of change and pressures - Ecosystems.xlsx"
PRESS_NR = "SoNaRR2025 Portal - Drivers of change and pressures - Natural Resources.xlsx"
STATE_ECO = "SoNaRR2025 Portal - Current state - Ecosystems.xlsx"
STATE_NR = "SoNaRR2025 Portal - Current state - Natural Resources.xlsx"
IMPACT_ECO = "SoNaRR2025 Portal - Impacts - Ecosystems.xlsx"

# ---- categorical -> numeric maps -------------------------------------------
LEVEL = {  # activation level in [0,1] for state assessments (Low state = poor)
    "low": 0.2, "low to medium": 0.35, "medium": 0.5,
    "medium to high": 0.65, "high": 0.8,
}
IMPORTANCE = {  # relative importance -> edge weight magnitude
    "low": 0.3, "medium - low": 0.4, "medium": 0.5,
    "medium - high": 0.65, "high": 0.8,
}
CONFIDENCE = {"low": 0.3, "medium": 0.6, "high": 0.9, "variable": 0.5}
DEFAULT_WEIGHT = 0.5  # uniform prior for links SoNaRR asserts but does not rate

TREND_SIGN = {  # direction the node is currently moving (metadata only)
    "improving": 1, "deteriorating": -1, "stable": 0,
    "mixed picture": 0, "not available": 0,
}


def norm(s):
    if s is None:
        return ""
    return re.sub(r"\s+", " ", str(s)).strip()


def key(s):
    return re.sub(r"[^a-z0-9]+", "_", norm(s).lower()).strip("_")


def load(fname, sheet):
    wb = openpyxl.load_workbook(DATA / fname, read_only=True, data_only=True)
    ws = wb[sheet]
    rows = list(ws.iter_rows(values_only=True))
    wb.close()
    hdr = [norm(h) for h in rows[0]]
    out = []
    for r in rows[1:]:
        rec = {hdr[i]: r[i] for i in range(len(hdr)) if i < len(r)}
        out.append(rec)
    return out


nodes = {}   # id -> node dict
edges = {}   # (src,dst) -> edge dict
state_levels = {}  # state node id -> list of level values to average


def add_node(nid, label, kind, **meta):
    if nid not in nodes:
        nodes[nid] = {"id": nid, "label": label, "kind": kind, **meta}
    return nid


def add_edge(src, dst, sign, weight, confidence, source, kind):
    k = (src, dst)
    if k in edges:
        e = edges[k]
        e["confidence"] = max(e["confidence"], confidence)
        e["support"] += 1
        return
    edges[k] = {
        "source": src, "target": dst, "sign": sign,
        "weight": round(weight, 3), "confidence": round(confidence, 3),
        "provenance": source, "kind": kind, "support": 1,
    }


# ---- 1. Driver -> Pressure -> State (ecosystems and natural resources) ------
for fname, entity_col, kind_state in [
    (PRESS_ECO, "Ecosystem", "state_ecosystem"),
    (PRESS_NR, "Natural resource", "state_resource"),
]:
    rel_col = ("Relevance of pressure to ecosystem"
               if "Ecosystem" in entity_col
               else "Relevance of pressure to natural resource")
    for r in load(fname, "ENG Key Pressures"):
        entity = norm(r.get(entity_col))
        driver = norm(r.get("Direct driver"))
        pressure = norm(r.get("Pressure"))
        if not (entity and driver and pressure):
            continue
        conf = CONFIDENCE.get(norm(r.get("Confidence assessment overall (2025)")).lower(), 0.6)
        trend = norm(r.get("Assessment of trend of pressure (2025)")).lower()
        did = add_node("driver:" + key(driver), driver, "driver")
        pid = add_node("pressure:" + key(pressure), pressure, "pressure")
        sid = add_node("state:" + key(entity), entity, kind_state)
        # driver increases pressure (+)
        add_edge(did, pid, +1, DEFAULT_WEIGHT, conf, driver + " -> " + pressure, "driver_pressure")
        # pressure degrades state (-)
        prov = norm(r.get(rel_col))[:280] or (pressure + " affects " + entity)
        add_edge(pid, sid, -1, DEFAULT_WEIGHT, conf, prov, "pressure_state")
        # record pressure trend as node metadata (count of deteriorating etc.)
        pm = nodes[pid].setdefault("trend_counts", {})
        pm[trend] = pm.get(trend, 0) + 1

# ---- 2. Initial state levels from current-state sheets ----------------------
for fname, entity_col, kind_state in [
    (STATE_ECO, "Ecosystem", "state_ecosystem"),
    (STATE_NR, "Natural resource", "state_resource"),
]:
    for r in load(fname, "Export"):
        entity = norm(r.get(entity_col))
        if not entity:
            continue
        sid = "state:" + key(entity)
        raw_state = (r.get("Assessment of state (2025)")
                     or r.get("Indicative assessment of state (2025)"))
        lvl = LEVEL.get(norm(raw_state).lower())
        if lvl is not None:
            state_levels.setdefault(sid, []).append(lvl)

# ---- 3. State -> Ecosystem service (impacts) --------------------------------
for r in load(IMPACT_ECO, "Impacts - full evidence"):
    entity = norm(r.get("Ecosystem"))
    stype = norm(r.get("Type of ecosystem service"))
    if not (entity and stype):
        continue
    imp = IMPORTANCE.get(norm(r.get("Relative importance in delivering ecosystem service")).lower())
    if imp is None:
        continue
    conf = CONFIDENCE.get(norm(r.get("Confidence assessment for current benefit")).lower(), 0.6)
    sid = "state:" + key(entity)
    if sid not in nodes:
        continue
    svc_short = stype.replace(" services", "").replace(" and maintenance", "")
    svid = add_node("service:" + key(svc_short), svc_short.title(), "service")
    add_edge(sid, svid, +1, imp, conf, entity + " -> " + stype, "state_service")

# ---- 4. Finalise initial activations ---------------------------------------
for nid, node in nodes.items():
    if node["kind"] in ("state_ecosystem", "state_resource") and nid in state_levels:
        vals = state_levels[nid]
        node["initial"] = round(sum(vals) / len(vals), 3)
        node["n_state_rows"] = len(vals)
    elif node["kind"] in ("driver", "pressure"):
        node["initial"] = 0.6  # drivers/pressures present and mostly active
    elif node["kind"] == "service":
        node["initial"] = 0.5
    else:
        node["initial"] = 0.5
    # summarise pressure trend into a single label
    if node["kind"] == "pressure" and node.get("trend_counts"):
        tc = node["trend_counts"]
        node["dominant_trend"] = max(tc, key=tc.get)

model = {
    "meta": {
        "title": "Wales SoNaRR 2025 Fuzzy Cognitive Map",
        "source": "SoNaRR 2025 (NRW), 8 Power BI portal spreadsheets, DPSIR structure",
        "sign_convention": "driver->pressure +, pressure->state -, state->service +",
        "weight_note": ("Edge weights are a uniform prior (SoNaRR asserts the link "
                        "but does not rate its strength); confidence sets uncertainty; "
                        "users set the weights."),
        "default_weight": DEFAULT_WEIGHT,
    },
    "nodes": sorted(nodes.values(), key=lambda n: (n["kind"], n["label"])),
    "edges": sorted(edges.values(), key=lambda e: (e["kind"], e["source"], e["target"])),
}

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(model, indent=2, ensure_ascii=False))
# Also emit a global JS so the prototype runs by opening index.html directly
# (no dev server / no fetch / no CORS issues from file://).
(OUT.parent / "model.js").write_text(
    "// AUTO-GENERATED by scripts/extract_graph.py - do not edit by hand.\n"
    "window.SONARR_MODEL = " + json.dumps(model, ensure_ascii=False) + ";\n"
)

# ---- summary ----------------------------------------------------------------
from collections import Counter
kc = Counter(n["kind"] for n in model["nodes"])
ec = Counter(e["kind"] for e in model["edges"])
print("Wrote", OUT)
print("nodes:", dict(kc), "total", len(model["nodes"]))
print("edges:", dict(ec), "total", len(model["edges"]))
print("\nStates with initial levels:")
for n in model["nodes"]:
    if n["kind"].startswith("state"):
        print("  %4.2f  %-28s (%d rows)" % (n.get("initial", 0), n["label"], n.get("n_state_rows", 0)))
print("\nPressure trend tally (baseline story):")
tt = Counter()
for n in model["nodes"]:
    if n["kind"] == "pressure":
        for k, v in n.get("trend_counts", {}).items():
            tt[k] += v
for k, v in tt.most_common():
    print("  %3d  %s" % (v, k))
