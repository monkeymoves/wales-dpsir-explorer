// Headless sanity tests for the FCM engine against the real SoNaRR model.
const fs = require("fs");
const path = require("path");
const FCM = require("../prototype/fcm.js");

const model = JSON.parse(fs.readFileSync(path.join(__dirname, "../prototype/model.json"), "utf8"));
const c = FCM.compile(model);

let fails = 0;
const ok = (cond, msg) => {
  console.log((cond ? "  PASS " : "  FAIL ") + msg);
  if (!cond) fails++;
};

console.log("Model:", c.n, "nodes,", model.edges.length, "edges");

// 1. Baseline converges
const base = FCM.run(c, { lambda: 1.0 });
ok(base.converged, `baseline converges in ${base.iters} iters`);

// 2. All activations stay in [0,1]
let inRange = true;
for (const v of base.activation) if (v < -1e-9 || v > 1 + 1e-9) inRange = false;
ok(inRange, "all activations within [0,1]");

const stateIds = model.nodes.filter((n) => n.kind.startsWith("state")).map((n) => n.id);
const stateSum = (A) => stateIds.reduce((s, id) => s + A[c.index.get(id)], 0);

// 3. Face validity: relieving Pollution (clamp low) should not worsen states overall
const relieved = FCM.run(c, { lambda: 1.0, clamps: { "driver:pollution": 0.1 } });
ok(relieved.converged, `pollution-relief scenario converges in ${relieved.iters} iters`);
const dPoll = stateSum(relieved.activation) - stateSum(base.activation);
ok(dPoll >= -1e-6, `relieving Pollution changes total state by ${dPoll.toFixed(3)} (>= 0 expected)`);

// 4. Worsening a driver (clamp high) should push states the other way vs relieving it
const worsened = FCM.run(c, { lambda: 1.0, clamps: { "driver:pollution": 0.95 } });
const dWorse = stateSum(worsened.activation) - stateSum(base.activation);
ok(dWorse <= dPoll + 1e-9, `worsening Pollution (${dWorse.toFixed(3)}) <= relieving it (${dPoll.toFixed(3)})`);

// 5. Leverage ranking is populated and finite
const lev = FCM.leverage(c, { lambda: 1.0 });
ok(lev.length > 0 && lev.every((l) => Number.isFinite(l.delta)), `leverage ranks ${lev.length} drivers/pressures`);
console.log("  Top 5 leverage (relieve -> total state gain):");
lev.slice(0, 5).forEach((l) => console.log(`     ${l.delta >= 0 ? "+" : ""}${l.delta.toFixed(3)}  ${l.label} (${l.kind})`));

// 6. Ensemble fan on a contested edge produces ordered bands
const edge = model.edges.find((e) => e.kind === "pressure_state");
const fan = FCM.ensembleEdge(c, edge, edge.target, { lambda: 1.0 });
let ordered = true;
for (let t = 0; t <= fan.steps; t++)
  if (!(fan.bands.p10[t] <= fan.bands.p50[t] + 1e-9 && fan.bands.p50[t] <= fan.bands.p90[t] + 1e-9)) ordered = false;
ok(ordered, `ensemble fan bands ordered p10<=p50<=p90 over ${fan.steps} steps`);

console.log(fails === 0 ? "\nALL TESTS PASSED" : `\n${fails} TEST(S) FAILED`);
process.exit(fails === 0 ? 0 : 1);
