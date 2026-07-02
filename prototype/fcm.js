// Fuzzy Cognitive Map engine for the Wales SoNaRR model.
// Pure, dependency-free. Works as a classic <script> (exposes window.FCM)
// and under Node (module.exports) so it can be unit-tested headlessly.
//
// Update rule (modified Kosko, with self-memory):
//   A_j(t+1) = squash( A_j(t) + sum_i W[i][j] * A_i(t) )
// where W[i][j] = edge.sign * edge.weight for edge i -> j.
// Clamped nodes (scenario interventions) are pinned each iteration.

const FCM = (function () {
  const LAMBDA = 4.0; // slope of the squashing function (higher = interventions swing more)
  function sigmoid(x) {
    return 1 / (1 + Math.exp(-x));
  }
  function logit(y) {
    const c = Math.min(0.98, Math.max(0.02, y));
    return Math.log(c / (1 - c));
  }

  // Build an index + dense weight matrix from a model {nodes, edges}.
  // We keep the raw signed matrix AND a per-target normalised matrix (so the
  // total incoming influence on a node sums to 1). Normalisation stops nodes
  // with many incoming pressures from saturating, and makes each intervention
  // move the outcome by a visible, proportionate amount.
  function compile(model, lambdaOpt) {
    const LAM = lambdaOpt != null ? lambdaOpt : LAMBDA;
    const ids = model.nodes.map((n) => n.id);
    const index = new Map(ids.map((id, i) => [id, i]));
    const n = ids.length;
    const W = Array.from({ length: n }, () => new Float64Array(n));
    for (const e of model.edges) {
      const i = index.get(e.source);
      const j = index.get(e.target);
      if (i == null || j == null) continue;
      W[i][j] += (e.sign || 1) * (e.weight || 0);
    }
    // per-target L1 normalisation
    const inAbs = new Float64Array(n);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) inAbs[j] += Math.abs(W[i][j]);
    const Wn = Array.from({ length: n }, () => new Float64Array(n));
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) Wn[i][j] = inAbs[j] > 0 ? W[i][j] / inAbs[j] : 0;
    const initial = new Float64Array(n);
    model.nodes.forEach((nd, i) => (initial[i] = nd.initial != null ? nd.initial : 0.5));
    // Per-node bias that anchors the baseline: with every node at its initial
    // value, output(j) == initial(j). Interventions then move outputs around
    // this SoNaRR-calibrated anchor. Exogenous nodes (no incoming edges) are
    // held at their input value and need no bias.
    const bias = new Float64Array(n);
    for (let j = 0; j < n; j++) {
      if (inAbs[j] === 0) continue;
      let inflow = 0;
      for (let i = 0; i < n; i++) inflow += Wn[i][j] * initial[i];
      bias[j] = logit(initial[j]) - LAM * inflow;
    }
    return { ids, index, n, W, Wn, inAbs, initial, bias, nodes: model.nodes, lambda: LAM };
  }

  // Run to convergence. opts: { clamps:{id:value}, weightOverride:{ "src|dst":signedWeight },
  // maxIter, eps, record }. Returns { activation:Float64Array, iters, converged, trace }.
  // Update: exogenous nodes (no incoming edges) held at input; others
  //   A_j = sigmoid( lambda * sum_i Wn[i][j] A_i + bias_j ).
  function run(compiled, opts = {}) {
    const { n, Wn, inAbs, initial, bias, index, lambda } = compiled;
    const maxIter = opts.maxIter || 200;
    const eps = opts.eps || 1e-6;
    const clamps = opts.clamps || {};
    const clampIdx = new Map();
    for (const id in clamps) if (index.has(id)) clampIdx.set(index.get(id), clamps[id]);

    // Per-edge PRIOR override. The user's slider value v is in [0,1] with 0.5 =
    // SoNaRR default. Applied ADDITIVELY on the normalised weight (NOT renormalised)
    // so it survives the L1 normalisation instead of being cancelled by it - the
    // same reason the uncertainty ensemble is additive. delta = sign*(v-0.5)*GAIN.
    const PRIOR_GAIN = 0.4;
    let WnUse = Wn;
    if (opts.weightOverride && Object.keys(opts.weightOverride).length) {
      WnUse = Wn.map((row) => Float64Array.from(row));
      for (const kkey in opts.weightOverride) {
        const [s, d] = kkey.split("|");
        const i = index.get(s), j = index.get(d);
        if (i == null || j == null) continue;
        const v = opts.weightOverride[kkey];
        const sign = Wn[i][j] >= 0 ? 1 : -1;
        WnUse[i][j] = Wn[i][j] + sign * (v - 0.5) * PRIOR_GAIN;
      }
    }

    // Additive perturbation (uncertainty ensemble). Applied AFTER normalisation,
    // deliberately without renormalising, so individual edge uncertainty is not
    // washed out when all incoming edges share a sign. Keys are "src|dst".
    if (opts.noise && Object.keys(opts.noise).length) {
      if (WnUse === Wn) WnUse = Wn.map((row) => Float64Array.from(row));
      for (const kkey in opts.noise) {
        const [s, d] = kkey.split("|");
        const i = index.get(s), j = index.get(d);
        if (i != null && j != null) WnUse[i][j] += opts.noise[kkey];
      }
    }

    let A = Float64Array.from(opts.start || initial);
    for (const [i, v] of clampIdx) A[i] = v;
    const trace = opts.record ? [Float64Array.from(A)] : null;

    let iters = 0, converged = false;
    for (; iters < maxIter; iters++) {
      const next = new Float64Array(n);
      let maxDelta = 0;
      for (let j = 0; j < n; j++) {
        if (clampIdx.has(j)) { next[j] = clampIdx.get(j); continue; }
        if (inAbs[j] === 0) { next[j] = A[j]; continue; } // exogenous: hold input
        let sum = 0;
        for (let i = 0; i < n; i++) sum += WnUse[i][j] * A[i];
        next[j] = sigmoid(lambda * sum + bias[j]);
        const d = Math.abs(next[j] - A[j]);
        if (d > maxDelta) maxDelta = d;
      }
      A = next;
      if (opts.record) trace.push(Float64Array.from(A));
      if (maxDelta < eps) { converged = true; iters++; break; }
    }
    return { activation: A, iters, converged, trace };
  }

  // Baseline (no intervention) run.
  function baseline(compiled, opts = {}) {
    return run(compiled, opts);
  }

  // Leverage: for each driver/pressure, clamp it low and measure total change
  // in ecosystem/resource STATE activation vs baseline. Positive = relieving it
  // improves states. Returns sorted array [{id,label,kind,delta}].
  function leverage(compiled, opts = {}) {
    const base = run(compiled, opts).activation;
    const stateIdx = compiled.nodes
      .map((nd, i) => [nd, i])
      .filter(([nd]) => nd.kind === "state_ecosystem" || nd.kind === "state_resource");
    const relieveTo = opts.relieveTo != null ? opts.relieveTo : 0.1;
    const out = [];
    for (const nd of compiled.nodes) {
      if (nd.kind !== "driver" && nd.kind !== "pressure") continue;
      const res = run(compiled, { ...opts, clamps: { ...(opts.clamps || {}), [nd.id]: relieveTo } });
      let delta = 0;
      for (const [, i] of stateIdx) delta += res.activation[i] - base[i];
      out.push({ id: nd.id, label: nd.label, kind: nd.kind, delta });
    }
    out.sort((a, b) => b.delta - a.delta);
    return out;
  }

  // Ensemble over one edge's weight to produce an uncertainty fan on a target
  // node's trajectory. Weight sampled ~ mean(edge signed weight) with spread
  // derived from (1 - confidence). Returns { steps, bands:{p10,p50,p90}, samples }.
  function ensembleEdge(compiled, edge, targetId, opts = {}) {
    const samples = opts.samples || 60;
    const steps = opts.steps || 25;
    const spread = opts.spread != null ? opts.spread : (1 - (edge.confidence != null ? edge.confidence : 0.6)) * 0.8;
    const key = edge.source + "|" + edge.target;
    // Sweep in PRIOR-value space [0,1] centred on the user's chosen prior (0.5 =
    // default), so the fan visibly shifts as they drag the link-strength slider.
    const ov = opts.weightOverride && opts.weightOverride[key];
    const centerV = ov != null ? ov : 0.5;
    const tIdx = compiled.index.get(targetId);
    // Start from a neutral vector (non-exogenous nodes at 0.5) so the trace shows
    // the system SETTLING to equilibrium; the band width then reveals how much
    // this one contested link changes where things settle.
    const start = Float64Array.from(compiled.initial);
    for (let i = 0; i < compiled.n; i++) if (compiled.inAbs[i] > 0) start[i] = 0.5;
    const seriesList = [];
    for (let s = 0; s < samples; s++) {
      // deterministic spread across [-1,1] * spread around centre (no RNG: stable)
      const frac = samples === 1 ? 0 : (s / (samples - 1)) * 2 - 1;
      let w = centerV + frac * spread;
      w = Math.max(0, Math.min(1, w));
      const res = run(compiled, {
        ...opts,
        weightOverride: { [key]: w },
        start,
        record: true,
        maxIter: steps,
        eps: 0,
      });
      const series = res.trace.map((a) => a[tIdx]);
      while (series.length < steps + 1) series.push(series[series.length - 1]);
      seriesList.push(series.slice(0, steps + 1));
    }
    const bands = { p10: [], p50: [], p90: [] };
    for (let t = 0; t <= steps; t++) {
      const col = seriesList.map((s) => s[t]).sort((a, b) => a - b);
      const q = (p) => col[Math.min(col.length - 1, Math.floor(p * (col.length - 1)))];
      bands.p10.push(q(0.1));
      bands.p50.push(q(0.5));
      bands.p90.push(q(0.9));
    }
    return { steps, bands, samples: seriesList };
  }

  // Small seeded PRNG so uncertainty bands are stable across recomputes.
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Ensemble over ALL edge weights, each sampled across the spread implied by
  // its SoNaRR confidence, to produce a p10/p50/p90 band per state node.
  // Edges the user has PINNED (weightOverride) carry no spread, so pinning a
  // link visibly narrows the bands. Perturbation table is cached for stability.
  function ensembleStates(compiled, model, opts = {}) {
    const samples = opts.samples || 30;
    const spreadScale = opts.spreadScale != null ? opts.spreadScale : 0.06;
    const edges = model.edges;
    if (!compiled._ptab || compiled._ptab.samples !== samples) {
      const rnd = mulberry32(1234567);
      const tab = [];
      for (let s = 0; s < samples; s++) {
        const row = new Float64Array(edges.length);
        for (let e = 0; e < edges.length; e++) row[e] = rnd() * 2 - 1;
        tab.push(row);
      }
      compiled._ptab = { samples, tab };
    }
    const tab = compiled._ptab.tab;
    const pinned = opts.weightOverride || {};
    const NOISE = spreadScale; // magnitude of additive weight noise at zero confidence
    const stateNodes = model.nodes.filter((n) => n.kind.indexOf("state") === 0);
    const series = stateNodes.map(() => []);
    for (let s = 0; s < samples; s++) {
      const noise = {};
      for (let e = 0; e < edges.length; e++) {
        const ed = edges[e];
        const key = ed.source + "|" + ed.target;
        if (pinned[key] != null) continue; // pinned = certain, no spread
        const spread = (1 - (ed.confidence != null ? ed.confidence : 0.6)) * NOISE;
        noise[key] = (ed.sign || 1) * tab[s][e] * spread;
      }
      const act = run(compiled, { clamps: opts.clamps, weightOverride: pinned, noise }).activation;
      stateNodes.forEach((n, i) => series[i].push(act[compiled.index.get(n.id)]));
    }
    const out = {};
    stateNodes.forEach((n, i) => {
      const col = series[i].sort((a, b) => a - b);
      const q = (p) => col[Math.min(col.length - 1, Math.floor(p * (col.length - 1)))];
      out[n.id] = { p10: q(0.1), p50: q(0.5), p90: q(0.9) };
    });
    return out;
  }

  return { sigmoid, compile, run, baseline, leverage, ensembleEdge, ensembleStates };
})();

if (typeof window !== "undefined") window.FCM = FCM;
if (typeof module !== "undefined") module.exports = FCM;
