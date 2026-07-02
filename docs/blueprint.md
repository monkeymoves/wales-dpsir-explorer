# Wales Systems Simulator: blueprint

*A playable causal model of Wales, built from SoNaRR 2025. Working name only.*
*Status: scoping prototype. This is a thinking tool, not a forecast.*

---

## 1. Why this exists

Wales has strong environmental law (Well-being of Future Generations Act, Environment Act) and a candid evidence base (SoNaRR 2025) showing nature in decline: of the pressures SoNaRR assesses on ecosystems, **160 are "deteriorating" and only 28 "improving"**. What is missing is a way for people, from NRW and Welsh Government analysts to workshop participants and the public, to *feel* how the parts connect: pull one lever, watch the system respond, and see where the leverage really is.

The long-run ambition is a Limits-to-Growth-style dynamic model of Wales. This v1 takes the most defensible first step: it turns SoNaRR's own causal assessment into a model you can run, because (a) Luke has authority over that data, (b) it is expert-validated and current (Dec 2025), and (c) it needs no external dependency. FABLE's quantitative land/food/carbon work stays on the roadmap as a later module.

## 2. What was built (prototype)

A static, dependency-light web app (`/prototype`):

1. **Baseline "State of Wales" dashboard** - 11 ecosystem/resource states with their SoNaRR-assessed condition, a baseline marker, and an **uncertainty band** (see 3.3).
2. **Interactive causal graph** - 42 nodes, 162 links, laid out in DPSIR order (drivers → pressures → states → services). Click a node to isolate what affects it and what it delivers. When you act, the affected pathway **lights up green/red and the changed nodes get a coloured ring**, so the cascade is visible rather than hidden.
3. **Intervention bundles (the main levers)** - ~8 plain-language actions ("Cleaner, healthier water", "Sustainable farming & less pollution", "Restore peatland & uplands"...), each an intensity slider that eases several underlying SoNaRR pressures. A "show all parameters (advanced)" toggle exposes the raw 28 driver/pressure sliders for power users, kept in sync with the bundles.
4. **Differentiated response** - the model is faithful (baseline = SoNaRR exactly), so interventions move ecosystems by different amounts; the biggest movers are flagged. E.g. "Sustainable farming" moves Air most (ammonia/air pollution is largely agricultural in Wales), Marine barely at all.
5. **Leverage analysis** - "if this single pressure/driver were relieved, total gain across all states", recomputed live. Top baseline levers are Land-and-sea-use change, Pollution and Climate change, matching SoNaRR's narrative.
6. **Inspect a contested link** - click a link to see its SoNaRR evidence text and confidence, adjust its strength (your prior); pinning it **narrows the output uncertainty bands**.

Bilingual EN/CY shell and shareable scenario links (URL-encoded) are in.

## 3. How the model works

### 3.1 Data → graph (`scripts/extract_graph.py`)

The 8 SoNaRR portal spreadsheets are DPSIR-structured expert assessments. The extractor turns them into a typed graph:

| SoNaRR content | Becomes |
|---|---|
| Direct drivers (5), pressures (23) | Driver and pressure nodes |
| Ecosystems (8) + natural resources (3) | State nodes |
| Ecosystem service types (3) | Service nodes |
| Driver→pressure→state→service links | Directed edges |
| "Assessment of state" (Low/Med/High) | Initial state activation |
| "Confidence assessment overall" | Edge confidence (→ uncertainty) |
| "Assessment of trend of pressure" | Node metadata (the 160-vs-28 headline) |
| "Relative importance" (impacts) | State→service edge weight |

**The honest bit.** SoNaRR names the key pressures and rates confidence and trend, but does **not** publish a numeric strength for each causal link (the relevance field is narrative). So edge weights start from a **uniform prior** - SoNaRR asserts the link matters, not how much - and the user sets them. This is not a gap to hide; it *is* the "contested priors" principle. We refuse to invent strengths SoNaRR never stated.

**Sign convention** (documented, user-overridable): driver → pressure `+`, pressure → state `−`, state → service `+`.

### 3.2 Engine (`prototype/fcm.js`)

A Fuzzy Cognitive Map: `A_j = sigmoid( λ · Σ_i Wn[i][j]·A_i + bias_j )`.

- **Normalised influence** (`Wn`): incoming weights per node sum to 1, so a state with ten pressures is not saturated and each intervention moves the outcome by a visible, proportionate amount.
- **Exogenous roots held**: drivers (no incoming edges) stay at their input value.
- **Bias-anchoring**: each node's bias is calibrated so that, at baseline, the model reproduces SoNaRR's assessed state exactly. Interventions then show computed **deviations from the SoNaRR baseline**. This is the key design choice: the baseline is the data; the dynamics are the model.

The graph is effectively a DAG (no feedback cycles yet), so it converges in a few iterations. The engine is ~140 lines, dependency-free, and unit-tested (`scripts/test_fcm.js`): baseline convergence, range bounds, face validity (relieving pollution improves states; worsening it does the opposite), leverage sanity, and fan-band ordering.

**Response magnitude (λ).** The squashing slope λ controls how far interventions swing. It was raised from 2 to 4: baseline fidelity is unaffected (the bias re-anchors at any λ), but a strong action now moves an ecosystem ~0.15 rather than ~0.07, and removing all pressure lifts ecosystems to ~0.8-0.9 rather than ~0.6-0.8. This is the "faithful but more punchy" dial.

