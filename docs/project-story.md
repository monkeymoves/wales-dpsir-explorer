# Wales DPSIR Explorer: what we built, why, and what to watch

*A plain-language account of the prototype, the decisions behind it, the
trade-offs we accepted, and the problems we hit along the way. Written so you
can read it once and then explain the project to others.*

**Live tool:** https://monkeymoves.github.io/wales-dpsir-explorer/
**Code:** https://github.com/monkeymoves/wales-dpsir-explorer
**Status:** working prototype. A thinking tool, not a forecast.

---

## 1. In one paragraph

We turned SoNaRR 2025's causal picture of Wales into something you can *play
with*. SoNaRR describes how drivers (like climate change and pollution) create
pressures, which change the state of ecosystems, which in turn deliver services
to people. That is a network of cause and effect. We extracted that network,
made it runnable as a simple systems model, and wrapped it in a web tool where
you turn up plain-language actions ("cut agricultural pollution", "restore
peatland") and watch the modelled state of Wales respond, with the uncertainty
shown honestly. It is deliberately semi-quantitative: it shows direction and
relative effect, not hectares or tonnes.

---

## 2. Where it started

The original ambition was broad: a Limits-to-Growth-style model of Wales, or
something in the futures/foresight space, grounded in the natural environment.
We looked hard at three candidate foundations:

- **Limits to Growth (World3)** - the classic whole-system stocks-and-flows
  model. Inspiring, but you own every contested assumption and the "what goes
  in, what stays out" argument starts on day one.
- **The FABLE Consortium's Wales work** - peer-reviewed land/food/carbon/nature
  pathways, with an open calculator. Still current and credible, but it is a
  *static accounting calculator* (set 2050 targets, read off the land use it
  implies), not a dynamic simulation, and the Wales-specific version is a few
  years old and gated behind a data request.
- **SoNaRR 2025** - Natural Resources Wales' own State of Natural Resources
  Report, which you have authority over, is current (Dec 2025), and is
  structured using DPSIR (Drivers, Pressures, State, Impact, Responses).

**The decision that shaped everything: build v1 on SoNaRR alone.** You own the
data, it is expert-validated and current, and it needs no external dependency.
FABLE stays on the roadmap as a later "put real numbers on specific arrows"
module; Limits-to-Growth stays the long-run north star.

---

## 3. What it actually is

### 3.1 From SoNaRR to a runnable network

SoNaRR's DPSIR structure *is* a causal map. The 8 "portal" spreadsheets behind
the report list, for each ecosystem and natural resource, which pressures act on
it, with a confidence rating and a trend. We wrote a script that reads those
spreadsheets and builds a graph:

- **Drivers** (5): climate change, pollution, land and sea use change, etc.
- **Pressures** (23): air pollution, agricultural intensification, drainage,
  invasive species, and so on.
- **State of nature** (11): the 8 ecosystems plus air, soil and water.
- **Services** (3): provisioning, regulating and cultural.
- **162 causal links** between them, each carrying SoNaRR's confidence rating
  and, where stated, the direction of effect.

### 3.2 The honest bit about the numbers

This matters and is worth repeating to anyone who asks: **SoNaRR names the key
links and rates its confidence in them, but it does not publish a number for how
strong each link is.** So we do not invent one. Every link starts from a neutral
default, and the *user* can adjust their belief about it. That is not a weakness
we are hiding, it is the core principle: the tool makes assumptions visible and
adjustable rather than baking hidden numbers in.

The one thing SoNaRR *does* give quantitatively is the assessed **condition** of
each ecosystem (Low / Medium / High) and its **confidence**. Those anchor the
model's baseline and its uncertainty.

### 3.3 The engine

Under the bonnet is a **Fuzzy Cognitive Map** (FCM). This is an established
technique (the reference tool is "Mental Modeler") for exactly this situation:
turning expert, categorical cause-and-effect knowledge into something you can
run, without pretending to a precision the evidence does not support. You nudge
the inputs, and the model settles to a new balance. It is genuine systems
behaviour, honestly badged as semi-quantitative.

The model is calibrated so that, left alone, it reproduces SoNaRR's assessed
state of Wales exactly. When you act, it shows the *deviation* from that
baseline. So the baseline is the data; the movement is the model.

---

## 4. How you use it

There are three things on screen:

1. **Actions** (left) - about eight plain-language interventions, each a slider
   from 0 to 100%. Behind each one it eases several specific SoNaRR pressures.
   There is a "show all parameters" toggle for power users who want the raw 28
   levers.
2. **The map** (centre) - a Sankey flow diagram: drivers to pressures to state
   to services, left to right. At rest it is a calm wash; click or hover any
   node and its links light up (dashed-coral = degrades, solid-teal = supports),
   with everything else dimmed. Scroll to zoom, drag to pan.
3. **State of Wales** (right) - a bar per ecosystem showing modelled condition,
   the SoNaRR baseline marked, and a shaded uncertainty band. Plus a "leverage"
   panel ranking where action does the most good.

**Inspecting a link** opens a panel with SoNaRR's own evidence text and
confidence, a "your prior" slider to strengthen or weaken your belief in that
link, and a small gauge showing the likely outcome for the target with its
uncertainty band. Share links (the "copy share link" button) encode the whole
scenario in the URL, which is handy for workshops.

---

## 5. The honest limitations (the trade-offs)

Be upfront about these when you show it:

- **Semi-quantitative, not predictive.** It shows direction and relative effect.
  It does not output magnitudes in real units. Badge it "thinking tool, not
  forecast" every time.
- **Baseline = SoNaRR by construction.** The absolute bar values are anchored to
  SoNaRR's assessment, not independently predicted. Read the *changes*, not the
  absolute levels, as the model's contribution.
- **It is still a feed-forward chain, not a full feedback system.** Cause flows
  driver to service in one direction. There are no feedback loops or
  overshoot yet, so it is not *quite* Limits-to-Growth behaviour. That is the
  next modelling step.
- **Link strengths are user priors, not SoNaRR facts.** By design. But it means
  two people can get different results from different beliefs, which is the point
  (it makes disagreement visible), not a bug, provided everyone understands it.
- **Welsh language is shell-only.** The interface chrome has a Welsh toggle, but
  the SoNaRR content itself is currently English. Full bilingual provision is
  essential before any public release in Wales and is not done.
- **A single link has limited leverage.** One pressure among a dozen affecting an
  ecosystem genuinely moves it only a little. That is realistic, but it means the
  "leverage" view and the action bundles, not individual links, are where the
  interesting signal is.

---

## 6. Problems we hit, and how we solved them

This section is deliberately candid, because it is the useful part for explaining
what real prototyping looks like.

### 6.1 The recurring maths tension (the big one)

To make the sliders responsive and keep the baseline anchored, the engine
normalises the influence coming into each node. That normalisation has a
side-effect: it *cancels out* the effect of changing any single link when all the
links into a node point the same way. This bit us **three separate times**:

- the uncertainty bands on the output bars initially showed zero width;
- the per-link "prior" slider initially did nothing;
- and a related version of it made early interventions feel muted.

Each time the fix was the same idea: apply the change *additively* rather than
letting the normalisation wash it out. Worth remembering: it is the fundamental
trade-off in this style of model. Normalisation buys responsiveness and a stable
baseline, but it hides single-link effects unless you deliberately work around
it.

### 6.2 "Nothing moves the needle"

Early on, even strong actions barely shifted the bars. The cause was the same
baseline-anchoring maths capping the range. The fix was a single tuning
parameter (the "slope" of the model's response). Raising it roughly doubled the
visible effect with no loss of baseline accuracy, so a real action now clearly
moves ecosystems, and removing all pressure gets them close to "good".

### 6.3 The graph looked terrible (several rounds)

This took the most iteration and honest push-back. We went through:

- a **node-and-line diagram** that was an unreadable hairball with 162 links;
- hiding the lines, which just left floating dots;
- a dark "control room" theme (striking, but you preferred light);
- and finally the realisation that a **Sankey flow diagram is the right picture**
  for a staged left-to-right process like DPSIR. Ribbons flow one way and bundle
  at nodes, so it reads as an orderly river instead of spaghetti.

The lesson, which recurs, is: *pick the visualisation that matches how the data
actually behaves*, rather than forcing a familiar chart onto it.

### 6.4 Accessibility: red/green was wrong

We initially distinguished "supports" from "degrades" links using red and green
only. About 8% of men have red-green colour blindness, so colour must never be
the only cue. Fixed properly: links now differ by **line style** (solid vs
dashed) and **arrowhead shape** as well as colour, the output bars use direction
arrows and +/- signs, and the condition scale uses brightness rather than a
red-to-green ramp. This is now a documented design principle in the code.

### 6.5 The "fan" that wasn't a fan

The link-inspector had an "uncertainty fan" chart that, because the model settles
instantly, was really just a flat line sliding up and down, while the label
promised a widening band. Misleading. We replaced it with a horizontal gauge:
a "poorer to healthier" axis with the SoNaRR baseline marked, a marker that
slides as you set your prior, and a band whose *width* is the uncertainty.
Label now matches reality.

### 6.6 The caching gremlin

At one point you saw an old version of the layout even after reloading, and it
looked like a design regression. It was actually your browser caching the old
stylesheet. We added version tags to the files so a normal reload always fetches
the latest. If anything ever looks stale, a hard refresh (Cmd+Shift+R) clears it.

### 6.7 GitHub Pages first-deploy failures

Publishing the site failed twice with "Deployment failed, try again later"
before succeeding on the third attempt. This was not a configuration problem, it
is well-documented flakiness when GitHub provisions a brand-new Pages site for
the first time. Subsequent deploys work cleanly.

---

## 7. What is not done (the roadmap)

- **Feedback loops** - move from a one-way chain toward true system dynamics
  (e.g. soil condition affecting yields affecting land pressure). This is the
  step toward the Limits-to-Growth ambition.
- **A quantitative FABLE module** - to put real numbers (hectares, emissions) on
  specific arrows when needed.
- **Full Welsh-language content**, not just interface chrome.
- **People, economy and wellbeing** as additional, clearly-badged modules.
- **Formal calibration** - updating the link priors from data as evidence
  arrives (a Bayesian-style pipeline), rather than relying on defaults.

---

## 8. How to run, share and iterate

- **Use it:** just open the live link above. Nothing to install.
- **Share a scenario:** set up an interesting scenario, click "copy share link",
  paste the URL. It reproduces exactly what you set.
- **Iterate and re-publish:** edit files in `prototype/`, then from the project
  folder run `git add -A && git commit -m "..." && git push`. Every push
  auto-rebuilds the live site within a minute or two (via GitHub Actions).
- **Run locally:** serve the `prototype/` folder with any static server, or open
  `index.html` directly (it needs internet for the charting library and fonts).
- **Re-run the model extraction:** `python3 scripts/extract_graph.py` (needs the
  SoNaRR portal spreadsheets, which are kept out of the public repo).

---

## 9. Credits and provenance

- **Evidence base:** *State of Natural Resources Report (SoNaRR) 2025*, Natural
  Resources Wales. All causal structure, confidence ratings and baseline
  conditions derive from SoNaRR's DPSIR assessment.
- **Method:** DPSIR combined with Fuzzy Cognitive Mapping, an established
  approach for participatory, semi-quantitative environmental modelling.
- **Nature of the tool:** a prototype and a thinking aid. It is explicitly not a
  forecast, an official NRW product, or a substitute for SoNaRR itself.
