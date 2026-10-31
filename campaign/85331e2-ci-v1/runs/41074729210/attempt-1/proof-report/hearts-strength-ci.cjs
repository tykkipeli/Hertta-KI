const core=(function proofCore() {
  const campaign = "85331e2-ci-v1";
  function slots() {
    return [200, 1200].flatMap(ms => Array.from({length:4},(_,worker) =>
      Array.from({length:ms===200?40:20},(_,block) => ({
        ms,worker,block,seed:20270000+worker*1000003+block*65537,
        slot:ms+"-"+worker+"-"+block
      }))
    ).flat());
  }
  function assert(value,message){if(!value)throw Error(message);}
  function replaceOnce(source,marker,replacement) {
    assert(source.split(marker).length===2,"Checkpoint adapter marker changed: "+marker.slice(0,70));
    return source.replace(marker,replacement);
  }
  function adapter(source) {
    source = 'import { rename } from "node:fs/promises";\n'+source;
    source = replaceOnce(source,'const runId = randomUUID();','let runId = randomUUID();');
    const marker = 'let points = [0, 0, 0, 0],\n  wins = [0, 0, 0, 0],\n  uniqueWins = [0, 0, 0, 0],\n  rounds = 0;\nconst records = [],\n  started = performance.now();\nfor (let game = 0; game < count; game++) {';
    const checkpoint = `const jobDir = process.env.HEARTS_CI_JOB;
if (!jobDir) throw Error("HEARTS_CI_JOB is required");
await mkdir(jobDir, { recursive: true });
async function atomicJob(name, data) {
  const target = resolve(jobDir, name);
  await writeFile(target + ".tmp", JSON.stringify(data, null, 2) + "\\n");
  await rename(target + ".tmp", target);
}
let saved = null;
try { saved = JSON.parse(await readFile(resolve(jobDir, "checkpoint.json"), "utf8")); }
catch (error) { if (error.code !== "ENOENT") throw error; }
if (saved) {
  for (const [key, expected] of Object.entries({count,seed,milliseconds,samples,newSamples,newMilliseconds}))
    if (saved[key] !== expected) throw Error("Checkpoint parameter mismatch: " + key);
  if (JSON.stringify(saved.sourceHashes) !== JSON.stringify(sourceHashes))
    throw Error("Checkpoint source changed");
  if (!Array.isArray(saved.records) || saved.records.length > count || typeof saved.runId !== "string")
    throw Error("Invalid checkpoint");
  runId = saved.runId;
  for (const [key, target] of Object.entries({engineTimeMs,decisionCounts,passingTimeMs,passingCounts}))
    target.splice(0, target.length, ...saved[key]);
  Object.assign(beliefModes, saved.beliefModes);
}
let points = saved ? saved.points : [0,0,0,0],
    wins = saved ? saved.wins : [0,0,0,0],
    uniqueWins = saved ? saved.uniqueWins : [0,0,0,0],
    rounds = saved ? saved.rounds : 0;
const records = saved ? saved.records : [],
      carriedSeconds = saved ? saved.seconds : 0,
      started = performance.now();
for (let game = records.length; game < count; game++) {`;
    source=replaceOnce(source,marker,checkpoint);
    const push='records.push({ game, newSeat: seat, rounds: round, totals, winners });';
    source=replaceOnce(source,push,push+`
  await atomicJob("checkpoint.json", {
    count,seed,milliseconds,samples,newSamples,newMilliseconds,sourceHashes,runId,
    records,points,wins,uniqueWins,rounds,engineTimeMs,decisionCounts,
    passingTimeMs,passingCounts,beliefModes,
    seconds: carriedSeconds + (performance.now()-started)/1000
  });`);
    source=replaceOnce(source,'    rounds++;','    rounds++;\n    console.error(JSON.stringify({progress:true,completed:records.length,currentGame:game+1,round}));');
    source=replaceOnce(source,'seconds: (performance.now() - started) / 1000,','seconds: carriedSeconds + (performance.now() - started) / 1000,');
    const final='await mkdir("artifacts", { recursive: true });';
    source=replaceOnce(source,final,'await atomicJob("result.json", result);\n'+final);
    return source;
  }
  function validateRun(data,slot,expected) {
    assert(data.games===4 && data.records?.length===4,"Incomplete block");
    assert(data.mode==="matches-to-100" && data.seed===slot.seed,"Wrong mode or seed");
    assert(data.experimentalProvenance===null,"Experimental reference is forbidden");
    for(const role of ["old","new"])
      assert(data.budget?.[role]?.milliseconds===slot.ms && data.budget[role].minSamples===16,"Unequal budget");
    for(const [file,hash] of Object.entries(expected))
      if(file.startsWith("src/")||file==="test/fixtures/ai-v1.js")
        assert(data.sourceHashes?.[file]===hash,"Wrong frozen source: "+file);
    assert(data.sourceHashes?.activeEngine===expected["src/ai.js"],"Wrong active engine");
    assert(typeof data.runId==="string"&&data.runId.length>10,"Missing run ID");
    const shares=[0,0,0,0];let rounds=0;
    data.records.forEach((row,i)=>{
      assert(row.game===i&&row.newSeat===i,"Incomplete seat rotation");
      assert(Number.isInteger(row.rounds)&&row.rounds>=4&&row.rounds<=16,"Invalid round count");
      assert(row.totals?.length===4&&row.totals.every(n=>Number.isInteger(n)&&n>=0),"Invalid totals");
      const extra=row.totals.reduce((a,b)=>a+b,0)-26*row.rounds;
      assert(extra>=0&&extra%52===0&&extra/52<=row.rounds,"Impossible Hearts point total");
      assert(Math.max(...row.totals)>=100,"Match did not reach 100");
      const low=Math.min(...row.totals),winners=row.totals.flatMap((n,p)=>n===low?[p]:[]);
      assert(JSON.stringify(winners)===JSON.stringify(row.winners),"Wrong winners");
      for(const p of winners)shares[p===i?0:1+((p-i+3)%4)]+=1/winners.length/4;
      rounds+=row.rounds;
    });
    assert(data.rounds===rounds,"Wrong round total");
    assert(data.winShares?.length===4&&data.winShares.every((n,i)=>Math.abs(n-shares[i])<1e-12),"Wrong win shares");
    assert(data.meanDecisionMilliseconds?.length===2&&data.meanDecisionMilliseconds.every(n=>Number.isFinite(n)&&n>=0),"Missing timing");
    return data;
  }
  function validateCheckpoint(c,slot,expected) {
    for(const [key,value] of Object.entries({count:4,seed:slot.seed,milliseconds:slot.ms,samples:16,newSamples:16,newMilliseconds:slot.ms}))
      assert(c[key]===value,"Wrong checkpoint parameter: "+key);
    assert(Array.isArray(c.records)&&c.records.length<=4,"Bad checkpoint length");
    assert(typeof c.runId==="string"&&c.runId.length>10,"Bad checkpoint run ID");
    for(const [file,hash] of Object.entries(expected))
      if(file.startsWith("src/")||file==="test/fixtures/ai-v1.js")
        assert(c.sourceHashes?.[file]===hash,"Wrong checkpoint source: "+file);
    assert(c.sourceHashes?.activeEngine===expected["src/ai.js"],"Wrong checkpoint engine");
    const totals=[0,0,0,0],wins=[0,0,0,0],unique=[0,0,0,0];
    let rounds=0,passing=0;
    c.records.forEach((row,i)=>{
      assert(row.game===i&&row.newSeat===i,"Bad checkpoint rotation");
      assert(Number.isInteger(row.rounds)&&row.rounds>=4&&row.rounds<=16,"Bad checkpoint rounds");
      assert(row.totals?.length===4&&row.totals.every(n=>Number.isInteger(n)&&n>=0),"Bad checkpoint scores");
      const extra=row.totals.reduce((a,b)=>a+b,0)-26*row.rounds;
      assert(extra>=0&&extra%52===0&&extra/52<=row.rounds&&Math.max(...row.totals)>=100,"Bad checkpoint match");
      const low=Math.min(...row.totals),winners=row.totals.flatMap((n,p)=>n===low?[p]:[]);
      assert(JSON.stringify(winners)===JSON.stringify(row.winners),"Bad checkpoint winners");
      row.totals.forEach((n,p)=>totals[p===i?0:1+((p-i+3)%4)]+=n);
      for(const p of winners){const role=p===i?0:1+((p-i+3)%4);wins[role]+=1/winners.length;if(winners.length===1)unique[role]++;}
      rounds+=row.rounds;passing+=row.rounds-Math.floor(row.rounds/4);
    });
    for(const [key,expectedArray] of Object.entries({points:totals,wins,uniqueWins:unique,decisionCounts:[rounds*13,rounds*39],passingCounts:[passing,passing*3]}))
      assert(Array.isArray(c[key])&&c[key].length===expectedArray.length&&c[key].every((n,i)=>Math.abs(n-expectedArray[i])<1e-10),"Bad checkpoint statistics: "+key);
    assert(c.rounds===rounds&&Number.isFinite(c.seconds)&&c.seconds>=0,"Bad checkpoint timing");
    for(const key of ["engineTimeMs","passingTimeMs"])
      assert(c[key]?.length===2&&c[key].every(n=>Number.isFinite(n)&&n>=0),"Bad checkpoint timings");
    return c;
  }
  function chooseComplete(candidates) {
    const sorted=candidates.slice().sort((a,b)=>a.meta.runId.length-b.meta.runId.length||a.meta.runId.localeCompare(b.meta.runId)||a.meta.attempt-b.meta.attempt);
    return sorted[0]||null;
  }
  return {campaign,slots,adapter,validateRun,validateCheckpoint,chooseComplete,assert};
})();
const expected={
  "src/agent.js": "140393371adb40597c2ad5fd593f73def403240bbdcfc247f1c7c92fca041812",
  "src/ai.js": "287ca48ca1f3d453b2f8331954e883c2e2fe847a25315aa33e0a5ff963a70dad",
  "src/app.js": "0d688ab6f23984f899268a7d1587f29f42b10d76a846821e23bd56512a71dab2",
  "src/deals.js": "66cb930632da835e7b75f59db883e14dc444818ae025a5c5e3276ed0967d39f9",
  "src/endgame.js": "be8b084324db3f59167d2594f56a528b77a9eaeb122e8de95d514286f8b3340e",
  "src/game.js": "f72960d7ca7c29d4df24a7fa8b45981c1540097cb49529c7ceec6b5f29363bd1",
  "src/lead.js": "e3bba13a9e1f153d82a496ae30e79a0bea6c6dd86a9d75f8e41fc20f939ad902",
  "src/observation.js": "c44161b8863ecb39b7fa54e0bd80b633a00e9d101d70c64a75297b15d6b722d5",
  "src/queen-belief.js": "b9eb53419e84650d432536f0d371cb61fbf8967402624f6fde7effc261226d15",
  "src/reference-policy.js": "8187a3171457f3fdbf4442d9230bab3772e6d292f52e35844f9f841da2588860",
  "src/rollout.js": "85fa0b1e99723468c6e44abbb360e1bffc7d9899a882ec088b8e3b55658e5078",
  "src/strategy.js": "cc5cd71c9fd4a11e2023b8f7158004bcd74dcb15a587505b75e60d07e4e9d293",
  "src/utility.js": "0b630ccb16be4bfdcf5d953b33cab7c3ba0b122f382e5786cc8e5a77f0be2d8d",
  "src/worker.js": "a6c8bbd9c02d85c612886c16b39adfabe91994dc7e1a08fc6e24052bc737c171",
  "test/fixtures/ai-v1.js": "324d9a684de5c2c4e79feb9a8270c789d741fa9964bacba2424f74b38743d06e",
  "benchmark.js": "a75b984dc11cd562051db892b668e7b81347475ffe2e14e86f786c3ffd67bc43",
  "scripts/summarize-benchmarks.js": "84e4507d437e5dd5b9193ce1c318ee3a90ece8eefd40c055d5213e68dfe44b86",
  "package.json": "4169b8ee66b06d84d451154658e8b21005b117da918e18d13456a4764c4f66a3"
};
(function nodeProgram(core,expected) {
  const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto"),cp=require("node:child_process");
  const sha=data=>crypto.createHash("sha256").update(data).digest("hex");
  const read=file=>JSON.parse(fs.readFileSync(file,"utf8"));
  function atomic(file,data){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file+".tmp",JSON.stringify(data,null,2)+"\n");fs.renameSync(file+".tmp",file);}
  function verify(){
    for(const [file,hash] of Object.entries(expected))
      core.assert(sha(fs.readFileSync(file))===hash,"Frozen source changed: "+file);
  }
  function metadataDirectories(root){
    if(!fs.existsSync(root))return [];
    const out=[];
    function visit(dir){
      if(fs.existsSync(path.join(dir,"meta.json")))out.push(dir);
      for(const e of fs.readdirSync(dir,{withFileTypes:true}))if(e.isDirectory())visit(path.join(dir,e.name));
    }
    visit(root);return out;
  }
  function slotFromEnvironment(){
    const ms=Number(process.env.HEARTS_BUDGET),worker=Number(process.env.HEARTS_WORKER),block=Number(process.env.HEARTS_BLOCK);
    const slot=core.slots().find(s=>s.ms===ms&&s.worker===worker&&s.block===block);
    core.assert(slot&&slot.seed===Number(process.env.HEARTS_SEED),"Invalid matrix slot");
    return slot;
  }
  function validateMeta(meta,slot,driverSha,pipelineSha){
    core.assert(meta.campaign===core.campaign&&meta.slot===slot.slot&&meta.seed===slot.seed&&meta.ms===slot.ms,"Wrong artifact metadata");
    core.assert(meta.driverSha===driverSha&&meta.pipelineSha===pipelineSha,"Checkpoint instrumentation changed");
    core.assert(Number.isInteger(meta.attempt)&&meta.attempt>=1&&typeof meta.runId==="string"&&/^\d+$/.test(meta.runId),"Invalid artifact attempt");
  }

  function restoreGitArchive(destination,onlySlot,driverSha,pipelineSha){
    const ref="refs/heads/codex/hearts-strength-results-85331e2-ci-v1";
    function git(args){
      const r=cp.spawnSync("git",args,{encoding:"utf8",maxBuffer:32*1024*1024});
      core.assert(r.status===0,"Could not inspect durable Git proof archive; refusing to restart without checking saved data");
      return r.stdout;
    }
    const remote=git(["ls-remote","--refs","origin",ref]).trim();
    if(!remote)return;
    const head=remote.split(/\s+/)[0];
    core.assert(/^[a-f0-9]{40}$/.test(head),"Invalid archive ref");
    git(["fetch","--no-tags","origin",ref]);
    const prefix="campaign/"+core.campaign+"/runs/";
    const files=git(["ls-tree","-r","--name-only",head,"--",prefix]).trim().split("\n").filter(Boolean),available=new Set(files);
    const slots=new Map(core.slots().map(s=>[s.slot,s]));
    for(const file of files){
      if(!file.includes("/proof-inputs/")||!file.endsWith("/meta.json"))continue;
      if(onlySlot&&!file.includes("-block-"+onlySlot.slot+"-"))continue;
      const meta=JSON.parse(git(["show",head+":"+file]));
      if(meta.campaign!==core.campaign||onlySlot&&meta.slot!==onlySlot.slot)continue;
      const slot=slots.get(meta.slot);core.assert(slot,"Unknown archived slot");
      validateMeta(meta,slot,driverSha,pipelineSha);
      const dir=path.resolve(destination,"git-"+sha(meta.slot+"|"+meta.runId+"|"+meta.attempt).slice(0,24));
      fs.mkdirSync(dir,{recursive:true});
      const metaFile=path.join(dir,"meta.json");
      if(fs.existsSync(metaFile))core.assert(JSON.stringify(read(metaFile))===JSON.stringify(meta),"Conflicting copies of archived metadata");
      atomic(metaFile,meta);
      const parent=file.slice(0,-"meta.json".length);
      for(const name of ["checkpoint.json","result.json"])if(available.has(parent+name)){
        const data=JSON.parse(git(["show",head+":"+parent+name]));
        if(name==="checkpoint.json")core.validateCheckpoint(data,slot,expected);else core.validateRun(data,slot,expected);
        const target=path.join(dir,name);
        if(fs.existsSync(target))core.assert(JSON.stringify(read(target))===JSON.stringify(data),"Conflicting copies of archived data");
        atomic(target,data);
      }
    }
  }

  async function block(){
    verify();
    const slot=slotFromEnvironment(),jobDir=path.resolve("artifacts/strength-ci/job");
    fs.mkdirSync(jobDir,{recursive:true});
    const source=core.adapter(fs.readFileSync("benchmark.js","utf8"));
    const driverSha=sha(source),pipelineSha=sha(fs.readFileSync(__filename));
    const meta={campaign:core.campaign,...slot,attempt:Number(process.env.GITHUB_RUN_ATTEMPT||1),runId:String(process.env.GITHUB_RUN_ID||"local"),
      restoreOutcome:process.env.HEARTS_RESTORE_OUTCOME||null,workflowCommit:process.env.GITHUB_SHA||null,driverSha,pipelineSha,node:process.version,createdAt:new Date().toISOString(),
      reference:"Unmodified ai-v1; original observation; equal per-move budgets; minimum 16 worlds; no reference acceleration"};
    restoreGitArchive("artifacts/strength-ci/restore",slot,driverSha,pipelineSha);
    const candidates=[];
    for(const dir of [jobDir,...metadataDirectories("artifacts/strength-ci/restore")]){
      if(!fs.existsSync(path.join(dir,"meta.json")))continue;
      const previous=read(path.join(dir,"meta.json"));
      if(previous.campaign!==core.campaign||previous.slot!==slot.slot)continue;
      validateMeta(previous,slot,driverSha,pipelineSha);
      const checkpoint=path.join(dir,"checkpoint.json");
      if(fs.existsSync(checkpoint)){
        const saved=core.validateCheckpoint(read(checkpoint),slot,expected);
        candidates.push({dir,meta:previous,saved});
      }
    }
    candidates.sort((a,b)=>b.saved.records.length-a.saved.records.length||a.meta.attempt-b.meta.attempt||a.meta.runId.localeCompare(b.meta.runId));
    if(candidates.length){
      const best=candidates[0];
      for(const candidate of candidates){
        const n=Math.min(best.saved.records.length,candidate.saved.records.length);
        core.assert(JSON.stringify(best.saved.records.slice(0,n))===JSON.stringify(candidate.saved.records.slice(0,n)),"Conflicting checkpoint histories; preserve both for investigation");
      }
      atomic(path.join(jobDir,"checkpoint.json"),best.saved);
      meta.resumedFrom={attempt:best.meta.attempt,completedMatches:best.saved.records.length,benchmarkRunId:best.saved.runId};
      if(fs.existsSync(path.join(best.dir,"result.json"))){
        const result=core.validateRun(read(path.join(best.dir,"result.json")),slot,expected);
        core.assert(JSON.stringify(result.records)===JSON.stringify(best.saved.records),"Result and checkpoint disagree");
        atomic(path.join(jobDir,"result.json"),result);
      }
    }
    atomic(path.join(jobDir,"meta.json"),meta);
    const driver=path.resolve("benchmark-ci-adapter.mjs");
    fs.writeFileSync(driver,source);
    if(fs.existsSync(path.join(jobDir,"result.json"))){
      core.validateRun(read(path.join(jobDir,"result.json")),slot,expected);return;
    }
    for(let attempt=1;attempt<=3;attempt++){
      const child=cp.spawnSync(process.execPath,[driver,"4","--matches","--ms",String(slot.ms),"--samples","16","--seed",String(slot.seed)],
        {cwd:process.cwd(),env:{...process.env,HEARTS_CI_JOB:jobDir},stdio:"inherit"});
      if(child.status===0&&fs.existsSync(path.join(jobDir,"result.json"))){
        core.validateRun(read(path.join(jobDir,"result.json")),slot,expected);return;
      }
      console.error("Block process failed; resuming completed-match checkpoint. Attempt "+attempt+"/3");
    }
    throw Error("Block failed after three checkpointed attempts");
  }
  async function aggregate(){
    verify();
    const slots=core.slots(),byId=new Map(slots.map(s=>[s.slot,s])),found=new Map();
    const driverSha=sha(core.adapter(fs.readFileSync("benchmark.js","utf8"))),pipelineSha=sha(fs.readFileSync(__filename));
    const output=path.resolve("proof-report");fs.mkdirSync(output,{recursive:true});
    restoreGitArchive("proof-inputs",null,driverSha,pipelineSha);
    const excluded=[];
    for(const dir of metadataDirectories("proof-inputs")){
      const meta=read(path.join(dir,"meta.json"));
      if(meta.campaign!==core.campaign)continue;
      const slot=byId.get(meta.slot);core.assert(slot,"Unexpected slot");
      validateMeta(meta,slot,driverSha,pipelineSha);
      const result=path.join(dir,"result.json");
      if(!fs.existsSync(result))continue;
      const data=core.validateRun(read(result),slot,expected);
      if(!found.has(slot.slot))found.set(slot.slot,[]);
      found.get(slot.slot).push({dir,meta,data,file:result});
    }
    const selected=[],missing=[];
    for(const slot of slots){
      const candidates=found.get(slot.slot)||[],choice=core.chooseComplete(candidates);
      if(!choice){missing.push(slot.slot);continue;}
      selected.push({...choice,slot});
      for(const other of candidates)if(other!==choice)
        excluded.push({slot:slot.slot,file:other.file,attempt:other.meta.attempt,reason:"Earliest complete artifact selected before inspecting outcome; duplicates are not independent data"});
    }
    atomic(path.join(output,"campaign.json"),{campaign:core.campaign,planned:slots.length,complete:selected.length,missing,excluded,
      criterion:"All planned games completed; whole-four-seat-block bootstrap 95% lower bound above 25% separately at BOTH 200 and 1200 ms",
      earlierSeries:"The cloud-only 640/320 campaign became inaccessible after 367 verified completed 200-ms matches; further progress is unknown. Preserve and evaluate it separately when recovered. Never pool incomplete runs or omit unfavourable recovered data.",
      expectedSource:expected,node:process.version,driverSha,pipelineSha});
    core.assert(!missing.length,"Campaign incomplete; missing blocks: "+missing.join(","));
    const ids=new Set(),seeds={200:new Set(),1200:new Set()};
    for(const item of selected){
      core.assert(!ids.has(item.data.runId),"Duplicate benchmark run ID");ids.add(item.data.runId);
      core.assert(!seeds[item.slot.ms].has(item.slot.seed),"Overlapping deal blocks");seeds[item.slot.ms].add(item.slot.seed);
    }
    const reports=[];
    for(const ms of [200,1200]){
      const group=selected.filter(x=>x.slot.ms===ms),files=group.map(x=>path.resolve(x.file));
      const result=cp.spawnSync(process.execPath,["scripts/summarize-benchmarks.js",...files],{encoding:"utf8",maxBuffer:16*1024*1024});
      core.assert(result.status===0,result.stderr||"Summary failed");
      const report=JSON.parse(result.stdout);
      core.assert(report.games===(ms===200?640:320)&&report.independentDealBlocks===(ms===200?160:80),"Unexpected summary size");
      atomic(path.join(output,"summary-"+ms+"ms.json"),report);
      const rounds=group.reduce((n,x)=>n+x.data.rounds,0);
      reports.push({ms,games:report.games,winShare:report.winShares[0],interval:report.newWinShareBlockBootstrap95,
        criterionMet:report.newWinShareBlockBootstrap95[0]>.25,
        meanDecisionMs:[0,1].map(role=>group.reduce((n,x)=>n+x.data.meanDecisionMilliseconds[role]*x.data.rounds,0)/rounds)});
    }
    const demonstrated=reports.every(r=>r.criterionMet);
    atomic(path.join(output,"assessment.json"),{campaign:core.campaign,status:demonstrated?"demonstrated-at-both-budgets":"not-demonstrated",reports,
      limitation:"This is evidence against three frozen original copies at these two budgets. It is not a universal strength claim."});
    const lines=["# Frozen Hearts AI strength comparison","","Campaign: "+core.campaign+". One candidate against three unchanged original copies; complete matches to 100, four-seat rotations, equal configured budgets, minimum 16 worlds.","",
      "| Budget | Matches | New win share | 95% block interval | Criterion |","| --- | ---: | ---: | --- | --- |",
      ...reports.map(r=>"| "+r.ms+" ms | "+r.games+" | "+(r.winShare*100).toFixed(2)+"% | "+r.interval.map(n=>(n*100).toFixed(2)+"%").join(" – ")+" | "+(r.criterionMet?"met":"not met")+" |"),"",
      demonstrated?"The predeclared criterion is met at both tested budgets.":"The strength criterion is NOT met at both budgets. Preserve the results and continue improving the AI; do not repeatedly rerun this same campaign to seek a positive result.","",
      "The unavailable cloud campaign remains separate. Recover and report it if possible; this campaign does not erase its results.","",
      "Successful blocks and completed-match checkpoints are retained as immutable CI artifacts. Failed-block retries preserve run IDs and prior completed matches. Earliest complete duplicates are selected independently of their outcomes.",""];
    const markdown=lines.join("\n");
    fs.writeFileSync(path.join(output,"RESULTS.md"),markdown);
    if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,markdown);
    for(const file of Object.keys(expected)){const dest=path.join(output,"source",file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(file,dest);}
    fs.copyFileSync("scripts/hearts-strength-ci.cjs",path.join(output,"hearts-strength-ci.cjs"));
    fs.writeFileSync(path.join(output,"instrumented-benchmark.mjs"),core.adapter(fs.readFileSync("benchmark.js","utf8")));
    atomic(path.join(output,"source-manifest.json"),expected);
    if(!demonstrated)process.exitCode=2;
  }

  function persist(){
    const ref="refs/heads/codex/hearts-strength-results-85331e2-ci-v1";
    const run=String(process.env.GITHUB_RUN_ID||""),attempt=Number(process.env.GITHUB_RUN_ATTEMPT||0);
    core.assert(/^\d+$/.test(run)&&Number.isInteger(attempt)&&attempt>=1,"Archive requires a CI run identity");
    const index=path.join(process.env.RUNNER_TEMP||"/tmp","hearts-archive-index-"+process.pid);
    const env={...process.env,GIT_INDEX_FILE:index,GIT_AUTHOR_NAME:"github-actions[bot]",GIT_AUTHOR_EMAIL:"41898282+github-actions[bot]@users.noreply.github.com",GIT_COMMITTER_NAME:"github-actions[bot]",GIT_COMMITTER_EMAIL:"41898282+github-actions[bot]@users.noreply.github.com"};
    function git(args,input,encoding="utf8"){
      const r=cp.spawnSync("git",args,{env,input,encoding,maxBuffer:32*1024*1024});
      core.assert(r.status===0,"Archive Git operation failed: "+args[0]+" (status "+r.status+")");
      return r.stdout;
    }
    const files=[];
    function visit(dir){
      if(!fs.existsSync(dir))return;
      for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
        const file=path.join(dir,entry.name);
        if(entry.isDirectory())visit(file);
        else if(entry.isFile()&&(file.startsWith("proof-report"+path.sep)||["meta.json","checkpoint.json","result.json"].includes(entry.name)))files.push(file);
      }
    }
    visit("proof-report");visit("proof-inputs");
    core.assert(files.length,"No proof files to archive");
    for(let retry=0;retry<3;retry++){
      const remote=git(["ls-remote","--refs","origin",ref]).trim(),parent=remote?remote.split(/\s+/)[0]:null;
      if(parent)git(["fetch","--no-tags","origin",ref]);
      git(parent?["read-tree",parent]:["read-tree","--empty"]);
      const prefix="campaign/"+core.campaign+"/runs/"+run+"/attempt-"+attempt+"/";
      for(const file of files){
        const destination=prefix+file.split(path.sep).join("/");
        const blob=git(["hash-object","-w","--stdin"],fs.readFileSync(file)).trim();
        const old=git(["ls-files","--stage","--",destination]).trim();
        if(old)core.assert(old.split(/\s+/)[1]===blob,"Immutable archived file already exists with different contents");
        git(["update-index","--add","--cacheinfo","100644",blob,destination]);
      }
      const latest={campaign:core.campaign,runId:run,attempt,path:prefix,updatedAt:new Date().toISOString(),assessment:fs.existsSync("proof-report/assessment.json")?read("proof-report/assessment.json"):null};
      const latestBlob=git(["hash-object","-w","--stdin"],JSON.stringify(latest,null,2)+"\n").trim();
      git(["update-index","--add","--cacheinfo","100644",latestBlob,"LATEST.json"]);
      const tree=git(["write-tree"]).trim();
      const commit=git(["commit-tree",tree,...(parent?["-p",parent]:[])],"Archive frozen Hearts proof "+core.campaign+", CI run "+run+", attempt "+attempt+"\n").trim();
      const push=cp.spawnSync("git",["push","origin",commit+":"+ref],{env,encoding:"utf8",maxBuffer:1024*1024});
      if(push.status===0){fs.rmSync(index,{force:true});console.log("Proof data archived on "+ref);return;}
      console.error("Archive push failed; retrying against the latest remote head without force.");
    }
    throw Error("Could not persist proof Git archive; CI artifacts remain the fallback");
  }

  (async()=>{
    const mode=process.argv[2];
    if(mode==="plan"){verify();console.log(JSON.stringify({include:core.slots()}));}
    else if(mode==="verify"){verify();console.log("Frozen source verified: "+core.campaign);}
    else if(mode==="block")await block();
    else if(mode==="aggregate")await aggregate();
    else if(mode==="persist")persist();
    else throw Error("Use plan, verify, block, aggregate, or persist");
  })().catch(error=>{console.error(error.stack||String(error));process.exitCode=1;});
})(core,expected);

