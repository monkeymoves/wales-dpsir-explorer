// Wales Systems Simulator - UI wiring for the SoNaRR Fuzzy Cognitive Map.
// DOM is built with safe element APIs (no innerHTML interpolation).
(function () {
  "use strict";
  const MODEL = window.SONARR_MODEL;
  const compiled = FCM.compile(MODEL);
  const LAMBDA = 1.0;
  const SVGNS = "http://www.w3.org/2000/svg";

  // ---- tiny DOM helpers ----------------------------------------------------
  function el(tag, attrs, kids) {
    const e = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      if (k === "class") e.className = attrs[k];
      else if (k === "text") e.textContent = attrs[k];
      else if (k.startsWith("on")) e.addEventListener(k.slice(2), attrs[k]);
      else if (k === "style") e.setAttribute("style", attrs[k]);
      else if (k.startsWith("data-")) e.setAttribute(k, attrs[k]);
      else e[k] = attrs[k];
    }
    (kids || []).forEach((c) => e.appendChild(c));
    return e;
  }
  function sv(tag, attrs) {
    const e = document.createElementNS(SVGNS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }
  const clear = (node) => { while (node.firstChild) node.removeChild(node.firstChild); };
  // fill a range input's track green up to the thumb, so it reads clearly as a slider
  function fillSlider(input, frac) {
    const p = Math.round(Math.max(0, Math.min(1, frac)) * 100);
    input.style.background = "linear-gradient(90deg, var(--state) 0%, var(--state) " + p + "%, var(--paper-2) " + p + "%, var(--paper-2) 100%)";
  }

  const KIND_COLOR = {
    driver: "#a488d6", pressure: "#e6795a",
    state_ecosystem: "#56c08a", state_resource: "#56c08a", service: "#e7b53c",
  };
  // [top, bottom] for bold vertical node gradients
  const KIND_GRAD = {
    driver: ["#9b74e8", "#7b52d0"], pressure: ["#f47a56", "#e8552f"],
    state_ecosystem: ["#3cc27e", "#12995a"], state_resource: ["#3cc27e", "#12995a"],
    service: ["#f0be4a", "#e0a017"],
  };
  // Valence is encoded THREE ways so it never relies on colour alone (WCAG 1.4.1):
  //  - arrow SHAPE: triangle = supports/amplifies, tee (bar) = degrades/inhibits
  //  - line STYLE: solid = supports, dashed = degrades
  //  - HUE (secondary): teal = supports, coral = degrades
  const EDGE_NEG = "#e8552f", EDGE_POS = "#0c9db3";
  const COL_X = { driver: 50, pressure: 340, state_ecosystem: 720, state_resource: 720, service: 960 };
  const PRESS_GAP = 160;
  const COL_HEADERS = [
    { id: "_h_driver", x: COL_X.driver, key: "col-drivers" },
    { id: "_h_pressure", x: COL_X.pressure + PRESS_GAP / 2, key: "col-pressures" },
    { id: "_h_state", x: COL_X.state_ecosystem, key: "col-state" },
    { id: "_h_service", x: COL_X.service, key: "col-services" },
  ];

  // ---- i18n (UI chrome; SoNaRR content stays English for now) --------------
  const I18N = {
    en: {
      title: "Wales Systems Simulator",
      subtitle: "A playable causal model of Wales, built from SoNaRR 2025 (DPSIR) - a thinking tool, not a forecast",
      headline: "pressures assessed as deteriorating",
      levers: "Levers", "levers-hint": "Drag a driver or pressure. The model settles to a new state. Baseline is marked.",
      actions: "Actions", "actions-hint": "Turn up an action. The model settles to a new state; the graph shows the cascade.",
      "show-advanced": "Show all parameters (advanced)", "hide-advanced": "Hide advanced parameters",
      reset: "Reset to baseline", share: "Copy share link",
      inspect: "Inspect a causal link", confidence: "SoNaRR confidence:", strength: "Link strength (your prior)",
      "fan-note": "Green bar = likely outcome given your prior. Shaded band = uncertainty from SoNaRR's confidence (wider = less certain). Dashed line = SoNaRR baseline.",
      outcomes: "State of Wales (model output)", "outcomes-hint": "Higher = better. Marker = baseline; shaded band = uncertainty from SoNaRR confidence.",
      leverage: "Leverage: where to act", "leverage-hint": "If this single pressure/driver were relieved, total gain across all states. Recomputed live.",
      "graph-hint": "Click a node or link to inspect. Scroll to zoom, drag to pan.",
      "k-driver": "Driver", "k-pressure": "Pressure", "k-state": "Ecosystem / resource state", "k-service": "Ecosystem service",
      drivers_h: "Direct drivers", pressures_h: "Key pressures",
      "col-drivers": "Drivers", "col-pressures": "Pressures", "col-state": "State of nature", "col-services": "Services",
      "leg-supports": "supports ▶", "leg-degrades": "degrades ⊢",
    },
    cy: {
      title: "Efelychydd Systemau Cymru",
      subtitle: "Model achosol chwaraeadwy o Gymru, o SoNaRR 2025 (DPSIR) - teclyn meddwl, nid rhagolwg",
      headline: "o bwysau yn dirywio",
      levers: "Liferau", "levers-hint": "Llusgwch sbardun neu bwysau. Bydd y model yn setlo i gyflwr newydd. Nodir y llinell sylfaen.",
      actions: "Camau gweithredu", "actions-hint": "Cynyddwch gam. Bydd y model yn setlo i gyflwr newydd; mae'r graff yn dangos y rhaeadr.",
      "show-advanced": "Dangos pob paramedr (uwch)", "hide-advanced": "Cuddio paramedrau uwch",
      reset: "Ailosod", share: "Copio dolen rannu",
      inspect: "Archwilio cyswllt achosol", confidence: "Hyder SoNaRR:", strength: "Cryfder y cyswllt (eich rhagdyb)",
      "fan-note": "Bar gwyrdd = canlyniad tebygol yn ol eich rhagdyb. Band = ansicrwydd o hyder SoNaRR (lletach = llai sicr). Llinell doredig = llinell sylfaen SoNaRR.",
      outcomes: "Cyflwr Cymru (allbwn y model)", "outcomes-hint": "Uwch = gwell. Marc = llinell sylfaen; band = ansicrwydd o hyder SoNaRR.",
      leverage: "Trosoledd: ble i weithredu", "leverage-hint": "Pe bai'r pwysau/sbardun hwn yn cael ei leddfu, cyfanswm yr ennill ar draws pob cyflwr. Ailgyfrifir yn fyw.",
      "graph-hint": "Cliciwch nod neu gyswllt i archwilio. Sgroliwch i chwyddo, llusgwch i symud.",
      "k-driver": "Sbardun", "k-pressure": "Pwysau", "k-state": "Cyflwr ecosystem / adnodd", "k-service": "Gwasanaeth ecosystem",
      drivers_h: "Sbardunau uniongyrchol", pressures_h: "Pwysau allweddol",
      "col-drivers": "Sbardunau", "col-pressures": "Pwysau", "col-state": "Cyflwr natur", "col-services": "Gwasanaethau",
      "leg-supports": "cefnogi ▶", "leg-degrades": "diraddio ⊢",
    },
  };
  let lang = "en";
  const t = (k) => (I18N[lang][k] != null ? I18N[lang][k] : k);
  function applyLang() {
    document.querySelectorAll("[data-i18n]").forEach((n) => {
      const k = n.getAttribute("data-i18n");
      if (I18N[lang][k] != null) n.textContent = I18N[lang][k];
    });
  }

  // ---- intervention bundles (the default, stakeholder-friendly levers) ------
  // Each bundle is a plain-language action that eases several SoNaRR pressures.
  // Intensity 0..1 interpolates each target from its baseline toward FLOOR.
  const FLOOR = 0.1;
  const BUNDLES = [
    { id: "climate", en: "Global climate action", cy: "Gweithredu hinsawdd byd-eang",
      desc: "Cut greenhouse gases: eases warming, extreme weather, sea-level rise and ocean acidification.",
      targets: ["driver:climate_change", "pressure:changes_in_air_temperature_includes_rainfall_trends", "pressure:changes_in_water_temperature", "pressure:changes_in_intensity_and_frequency_of_weather_events", "pressure:sea_level_rise", "pressure:ocean_acidification"] },
    { id: "farming", en: "Sustainable farming & less pollution", cy: "Ffermio cynaliadwy a llai o lygredd",
      desc: "Lower-intensity agriculture, less ammonia and nutrient run-off (Sustainable Farming Scheme).",
      targets: ["pressure:agricultural_intensification", "pressure:air_pollution", "pressure:non_efficient_use", "pressure:land_pollution"] },
    { id: "water", en: "Cleaner, healthier water", cy: "Dŵr glanach ac iachach",
      desc: "Cut water pollution and over-abstraction; restore natural river and coastal processes.",
      targets: ["pressure:water_pollution", "pressure:physical_modification_freshwater_and_coastal", "pressure:water_abstraction_and_demand", "pressure:drainage"] },
    { id: "peat", en: "Restore peatland & uplands", cy: "Adfer mawnogydd a'r ucheldir",
      desc: "Rewet peat and manage upland grazing to restore moorland and its carbon store.",
      targets: ["pressure:drainage", "pressure:large_mammal_herbivore_activities"] },
    { id: "inns", en: "Control invasive species", cy: "Rheoli rhywogaethau goresgynnol",
      desc: "Prevent and manage INNS, pests and diseases across ecosystems.",
      targets: ["driver:inns_pests_and_diseases", "pressure:inns", "pressure:pests_and_diseases"] },
    { id: "development", en: "Curb built development & sprawl", cy: "Ffrwyno datblygu adeiledig",
      desc: "Steer development away from habitats; reduce light and noise pollution.",
      targets: ["pressure:built_development_and_infrastructure", "pressure:light_pollution", "pressure:noise_pollution"] },
    { id: "fishing", en: "Sustainable fishing", cy: "Pysgota cynaliadwy",
      desc: "Bring fishing pressure within sustainable limits for the marine ecosystem.",
      targets: ["pressure:fisheries"] },
    { id: "recreation", en: "Reduce recreational disturbance", cy: "Lleihau aflonyddwch hamdden",
      desc: "Manage access, sport and recreation to cut localised disturbance.",
      targets: ["pressure:access_sport_recreational_activity"] },
  ];

  // ---- scenario state ------------------------------------------------------
  let bundleIntensity = {}; // bundleId -> 0..1
  let manual = {};          // nodeId -> value (advanced sliders; override bundles)
  let clamps = {};          // computed from bundles + manual; used by the engine
  let weightOverride = {};
  const nodeById = new Map(MODEL.nodes.map((n) => [n.id, n]));

  function computeClamps() {
    const out = {};
    BUNDLES.forEach((b) => {
      const x = bundleIntensity[b.id] || 0;
      if (x <= 0) return;
      b.targets.forEach((id) => {
        const nd = nodeById.get(id);
        if (!nd) return;
        const v = nd.initial + (FLOOR - nd.initial) * x; // toward FLOOR
        out[id] = out[id] == null ? v : Math.min(out[id], v); // strongest wins
      });
    });
    Object.assign(out, manual); // manual advanced sliders override
    clamps = out;
  }
  const baseNoIntervention = FCM.run(compiled, { lambda: LAMBDA }).activation;
  const baseIdx = (id) => baseNoIntervention[compiled.index.get(id)];
  const currentRun = () => FCM.run(compiled, { lambda: LAMBDA, clamps, weightOverride }).activation;

  // ---- headline stat -------------------------------------------------------
  let deteriorating = 0;
  MODEL.nodes.forEach((n) => {
    if (n.kind === "pressure" && n.trend_counts) deteriorating += n.trend_counts.deteriorating || 0;
  });
  document.getElementById("headline-num").textContent = deteriorating;

  // ---- Sankey graph (d3) ---------------------------------------------------
  // DPSIR is a staged left-to-right flow (Driver -> Pressure -> State ->
  // Service), so a Sankey reads as an orderly river, not a hairball.
  const kindKey = (k) => (k.indexOf("state") === 0 ? "state" : k);
  const HEADER_KEY = ["col-drivers", "col-pressures", "col-state", "col-services"];

  // Sequential ramp on the light theme: pale grey-green (poor) -> bold deep
  // green (good). Value read by darkness/saturation, so it stays legible for
  // colour-blind users. The numeric delta and baseline marker are a 2nd cue.
  function stateRGB(a) {
    return [Math.round(201 - a * 183), Math.round(206 - a * 53), Math.round(193 - a * 103)];
  }
  function colourFor(a) { const c = stateRGB(a); return "rgb(" + c[0] + "," + c[1] + "," + c[2] + ")"; }
  function benefitSign(kind, delta) {
    const goodUp = kind === "state_ecosystem" || kind === "state_resource" || kind === "service";
    return (goodUp ? delta : -delta) >= 0 ? 1 : -1;
  }

  const GW = 1440, GH = 820, GTOP = 42; // landscape to fill the panel (no letterboxing)
  const gnodes = MODEL.nodes.map((n, i) => ({ id: n.id, label: n.label, kind: n.kind, i }));
  const gidx = new Map(gnodes.map((n) => [n.id, n.i]));
  const glinks = MODEL.edges.map((e) => ({ source: gidx.get(e.source), target: gidx.get(e.target), value: 1, edge: e, sign: e.sign || 1 }));

  const sankey = d3.sankey().nodeId((d) => d.i).nodeWidth(34).nodePadding(9)
    .nodeSort(null).extent([[6, GTOP], [GW - 6, GH - 10]]);
  const layout = sankey({ nodes: gnodes.map((d) => Object.assign({}, d)), links: glinks.map((d) => Object.assign({}, d)) });
  const nodeByModelId = new Map(layout.nodes.map((n) => [n.id, n]));

  const svg = d3.select("#cy").append("svg")
    .attr("viewBox", "0 0 " + GW + " " + GH).attr("preserveAspectRatio", "xMidYMid meet")
    .style("width", "100%").style("height", "100%").style("display", "block");

  const defs = svg.append("defs");
  Object.keys(KIND_GRAD).forEach((k) => {
    const g = defs.append("linearGradient").attr("id", "g-" + k).attr("x1", 0).attr("y1", 0).attr("x2", 0).attr("y2", 1);
    g.append("stop").attr("offset", "0%").attr("stop-color", KIND_GRAD[k][0]);
    g.append("stop").attr("offset", "100%").attr("stop-color", KIND_GRAD[k][1]);
  });

  // everything zoomable/pannable lives in gRoot
  const gRoot = svg.append("g");
  const zoom = d3.zoom().scaleExtent([0.6, 6]).on("zoom", (ev) => gRoot.attr("transform", ev.transform));
  svg.call(zoom).on("dblclick.zoom", () => svg.transition().duration(300).call(zoom.transform, d3.zoomIdentity));

  // column headers, aligned to each column edge so they never clip or collide
  const depthBox = {};
  layout.nodes.forEach((n) => {
    const d = n.depth;
    if (!depthBox[d]) depthBox[d] = { x0: n.x0, x1: n.x1 };
    depthBox[d].x0 = Math.min(depthBox[d].x0, n.x0);
    depthBox[d].x1 = Math.max(depthBox[d].x1, n.x1);
  });
  const maxDepth = Math.max(...Object.keys(depthBox).map(Number));
  const headerSel = gRoot.append("g").selectAll("text").data(Object.keys(depthBox)).join("text")
    .attr("x", (d) => (+d === 0 ? depthBox[d].x0 : +d === maxDepth ? depthBox[d].x1 : (depthBox[d].x0 + depthBox[d].x1) / 2))
    .attr("y", 20)
    .attr("text-anchor", (d) => (+d === 0 ? "start" : +d === maxDepth ? "end" : "middle"))
    .attr("fill", "#5f6f62").attr("font-family", "Hanken Grotesk, sans-serif")
    .attr("font-size", 12.5).attr("font-weight", 800).attr("letter-spacing", "1.5px")
    .attr("data-depth", (d) => d).text((d) => t(HEADER_KEY[d]).toUpperCase());

  // links (drawn behind nodes)
  const REST_OP = 0.05;
  const linkSel = gRoot.append("g").attr("fill", "none").selectAll("path").data(layout.links).join("path")
    .attr("d", d3.sankeyLinkHorizontal())
    .attr("stroke", (d) => (d.sign < 0 ? EDGE_NEG : EDGE_POS))
    .attr("stroke-width", (d) => Math.max(1.1, d.width))
    .attr("stroke-opacity", REST_OP).style("cursor", "pointer")
    .on("click", (ev, d) => { ev.stopPropagation(); selectEdge(d.edge); })
    .on("mouseenter", function (ev, d) { if (!selId) { d3.select(this).attr("stroke-opacity", 0.8).attr("stroke-dasharray", d.sign < 0 ? "7 6" : null); } })
    .on("mouseleave", function (ev, d) { if (!selId) d3.select(this).attr("stroke-opacity", REST_OP).attr("stroke-dasharray", null); });

  // nodes
  const nodeSel = gRoot.append("g").selectAll("g.snode").data(layout.nodes).join("g").attr("class", "snode")
    .style("cursor", "pointer")
    .on("click", (ev, d) => { ev.stopPropagation(); selectNode(d.id); })
    .on("mouseenter", (ev, d) => { if (!selId) highlight(d.id); })
    .on("mouseleave", () => { if (!selId) clearHi(); });
  const rectSel = nodeSel.append("rect")
    .attr("x", (d) => d.x0).attr("y", (d) => d.y0)
    .attr("width", (d) => d.x1 - d.x0).attr("height", (d) => Math.max(7, d.y1 - d.y0))
    .attr("rx", 4).attr("ry", 4)
    .attr("fill", (d) => (kindKey(d.kind) === "state" ? colourFor(baseIdx(d.id)) : "url(#g-" + kindKey(d.kind) + ")"))
    .attr("stroke", "rgba(24,36,32,.18)").attr("stroke-width", 1);
  // label side alternates by column so labels sit in the emptier flow gaps,
  // not on top of the dense pressure->state ribbon band
  const labelRight = (d) => d.depth % 2 === 0;
  nodeSel.append("text")
    .attr("x", (d) => (labelRight(d) ? d.x1 + 7 : d.x0 - 7))
    .attr("y", (d) => (d.y0 + d.y1) / 2).attr("dy", "0.34em")
    .attr("text-anchor", (d) => (labelRight(d) ? "start" : "end"))
    .attr("fill", "#243029").attr("font-family", "Hanken Grotesk, sans-serif")
    .attr("font-size", 12.5).attr("font-weight", 500)
    .attr("stroke", "#fcfbf7").attr("stroke-width", 3.5).attr("paint-order", "stroke")
    .attr("pointer-events", "none").text((d) => d.label);

  svg.on("click", () => clearSel());
  window._sankey = { svg, layout };

  // ---- graph interaction ---------------------------------------------------
  let selId = null;
  function neighbours(id) {
    const set = new Set([id]);
    MODEL.edges.forEach((e) => { if (e.source === id) set.add(e.target); if (e.target === id) set.add(e.source); });
    return set;
  }
  function highlight(id) {
    const near = neighbours(id);
    const on = (d) => d.edge.source === id || d.edge.target === id;
    linkSel.attr("stroke-opacity", (d) => (on(d) ? 0.82 : 0.02))
      .attr("stroke-width", (d) => (on(d) ? Math.max(1.8, d.width + 0.8) : Math.max(1.1, d.width)))
      .attr("stroke-dasharray", (d) => (on(d) && d.sign < 0 ? "7 6" : null));
    nodeSel.style("opacity", (d) => (near.has(d.id) ? 1 : 0.2));
  }
  function clearHi() {
    linkSel.attr("stroke-opacity", REST_OP).attr("stroke-width", (d) => Math.max(1.1, d.width)).attr("stroke-dasharray", null);
    nodeSel.style("opacity", 1);
  }
  // smoothly zoom the graph to frame a set of node ids (so a selection is readable)
  function zoomToIds(ids) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    ids.forEach((nid) => {
      const n = nodeByModelId.get(nid);
      if (!n) return;
      x0 = Math.min(x0, n.x0); y0 = Math.min(y0, n.y0); x1 = Math.max(x1, n.x1); y1 = Math.max(y1, n.y1);
    });
    if (!isFinite(x0)) return;
    x0 -= 150; x1 += 150; y0 -= 45; y1 += 45; // room for labels
    const s = Math.max(1, Math.min(4.5, Math.min(GW / (x1 - x0), GH / (y1 - y0)) * 0.92));
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity.translate(GW / 2, GH / 2).scale(s).translate(-cx, -cy));
  }
  function selectNode(id) {
    if (!compiled.index.has(id)) return;
    selId = id; highlight(id);
    rectSel.attr("stroke", (d) => (d.id === id ? "#182420" : "rgba(24,36,32,.18)"))
      .attr("stroke-width", (d) => (d.id === id ? 2.6 : 1));
    const outs = MODEL.edges.filter((e) => e.source === id || e.target === id);
    if (outs.length) showEdge(outs[0]);
  }
  function selectEdge(edge) {
    selId = edge.source; // anchor highlight on the source, but show this edge
    linkSel.attr("stroke-opacity", (d) => (d.edge === edge ? 0.95 : 0.02))
      .attr("stroke-width", (d) => (d.edge === edge ? Math.max(2.4, d.width + 1.2) : Math.max(1.1, d.width)))
      .attr("stroke-dasharray", (d) => (d.edge === edge && d.sign < 0 ? "7 6" : null));
    const near = new Set([edge.source, edge.target]);
    nodeSel.style("opacity", (d) => (near.has(d.id) ? 1 : 0.2));
    rectSel.attr("stroke", "rgba(24,36,32,.18)").attr("stroke-width", 1);
    showEdge(edge);
  }
  function clearSel() {
    selId = null; clearHi();
    rectSel.attr("stroke", "rgba(24,36,32,.18)").attr("stroke-width", 1);
    document.getElementById("inspector").classList.remove("show");
    svg.transition().duration(400).call(zoom.transform, d3.zoomIdentity);
  }
  function refreshHeaders() { headerSel.text((d) => t(HEADER_KEY[d]).toUpperCase()); }

  function paintGraph(act) {
    // Scenario impact is shown by node treatment (condition fill + change ring),
    // never by lighting up every ribbon, so the diagram stays calm.
    rectSel
      .attr("fill", (d) => {
        if (kindKey(d.kind) !== "state") return "url(#g-" + kindKey(d.kind) + ")";
        return colourFor(act[compiled.index.get(d.id)]);
      })
      .attr("stroke", (d) => {
        if (selId && d.id === selId) return "#182420";
        const i = compiled.index.get(d.id);
        const delta = act[i] - baseNoIntervention[i];
        if (Math.abs(delta) <= 0.015) return "rgba(24,36,32,.18)";
        return benefitSign(d.kind, delta) > 0 ? "#3fb6c9" : "#e0795a";
      })
      .attr("stroke-width", (d) => {
        if (selId && d.id === selId) return 2.4;
        const i = compiled.index.get(d.id);
        const delta = Math.abs(act[i] - baseNoIntervention[i]);
        return delta > 0.015 ? Math.min(4, 1.4 + delta * 22) : 1;
      })
      .attr("stroke-dasharray", (d) => {
        const i = compiled.index.get(d.id);
        const delta = act[i] - baseNoIntervention[i];
        return (Math.abs(delta) > 0.015 && benefitSign(d.kind, delta) < 0) ? "3 2" : null;
      });
  }

  // ---- intervention bundle cards (default levers) --------------------------
  function buildActions() {
    const host = document.getElementById("bundles");
    clear(host);
    BUNDLES.forEach((b) => {
      const pct = el("span", { class: "val" });
      const label = el("div", { class: "lbl" }, [el("span", { text: b[lang] || b.en }), pct]);
      const input = el("input", { type: "range", min: "0", max: "1", step: "0.01",
        value: String(bundleIntensity[b.id] || 0) });
      const desc = el("div", { class: "bundle-desc", text: b.desc });
      const wrap = el("div", { class: "lever bundle", "data-bundle": b.id }, [label, input, desc]);
      const refresh = () => {
        const v = parseFloat(input.value);
        pct.textContent = Math.round(v * 100) + "%";
        wrap.classList.toggle("changed", v > 0.001);
        fillSlider(input, v);
      };
      refresh();
      input.addEventListener("input", () => {
        const v = parseFloat(input.value);
        if (v <= 0.001) delete bundleIntensity[b.id]; else bundleIntensity[b.id] = v;
        refresh(); computeClamps(); syncAdvanced(); recompute();
      });
      host.appendChild(wrap);
    });
  }

  // ---- raw parameter sliders (advanced) ------------------------------------
  function buildAdvanced() {
    const host = document.getElementById("advanced");
    clear(host);
    const section = (key, cls, kind) => {
      host.appendChild(el("div", { class: "group-label " + cls, text: t(key) }));
      MODEL.nodes.filter((n) => n.kind === kind).forEach((n) => host.appendChild(leverRow(n)));
    };
    section("drivers_h", "driver", "driver");
    section("pressures_h", "pressure", "pressure");
  }
  // reflect current computed clamps onto the advanced sliders (when bundles move)
  function syncAdvanced() {
    document.querySelectorAll("#advanced .lever[data-id]").forEach((wrap) => {
      const id = wrap.dataset.id;
      const base = nodeById.get(id).initial;
      const v = clamps[id] != null ? clamps[id] : base;
      const input = wrap.querySelector("input");
      input.value = v;
      wrap.querySelector(".val").textContent = v.toFixed(2);
      wrap.classList.toggle("changed", Math.abs(v - base) > 0.001);
      fillSlider(input, v);
    });
  }
  function leverRow(n) {
    const base = n.initial;
    const startVal = clamps[n.id] != null ? clamps[n.id] : base;
    const val = el("span", { class: "val", text: startVal.toFixed(2) });
    const label = el("div", { class: "lbl" }, [el("span", { text: n.label }), val]);
    const input = el("input", { type: "range", min: "0", max: "1", step: "0.01", value: String(startVal) });
    const wrap = el("div", { class: "lever", "data-id": n.id }, [label, input]);
    if (Math.abs(startVal - base) > 0.001) wrap.classList.add("changed");
    fillSlider(input, startVal);
    input.addEventListener("input", () => {
      const v = parseFloat(input.value);
      val.textContent = v.toFixed(2);
      wrap.classList.toggle("changed", Math.abs(v - base) > 0.001);
      fillSlider(input, v);
      if (Math.abs(v - base) < 0.001) delete manual[n.id]; else manual[n.id] = v;
      computeClamps(); recompute();
    });
    return wrap;
  }

  // ---- state bars ----------------------------------------------------------
  const STATE_NODES = MODEL.nodes.filter((n) => n.kind === "state_ecosystem" || n.kind === "state_resource");
  function buildBars() {
    const host = document.getElementById("bars");
    clear(host);
    STATE_NODES.forEach((n) => {
      const delta = el("span", { class: "delta" });
      const band = el("div", { class: "band" });
      const fill = el("div", { class: "fill" });
      const ghost = el("div", { class: "ghost" });
      const bar = el("div", { class: "bar", "data-id": n.id }, [
        el("div", { class: "blbl" }, [el("span", { text: n.label }), delta]),
        el("div", { class: "track" }, [band, fill, ghost]),
      ]);
      host.appendChild(bar);
    });
  }
  function paintBars(act, bands) {
    // find the biggest movers so differentiation between ecosystems is explicit
    const deltas = STATE_NODES.map((n) => Math.abs(act[compiled.index.get(n.id)] - baseIdx(n.id)));
    const maxAbs = Math.max(0.0001, ...deltas);
    STATE_NODES.forEach((n) => {
      const barEl = document.querySelector('.bar[data-id="' + n.id + '"]');
      const a = act[compiled.index.get(n.id)];
      const b = baseIdx(n.id);
      const absD = Math.abs(a - b);
      barEl.classList.toggle("mover", absD > 0.01 && absD >= 0.75 * maxAbs);
      const fill = barEl.querySelector(".fill");
      fill.style.width = (a * 100).toFixed(1) + "%";
      fill.style.background = colourFor(a);
      barEl.querySelector(".ghost").style.left = (b * 100).toFixed(1) + "%";
      // uncertainty band (p10-p90 from edge-confidence ensemble)
      const bandEl = barEl.querySelector(".band");
      const bd = bands && bands[n.id];
      if (bd) {
        bandEl.style.left = (bd.p10 * 100).toFixed(1) + "%";
        bandEl.style.width = Math.max(0, (bd.p90 - bd.p10) * 100).toFixed(1) + "%";
      }
      const dEl = barEl.querySelector(".delta");
      const delta = a - b;
      if (Math.abs(delta) < 0.005) dEl.textContent = "";
      else {
        // arrow glyph + sign give the direction without relying on colour
        dEl.textContent = (delta > 0 ? "▲ +" : "▼ ") + delta.toFixed(2);
        dEl.style.color = delta > 0 ? "var(--good)" : "var(--bad)";
      }
    });
  }

  // ---- leverage ------------------------------------------------------------
  function paintLeverage() {
    const host = document.getElementById("leverage");
    clear(host);
    const lev = FCM.leverage(compiled, { lambda: LAMBDA, clamps, weightOverride }).slice(0, 8);
    const max = Math.max(0.001, ...lev.map((l) => Math.abs(l.delta)));
    lev.forEach((l) => {
      const w = (Math.abs(l.delta) / max) * 120;
      const bar = el("span", { class: "levbar", style: "width:" + w + "px;background:" + (l.delta >= 0 ? "var(--good)" : "var(--bad)") });
      const row = el("div", { class: "lev-item", onclick: () => selectNode(l.id) }, [
        el("span", { class: "nm", text: l.label }),
        bar,
        el("span", { class: "pct", text: (l.delta >= 0 ? "+" : "") + l.delta.toFixed(2) }),
      ]);
      host.appendChild(row);
    });
  }

  // ---- inspector + uncertainty fan ----------------------------------------
  let selectedEdge = null;
  function showEdge(e) {
    selectedEdge = e;
    const insp = document.getElementById("inspector");
    insp.classList.add("show");
    insp.scrollIntoView({ block: "nearest", behavior: "smooth" });
    const chip = document.getElementById("insp-kind");
    chip.textContent = e.kind.replace(/_/g, " -> ");
    chip.style.background = e.sign < 0 ? "var(--bad)" : "var(--good)";
    document.getElementById("insp-title").textContent =
      nodeById.get(e.source).label + (e.sign < 0 ? "  degrades  " : "  supports  ") + nodeById.get(e.target).label;
    document.getElementById("insp-conf").textContent = Math.round((e.confidence || 0.6) * 100) + "%";
    document.getElementById("insp-prov").textContent = e.provenance || "";
    const key = e.source + "|" + e.target;
    // prior value in [0,1]; 0.5 = SoNaRR default, higher = stronger link
    const cur = weightOverride[key] != null ? weightOverride[key] : 0.5;
    const wInput = document.getElementById("insp-weight");
    wInput.value = cur;
    fillSlider(wInput, cur);
    document.getElementById("insp-wval").textContent = cur.toFixed(2);
    wInput.oninput = () => {
      const v = parseFloat(wInput.value);
      document.getElementById("insp-wval").textContent = v.toFixed(2);
      fillSlider(wInput, v);
      if (Math.abs(v - 0.5) < 0.005) delete weightOverride[key]; else weightOverride[key] = v;
      drawFan(e); recompute(false);
    };
    document.getElementById("fan-target").textContent =
      (lang === "en" ? "Likely outcome for: " : "Canlyniad tebygol: ") + nodeById.get(e.target).label;
    drawFan(e);
  }
  // Horizontal outcome gauge for the inspected link's target: a value axis
  // (poorer -> healthier) with the SoNaRR baseline ticked, a shaded band whose
  // WIDTH = uncertainty from confidence, and a marker that slides as the prior
  // changes. Reads far clearer than a flat time-series "fan".
  function drawFan(e) {
    const fan = FCM.ensembleEdge(compiled, e, e.target, { lambda: LAMBDA, clamps, weightOverride, samples: 60, steps: 18 });
    const last = fan.steps;
    const p10 = fan.bands.p10[last], p50 = fan.bands.p50[last], p90 = fan.bands.p90[last];
    const tBase = baseNoIntervention[compiled.index.get(e.target)];
    const W = 320, H = 150, padX = 16, midY = 74, barH = 26;
    const x = (v) => padX + v * (W - 2 * padX); // full 0..1 value axis
    const svg = document.getElementById("fan");
    clear(svg);
    svg.appendChild(sv("rect", { x: 0, y: 0, width: W, height: H, fill: "#fcfbf7" }));
    // axis labels
    svg.appendChild(sv("text", { x: padX, y: 22, fill: "#8a978d", "font-family": "Hanken Grotesk, sans-serif", "font-size": 11, "text-anchor": "start" }));
    svg.lastChild.textContent = lang === "en" ? "poorer" : "gwaeth";
    svg.appendChild(sv("text", { x: W - padX, y: 22, fill: "#8a978d", "font-family": "Hanken Grotesk, sans-serif", "font-size": 11, "text-anchor": "end" }));
    svg.lastChild.textContent = lang === "en" ? "healthier" : "iachach";
    // track
    svg.appendChild(sv("rect", { x: padX, y: midY - barH / 2, width: W - 2 * padX, height: barH, rx: 8, fill: "#eae7dc" }));
    // uncertainty band (width = less certain)
    svg.appendChild(sv("rect", { x: x(p10), y: midY - barH / 2, width: Math.max(2, x(p90) - x(p10)), height: barH, rx: 6, fill: "rgba(18,153,90,.28)" }));
    // median marker (slides with your prior)
    svg.appendChild(sv("rect", { x: x(p50) - 2, y: midY - barH / 2 - 5, width: 4, height: barH + 10, rx: 2, fill: "#12995a" }));
    // baseline tick (SoNaRR)
    svg.appendChild(sv("line", { x1: x(tBase), y1: midY - barH / 2 - 12, x2: x(tBase), y2: midY + barH / 2 + 12, stroke: "#182420", "stroke-width": 1.5, "stroke-dasharray": "3 3" }));
    svg.appendChild(sv("text", { x: x(tBase), y: midY + barH / 2 + 26, fill: "#5b6b62", "font-family": "Hanken Grotesk, sans-serif", "font-size": 10.5, "text-anchor": "middle" }));
    svg.lastChild.textContent = lang === "en" ? "SoNaRR baseline" : "llinell sylfaen";
  }

  // ---- recompute + share ---------------------------------------------------
  function recompute(doLeverage) {
    const act = currentRun();
    const bands = FCM.ensembleStates(compiled, MODEL, { clamps, weightOverride, samples: 30 });
    paintGraph(act);
    paintBars(act, bands);
    if (doLeverage !== false) paintLeverage();
    syncHash();
  }
  function syncHash() {
    const payload = { b: bundleIntensity, m: manual, w: weightOverride, l: lang };
    history.replaceState(null, "", "#" + btoa(unescape(encodeURIComponent(JSON.stringify(payload)))));
  }
  function loadHash() {
    if (!location.hash || location.hash.length < 2) return;
    try {
      const p = JSON.parse(decodeURIComponent(escape(atob(location.hash.slice(1)))));
      bundleIntensity = p.b || {}; manual = p.m || {}; weightOverride = p.w || {}; lang = p.l || "en";
    } catch (_) {}
    computeClamps();
  }

  // ---- buttons -------------------------------------------------------------
  document.getElementById("reset").addEventListener("click", () => {
    bundleIntensity = {}; manual = {}; weightOverride = {};
    computeClamps();
    buildActions(); buildAdvanced();
    document.getElementById("inspector").classList.remove("show");
    clearSel(); recompute();
  });
  document.getElementById("toggle-advanced").addEventListener("click", (ev) => {
    const adv = document.getElementById("advanced");
    const open = adv.classList.toggle("advanced-hidden") === false;
    ev.target.textContent = open ? t("hide-advanced") : t("show-advanced");
  });
  document.getElementById("share").addEventListener("click", (ev) => {
    syncHash();
    if (navigator.clipboard) navigator.clipboard.writeText(location.href);
    const b = ev.target, prev = b.textContent;
    b.textContent = lang === "en" ? "Copied!" : "Copiwyd!";
    setTimeout(() => (b.textContent = prev), 1200);
  });
  document.querySelectorAll("#langtoggle button").forEach((btn) => {
    btn.addEventListener("click", () => {
      lang = btn.dataset.lang;
      document.querySelectorAll("#langtoggle button").forEach((b) => b.classList.toggle("active", b === btn));
      applyLang(); buildActions(); buildAdvanced(); refreshHeaders();
      const adv = document.getElementById("advanced");
      document.getElementById("toggle-advanced").textContent =
        adv.classList.contains("advanced-hidden") ? t("show-advanced") : t("hide-advanced");
      if (selectedEdge) showEdge(selectedEdge);
      syncHash();
    });
  });

  // ---- init ----------------------------------------------------------------
  loadHash();
  document.querySelectorAll("#langtoggle button").forEach((b) => b.classList.toggle("active", b.dataset.lang === lang));
  applyLang();
  buildActions();
  buildAdvanced();
  buildBars();
  recompute();
})();
