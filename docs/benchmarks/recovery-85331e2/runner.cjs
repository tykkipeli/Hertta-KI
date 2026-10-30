const fs = require('node:fs');
const path = require('node:path');
const {spawn, spawnSync} = require('node:child_process');
const root = __dirname, snapshot = path.join(root, 'snapshot');
function atomic(file, data) {fs.writeFileSync(file+'.tmp',JSON.stringify(data,null,2)+'\n');fs.renameSync(file+'.tmp',file);}
const lock = path.join(root,'runner.pid');
if(fs.existsSync(lock)) {
  const pid=Number(fs.readFileSync(lock,'utf8'));
  let running=false; try{process.kill(pid,0);const stat=fs.readFileSync("/proc/"+pid+"/stat","utf8").split(") ")[1];running=stat[0]!=="Z";}catch{}
  if(running) throw Error('Runner already active: '+pid);
}
fs.writeFileSync(lock,String(process.pid));
const budgets=[200,1200];
const jobs = budgets.flatMap(milliseconds=>Array.from({length:4},(_,worker)=>({id:milliseconds+'ms-'+worker,worker,milliseconds,seed:20261260+worker*1000003,games:milliseconds===200?160:80,state:'pending'})));
const plan={createdAt:new Date().toISOString(),commit:'85331e2',totalMatches:960,concurrency:4,minimumSamples:16,budgets,jobs:jobs.map(j=>({...j})),protocol:'One frozen new AI versus three frozen original AIs; equal per-move budget; complete matches to 100; four-seat rotation; source snapshot; checkpoints after each match.'};
if(!fs.existsSync(path.join(root,'plan.json')))atomic(path.join(root,'plan.json'),plan);
const status={pid:process.pid,startedAt:new Date().toISOString(),state:'running',jobs};
function save(){status.updatedAt=new Date().toISOString();for(const job of jobs){const progress=path.join(root,'jobs',job.id,'progress.json');if(fs.existsSync(progress))try{job.progress=JSON.parse(fs.readFileSync(progress));}catch{}}atomic(path.join(root,'status.json'),status);}
save(); const heartbeat=setInterval(save,30000);
process.on('SIGHUP',()=>{});
async function run(job){
 const dir=path.join(root,'jobs',job.id);fs.mkdirSync(dir,{recursive:true});
 const result=path.join(dir,'result.json');
 if(fs.existsSync(result)&&JSON.parse(fs.readFileSync(result)).games===job.games){job.state='completed';save();return;}
 const args=['benchmark.js',String(job.games),'--matches','--ms',String(job.milliseconds),'--samples','16','--seed',String(job.seed)];
 for(let attempt=1;attempt<=3;attempt++){
  job.state='running';job.attempt=attempt;job.startedAt=new Date().toISOString();
  const log=fs.openSync(path.join(dir,'worker.log'),'a');
  const child=spawn(process.execPath,args,{cwd:snapshot,env:{...process.env,HEARTS_JOB_DIR:dir},stdio:['ignore',log,log]});fs.closeSync(log);job.pid=child.pid;save();
  const code=await new Promise(resolve=>{child.once('error',error=>{job.error=String(error);resolve(-1);});child.once('exit',(code,signal)=>{job.exitSignal=signal;resolve(code);});});
  job.exitCode=code;
  if(code===0&&fs.existsSync(result)&&JSON.parse(fs.readFileSync(result)).games===job.games){job.state='completed';job.finishedAt=new Date().toISOString();save();return;}
  save();await new Promise(resolve=>setTimeout(resolve,1000));
 }
 job.state='failed';save();
}
(async()=>{
 const prior=path.resolve(root,'../overnight-20261029/status.json');
 function matchingProcess(pid,marker){try{const stat=fs.readFileSync('/proc/'+pid+'/stat','utf8').split(') ')[1];return stat[0]!=='Z'&&fs.readFileSync('/proc/'+pid+'/cmdline','utf8').includes(marker);}catch{return false;}}
 status.state='waiting-for-ready';save();
 while(!fs.existsSync(path.join(root,'ready.json')))await new Promise(resolve=>setTimeout(resolve,1000));
 status.state='waiting-for-other-benchmarks';save();
 while(true){
  let baselineRunning=false;
  if(fs.existsSync(prior)){const previous=JSON.parse(fs.readFileSync(prior));baselineRunning=previous.state==='running'&&matchingProcess(previous.pid,'overnight-20261029/runner.cjs');}
  const researchRunning=[46549,48256].some(pid=>matchingProcess(pid,'benchmark-fast-reference.js'));
  if(!baselineRunning&&!researchRunning)break;
  await new Promise(resolve=>setTimeout(resolve,30000));save();
 }
 status.state='running';status.actualBenchmarkStartedAt=new Date().toISOString();save();
 await Promise.all(Array.from({length:4},async(_,worker)=>{for(const budget of budgets)await run(jobs.find(j=>j.worker===worker&&j.milliseconds===budget));}));
 for(const budget of budgets){const group=jobs.filter(j=>j.milliseconds===budget);if(!group.every(j=>j.state==='completed'))continue;
  const output=spawnSync(process.execPath,['scripts/summarize-benchmarks.js',...group.map(j=>path.join(root,'jobs',j.id,'result.json'))],{cwd:snapshot,encoding:'utf8'});
  if(output.status!==0){status.summaryError=output.stderr;continue;}
  fs.writeFileSync(path.join(root,'summary-'+budget+'ms.json'),output.stdout);
 }
 status.state=jobs.every(j=>j.state==='completed')&&!status.summaryError?'completed':'failed';status.finishedAt=new Date().toISOString();clearInterval(heartbeat);save();
})().catch(error=>{status.state='failed';status.error=String(error);clearInterval(heartbeat);save();process.exitCode=1;});
