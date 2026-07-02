# Wales Systems Simulator (working name)

A playable causal model of Wales, built from **SoNaRR 2025**. Pull a lever, watch
the system settle, see where the leverage is. A thinking tool, not a forecast.

See [`docs/blueprint.md`](docs/blueprint.md) for the full rationale, model design,
landscape review and roadmap.

## Layout

```
WALES/
  SoNaRR2025 Portal - *.xlsx      # 8 DPSIR source spreadsheets (inputs)
  SoNaRR_navigation_map.md        # report structure + GBF crib
  scripts/
    extract_graph.py              # spreadsheets -> prototype/model.json + model.js
    test_fcm.js                   # headless engine sanity tests (node)
    serve.py                      # static server (project copy)
  prototype/
    index.html  styles.css  app.js
    fcm.js                        # Fuzzy Cognitive Map engine (dependency-free)
    model.json / model.js         # generated graph (do not hand-edit)
  docs/blueprint.md
```

## Run it

The app runs from a static server (it also works opened directly, since the model
is inlined as `model.js`; the causal graph uses Cytoscape from a CDN).

```bash
# regenerate the model from the spreadsheets (needs: pip install openpyxl)
python3 scripts/extract_graph.py

# run the engine tests (needs node)
node scripts/test_fcm.js

# serve locally
python3 -m http.server 5173 --directory prototype
# then open http://127.0.0.1:5173
```

## What's in the prototype

- **State of Wales dashboard** - 11 ecosystem/resource states at SoNaRR-assessed condition.
- **Causal graph** - 42 nodes / 162 links in DPSIR order; click to isolate.
- **Scenarios** - drag drivers/pressures; outputs settle live.
- **Leverage** - which single pressure/driver relieved gains the most, recomputed live.
- **Inspect a link** - real SoNaRR evidence + confidence, an editable prior, and an uncertainty fan.
- Bilingual EN/CY shell; shareable scenario links.

## Honesty notes

Semi-quantitative and directional, never magnitudes in real units. Edge weights
start from a uniform prior (SoNaRR asserts the link, not its strength) and are
user-editable. The baseline reproduces SoNaRR's data by construction; the model
shows deviations from it.
