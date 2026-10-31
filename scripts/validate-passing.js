import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { shuffle, passCards, createState, legal, play, roundScores } from "../src/game.js";
import { observe } from "../src/observation.js";

const args = process.argv.slice(2), mode = args[0];
const option = (name, fallback) => args.includes("--" + name) ? args[args.indexOf("--" + name) + 1] : fallback;
const root = option("root", "artifacts/passing-validation-20261031");
const baselinePath = "artifacts/decision-audit-20261031/baseline", candidatePath = "artifacts/passing-moon-next";
for (const source of [baselinePath, candidatePath]) {
  const manifest = JSON.parse(fs.readFileSync(path.join(source, "analysis-manifest.json")));
  for (const [file, expected] of Object.entries(manifest.hashes)) assert.equal(createHash("sha256").update(fs.readFileSync(path.join(source, file))).digest("hex"), expected, source + "/" + file);
}
const baseline = await import(pathToFileURL(path.resolve(baselinePath, "src/ai.js")).href);
const candidate = await import(pathToFileURL(path.resolve(candidatePath, "src/ai.js")).href);
const seeded = (initial) => { let n = initial >>> 0; return () => ((n = (Math.imul(n, 1664525) + 1013904223) >>> 0) / 4294967296); };
if (mode === "prepare") {
  assert.ok(!fs.existsSync(root), "Do not replace a previous validation");
  fs.mkdirSync(root, { recursive: true });
  const cases = [], random = seeded(20300417), seen = new Set();
  const pilot = [0,12,28,35,37,39,41,42,46,48,49,50,51].join(',');
  let tried = 0, screened = 0;
  while (cases.length < 40 && tried < 2000000) {
    tried++;
    const hand = shuffle(Array.from({ length: 52 }, (_, c) => c), random).slice(0, 13).sort((a, b) => a - b);
    if (!hand.includes(51) || hand.filter((c) => c >= 39).length < 6) continue;
    screened++;
    const before = baseline.choosePass(hand), after = candidate.choosePass(hand), key = hand.join(',');
    if (before.slice().sort((a,b)=>a-b).join(',') === after.slice().sort((a,b)=>a-b).join(',') || seen.has(key) || key === pilot) continue;
    seen.add(key); cases.push({ index: cases.length, hand, seat: cases.length % 4, direction: [1, 3, 2][cases.length % 3], originalPass: before, candidatePass: after });
  }
  assert.equal(cases.length, 40, "Too few affected hands; do not silently shrink the sample");
  const plan = { createdAt: new Date().toISOString(), purpose: "Fresh targeted conditional evaluation, not a whole-population equal-time strength proof", sampleDesign: "Uniform shuffled thirteen-card hands, conditioned on the preregistered passing-only candidate choosing different cards. The motivating hand is excluded. Four private unchanged baseline AIs continue both arms, except the tested own pass.", initialHandSeed: 20300417, worldSeed: 20310519, triedHands: tried, screenedHands: screened, cases: cases.length, worldsPerHand: 16, samplesPerPlayer: 64, totalsBefore: [0,0,0,0], workers: 4, baseline: JSON.parse(fs.readFileSync(baselinePath + '/analysis-manifest.json')), candidate: JSON.parse(fs.readFileSync(candidatePath + '/analysis-manifest.json')), criterion: "Complete all 40 hands x16 paired worlds; paired bootstrap over entire initial hands for relative round value; report own points and moon rates separately. No tuning or stopping on interim outcomes." };
  fs.writeFileSync(path.join(root, 'plan.json'), JSON.stringify(plan,null,2)+'\n');
  fs.writeFileSync(path.join(root, 'cases.json'), JSON.stringify(cases,null,2)+'\n');
  console.log(JSON.stringify({ selectedHands: cases.length, triedHands: tried, screenedHands: screened }));
} else if (mode === "run") {
  const worker = Number(option("worker", 0)), plan = JSON.parse(fs.readFileSync(path.join(root,'plan.json'))), cases = JSON.parse(fs.readFileSync(path.join(root,'cases.json')));
  const file = path.join(root,'worker-'+worker+'.jsonl'); assert.ok(!fs.existsSync(file));
  assert.deepEqual(JSON.parse(fs.readFileSync(candidatePath+'/analysis-manifest.json')),plan.candidate);
  assert.deepEqual(JSON.parse(fs.readFileSync(baselinePath+'/analysis-manifest.json')),plan.baseline);
  let completed = 0;
  for (const item of cases) for (let worldIndex=0;worldIndex<plan.worldsPerHand;worldIndex++) {
    if (worldIndex%plan.workers!==worker)continue;
    const rng=seeded(plan.worldSeed+item.index*1000003+worldIndex*65537);
    const pool=shuffle(Array.from({length:52},(_,c)=>c).filter(c=>!item.hand.includes(c)),rng);
    const hands=Array.from({length:4},(_,p)=>p===item.seat?item.hand.slice():[]);let at=0;
    for(let p=0;p<4;p++)if(p!==item.seat){hands[p]=pool.slice(at,at+13).sort((a,b)=>a-b);at+=13;}
    const outgoing=hands.map(h=>baseline.choosePass(h,{direction:item.direction})),results=[];
    assert.deepEqual(outgoing[item.seat],item.originalPass);
    for(let arm=0;arm<2;arm++){
      const selections=structuredClone(outgoing),passed=structuredClone(hands),known=Array.from({length:4},()=>({})),received=[];
      if(arm)selections[item.seat]=candidate.choosePass(item.hand,{direction:item.direction});
      assert.deepEqual(selections[item.seat],arm?item.candidatePass:item.originalPass);
      for(let p=0;p<4;p++){known[p][(p+item.direction)%4]=selections[p].slice();const from=(p-item.direction+4)%4;received[p]={from,cards:selections[from].slice()};}
      passCards(passed,selections,item.direction);
      const state=createState(passed),streams=Array.from({length:4},(_,p)=>seeded(0x29d71+item.index*1000003+worldIndex*997+p*101));
      while(state.completed<13){
        const p=state.turn,o=observe(state,p,known[p],plan.totalsBefore,received[p]);assert.equal(o.hands,undefined);
        const result=(arm&&p===item.seat?candidate:baseline).decide(o,{milliseconds:0,minSamples:plan.samplesPerPlayer,rng:streams[p]});
        assert.ok(legal(state).includes(result.card));play(state,result.card);
      }
      const scores=roundScores(state.taken);results.push({arm:arm?'candidate':'control',scores,taken:state.taken,ownPoints:scores[item.seat],ownMoon:state.taken[item.seat]===26,value:scores.reduce((sum,n,p)=>sum+(p===item.seat?0:n),0)/3-scores[item.seat]});
    }
    fs.appendFileSync(file,JSON.stringify({caseIndex:item.index,worldIndex,results})+'\n');completed++;
    fs.writeFileSync(path.join(root,'worker-'+worker+'-progress.json'),JSON.stringify({at:new Date().toISOString(),completedPairedWorlds:completed,target:plan.cases*plan.worldsPerHand/plan.workers})+'\n');
  }
  fs.writeFileSync(path.join(root,'worker-'+worker+'-complete.json'),JSON.stringify({worker,completedPairedWorlds:completed})+'\n');
  console.log(JSON.stringify({worker,completedPairedWorlds:completed}));
} else throw Error("Use prepare or run");
