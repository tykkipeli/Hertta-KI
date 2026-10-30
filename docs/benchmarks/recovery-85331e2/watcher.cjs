const fs = require("node:fs");
const path = require("node:path");
const {spawnSync} = require("node:child_process");
const root = __dirname;
const {createHash} = require("node:crypto");
const manifest = JSON.parse(fs.readFileSync(path.join(root,"manifest.json")));
function verifyResults(jobs,files){
 for(const [file,expected] of Object.entries(manifest.hashes)){
  const actual=createHash("sha256").update(fs.readFileSync(path.join(root,"snapshot",file))).digest("hex");
  if(actual!==expected)throw Error("Frozen source changed: "+file);
 }
 files.forEach((file,i)=>{
  const data=JSON.parse(fs.readFileSync(file)),job=jobs[i];
  if(data.games!==job.games||data.records.length!==job.games||data.seed!==job.seed||data.mode!=="matches-to-100")throw Error("Unexpected run parameters: "+file);
  if(data.experimentalProvenance)throw Error("Experimental reference forbidden");
  for(const role of ["old","new"])if(data.budget[role].milliseconds!==job.milliseconds||data.budget[role].minSamples!==16)throw Error("Unequal budget: "+file);
  for(const [key,value] of Object.entries(data.sourceHashes)){
   const expected=manifest.hashes[key==="activeEngine"?"src/ai.js":key];
   if(!expected||value!==expected)throw Error("Result source mismatch: "+key);
  }
  for(const key of Object.keys(manifest.hashes).filter(k=>k.startsWith("src/")||k==="test/fixtures/ai-v1.js"))if(data.sourceHashes[key]!==manifest.hashes[key])throw Error("Missing source hash: "+key);
  data.records.forEach((row,n)=>{if(row.game!==n||row.newSeat!==n%4||Math.max(...row.totals)<100)throw Error("Incomplete match or rotation: "+file);});
 });
}
function atomic(file,data){fs.writeFileSync(file+".tmp",JSON.stringify(data,null,2)+"\n");fs.renameSync(file+".tmp",file);}
function inspect(){
 const status=JSON.parse(fs.readFileSync(path.join(root,"status.json")));
 const assessment={at:new Date().toISOString(),controllerState:status.state,budgets:[]};
 for(const ms of [200,1200]){
  const jobs=status.jobs.filter(j=>j.milliseconds===ms);
  const files=jobs.map(j=>path.join(root,"jobs",j.id,"result.json"));
  const games=jobs.reduce((n,j)=>{const checkpoint=path.join(root,"jobs",j.id,"checkpoint.json");if(fs.existsSync(path.join(root,"jobs",j.id,"result.json")))return n+j.games;try{const c=JSON.parse(fs.readFileSync(checkpoint));return n+(c.completedGames??c.records?.length??j.progress?.completedGames??0);}catch{return n+(j.progress?.completedGames??0);}},0);
  const row={milliseconds:ms,completedGames:games,targetGames:jobs.reduce((n,j)=>n+j.games,0),state:"pending"};
  if(files.every(f=>fs.existsSync(f))){
   verifyResults(jobs,files);
   const output=path.join(root,"summary-"+ms+"ms.json");
   if(!fs.existsSync(output)){
    const result=spawnSync(process.execPath,["scripts/summarize-benchmarks.js",...files],{cwd:path.join(root,"snapshot"),encoding:"utf8"});
    if(result.status!==0)throw Error(result.stderr);
    atomic(output,JSON.parse(result.stdout));
   }
   const data=JSON.parse(fs.readFileSync(output));
   row.state="completed";row.winShare=data.winShares[0];row.interval95=data.newWinShareBlockBootstrap95;
   row.criterionMet=row.interval95[0]>0.25;row.sourceAndProtocolVerified=true;
  }
  assessment.budgets.push(row);
 }
 atomic(path.join(root,"assessment.json"),assessment);
 console.log(JSON.stringify(assessment));
 return assessment.budgets.every(b=>b.state==="completed")||status.state==="failed";
}
let timer;function tick(){try{if(inspect())clearInterval(timer);}catch(e){console.error(new Date().toISOString(),String(e));}}
timer=setInterval(tick,60000);tick();
