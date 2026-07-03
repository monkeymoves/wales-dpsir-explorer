# Wales DPSIR Explorer

**A playable causal model of Wales, built from SoNaRR 2025 (Natural Resources Wales).**
Turn up plain-language actions, watch the modelled state of Wales respond, and see
where action does the most good. Semi-quantitative: it shows direction and relative
effect, not magnitudes. **A thinking tool, not a forecast.**

- **Live tool:** https://monkeymoves.github.io/wales-dpsir-explorer/
- **What we built and why (read this first):** [`docs/project-story.md`](docs/project-story.md)
- **Full design rationale and roadmap:** [`docs/blueprint.md`](docs/blueprint.md)

> This is a personal prototype and a thinking aid. It is **not** an official NRW
> product, not a forecast, and not a substitute for SoNaRR itself.

## What it does

- **Actions** - ~8 plain-language interventions (cut agricultural pollution,
  restore peatland, etc.), each easing several underlying SoNaRR pressures. A
  "show all parameters" toggle exposes the raw levers.
- **The map** - a Sankey flow of Drivers to Pressures to State of nature to
  Services. Click or hover any node to isolate its links (dashed = degrades,
  solid = supports). Scroll to zoom, drag to pan.
- **State of Wales** - modelled condition per ecosystem, SoNaRR baseline marked,
  with an uncertainty band; plus a leverage ranking.
- **Inspect a link** - SoNaRR's own evidence and confidence, an editable "prior"
  for your belief in that link, and an uncertainty gauge.
- Shareable scenario links; EN/CY interface (content is English for now).

## How it works, briefly

SoNaRR's DPSIR structure is a cause-and-effect network. We extract it from the 8
SoNaRR portal spreadsheets into a graph (5 drivers, 23 pressures, 11 states, 3
services, 162 links), then run it as a **Fuzzy Cognitive Map** - an established
method for semi-quantitative, expert-knowledge modelling. SoNaRR names the links
and rates confidence but does not publish link strengths, so those start from a
neutral default and are user-adjustable. The baseline reproduces SoNaRR's
assessed state exactly; the model shows deviations from it. See
[`docs/project-story.md`](docs/project-story.md) for the honest, full account.

## Run and iterate

```bash
# serve locally (needs internet for the d3 charting library + fonts)
python3 -m http.server 5173 --directory prototype
# open http://127.0.0.1:5173

# run the engine sanity tests (needs node)
node scripts/test_fcm.js

# regenerate the model from the SoNaRR spreadsheets (needs: pip install openpyxl,
# plus the SoNaRR portal .xlsx files, which are not committed - see below)
python3 scripts/extract_graph.py
```

Publishing is automatic: push to `main` and the GitHub Actions workflow
(`.github/workflows/pages.yml`) redeploys the `prototype/` folder to the live URL.

## Layout

```
prototype/        the web app (index.html, styles.css, app.js, fcm.js, model.js)
scripts/          extract_graph.py (model builder), test_fcm.js (engine tests)
docs/             project-story.md (the narrative), blueprint.md (design)
```

## Data and provenance

Causal structure, confidence ratings and baseline conditions derive from the
**State of Natural Resources Report (SoNaRR) 2025, Natural Resources Wales**. The
raw SoNaRR portal spreadsheets and the full report PDF are **not** committed to
this repo (they are NRW-published data); download them from the NRW SoNaRR 2025
portal if you need to re-run extraction. The committed `prototype/model.js` is the
derived graph the app uses.

Method: DPSIR + Fuzzy Cognitive Mapping. Built as an exploratory prototype.