**Graph as a Sankey (d3-sankey).** A node-link diagram of 162 dense many-to-many links is a hairball in any layout. DPSIR is a staged left-to-right flow (Driver → Pressure → State → Service), so the centre is drawn as a **Sankey**: ribbons flow one direction and bundle at nodes, reading as an orderly river. At rest ribbons are a faint wash; hover or select a node and its ribbons light up (dashed-coral degrading in, solid-teal supporting out) while everything else dims. Node labels sit in the emptier flow gaps; column headers give DPSIR orientation. Scenario impact shows on the state nodes (condition fill + change ring), never by lighting all ribbons.

**Accessibility (colour is never the sole cue — WCAG 1.4.1).** Valence is triple-encoded: causal links use arrow SHAPE (triangle = supports, tee/bar = degrades), line STYLE (solid vs dashed), and hue (teal vs coral) only as a third, redundant channel. Change on the outputs shows a ▲/▼ glyph and +/- sign alongside colour, and node change-rings are solid (improved) vs dashed (declined). State-condition fill uses a single-hue lightness ramp (value read by brightness), not a red↔green diverging ramp. This matters for a public Welsh tool: ~8% of men have red-green colour vision deficiency.

### 3.3 Uncertainty on the outputs

Every state bar carries a p10-p90 band from an ensemble that perturbs all edge weights across the spread implied by their SoNaRR confidence. Links the user **pins** (sets a prior for) carry no spread, so pinning visibly narrows the bands.

**Design subtlety worth recording:** the L1 normalisation that makes the sliders responsive also *cancels* per-link weight uncertainty at baseline, because when every incoming edge to a state shares a sign and the sources sit at equal values, the normalised weighted sum is invariant to how weight is distributed among the links. The fix is to apply the ensemble perturbation **additively, without re-normalising**, so individual link uncertainty survives. This is the kind of tension (responsiveness vs faithful uncertainty) that a later formal Bayesian treatment would need to handle properly.

There is also a per-link **fan** in the inspector: the selected link's weight is swept across its confidence range and the target's settling trajectory drawn as p10/p50/p90 bands.

## 4. Landscape and positioning

| Tool | What it is | What we take / why we differ |
|---|---|---|
| **En-ROADS / C-ROADS** (Climate Interactive + MIT) | Gold-standard climate facilitation simulator | Copy the sliders-to-systemic-feedback workshop UX; we are Wales-specific and nature-first |
| **Insight Maker** + `scottfr/simulation` | Free, open-source browser system-dynamics engine | Our route to the later quantitative (stock-and-flow) module; not needed for the FCM v1 |
| **Mental Modeler** | FCM participatory environmental modelling tool | Validates the DPSIR+FCM method; we bind it to a specific, authoritative dataset (SoNaRR) with a playful, bilingual, shareable UI |
| **FABLE Consortium** (+ IIASA Public Policy Lab) | Peer-reviewed food/land/GHG pathways; Wales paper 2023 | The quantitative module later; study the Public Policy Lab before building it |
| **MacKay 2050 calculator** | Transparent energy/emissions lever design | Lever-transparency inspiration; deliberately *not* building an energy calculator |

**The gap we fill:** no existing tool turns Wales's own state-of-nature assessment into a runnable, transparent, stakeholder-playable systems model where every assumption is an editable, sourced prior.

## 5. Roadmap

- **v0.1 (done):** SoNaRR graph extraction, FCM engine, dashboard, graph, scenarios, leverage, edge-inspector fan, bilingual shell, share links.
- **v1:** richer scenario save/load; full Welsh content (portal CYM sheets are largely empty - translation needed); resilience-component drill-down; workshop presentation mode; accessibility pass.
- **Later modules (the modular architecture holds):**
  - **Quantitative FABLE module** on the Insight Maker engine, for numbers on specific arrows (hectares, MtCO2e) once the Wales instance is obtained.
  - **Feedback loops** (e.g. soil condition → yield → land pressure) to move from DAG toward true system dynamics.
  - **People/economy/wellbeing** stocks, badged lower-confidence, toward the Limits-to-Growth ambition.
  - **Bayesian calibration** pipeline (offline) that updates priors from data and ships them back into the app.

## 6. Risks and honesty notes

- **Semi-quantitative, not predictive.** Outputs are directional and relative, never magnitudes in real units. Badge it everywhere.
- **Uniform edge-weight prior** is a modelling choice, not a SoNaRR fact - surfaced in the UI, not buried.
- **Baseline = SoNaRR data by construction**; the model shows deviations from it. Do not read absolute bar values as independent predictions.
- **DAG, not yet cyclic** - no feedback/overshoot until loops are added. The "systems" feel is real but bounded.
- **Welsh language** is currently shell-only; full provision is essential before any public release in Wales.

## 7. Open questions for Luke

- Aggregation level for ecosystem resilience components (legibility vs faithfulness).
- Institutional positioning: personal exploration now, or steer toward NRW / SoNaRR-2029 relevance (which would raise the rigour bar)?
- Hosting and Welsh-language plan.
- A name.
