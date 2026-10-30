const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process'),assert=require('node:assert/strict');
const prefix='docs/benchmarks/recovery-85331e2/';
const plan={stage:'exploration only, not strength confirmation',seed:20270201,games:80,oldSamples:16,newSamples:128,milliseconds:0,variants:{
  baseline:'src/ai.js',
  'public-rules':prefix+'hypotheses/public-rules-next/ai.js',
  'capacity-lead':prefix+'hypotheses/capacity-lead-next/ai.js',
  'public-bounds':prefix+'hypotheses/match-bound-next/experimental-engine.js',
  'endgame-proof':prefix+'hypotheses/strategy-next/certified-agent.js',
},criterion:'Compare full matches on identical fresh deal seeds. Report all variants and paired whole-four-seat-block differences. Do not treat a favourable screening result as a long-budget strength proof. Do not change the live 85331e2 confirmation.'};
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
function verify() {
  const expected=read(prefix+'manifest.json').hashes;
  for(const [file,hash] of Object.entries(expected)) {
    const actual=file==='benchmark-original.js'?'benchmark.js':file;
    if(file==='benchmark.js')continue;
    assert.equal(sha(actual),hash,'Frozen root changed: '+actual);
  }
  for(const engine of Object.values(plan.variants))assert.ok(fs.existsSync(engine),engine);
}
function run(label) {
  verify();assert.ok(Object.hasOwn(plan.variants,label));
  fs.mkdirSync('exploration',{recursive:true});
  fs.writeFileSync('exploration/plan.json',JSON.stringify({...plan,variant:label,engine:plan.variants[label],node:process.version,sourceCommit:process.env.GITHUB_SHA,checkpointDriverHash:sha('benchmark-next-exploration.mjs'),rootManifest:read(prefix+'manifest.json'),at:new Date().toISOString()},null,2)+'\n');
  const result=cp.spawnSync(process.execPath,['benchmark-next-exploration.mjs',String(plan.games),'--matches','--samples',String(plan.oldSamples),'--new-samples',String(plan.newSamples),'--seed',String(plan.seed),'--engine',plan.variants[label]],{encoding:'utf8',maxBuffer:8e6,env:{...process.env,HEARTS_CI_JOB:path.resolve('exploration')}});
  fs.writeFileSync('exploration/stdout.json',result.stdout||'');fs.writeFileSync('exploration/stderr.log',result.stderr||'');
  assert.equal(result.status,0,result.stderr||String(result.error));
  const meta=JSON.parse(result.stdout);const raw=read(meta.artifact);validate(raw,label);
  fs.copyFileSync(meta.artifact,'exploration/result.json');
  console.log(JSON.stringify({variant:label,completeGames:raw.games,winShare:raw.winShares[0],note:plan.stage}));
}
function validate(data,label) {
  assert.equal(data.games,plan.games);assert.equal(data.records.length,plan.games);assert.equal(data.seed,plan.seed);assert.equal(data.mode,'matches-to-100');
  assert.deepEqual(data.budget,{old:{milliseconds:0,minSamples:16},new:{milliseconds:0,minSamples:128}});
  assert.equal(data.enginePath,plan.variants[label]);assert.equal(data.sourceHashes.activeEngine,sha(plan.variants[label]));
  const expected=read(prefix+'manifest.json').hashes;
  for(const [file,hash] of Object.entries(expected))if(file.startsWith('src/')||file==='test/fixtures/ai-v1.js')assert.equal(data.sourceHashes[file],hash);
  if(label==='baseline')assert.equal(data.experimentalProvenance,null);
  else assert.deepEqual(data.experimentalProvenance?.hashes,read(path.join(path.dirname(plan.variants[label]),'manifest.json')).hashes);
  data.records.forEach((r,i)=>{
    assert.equal(r.game,i);assert.equal(r.newSeat,i%4);assert.ok(Number.isInteger(r.rounds)&&r.rounds>=4&&r.rounds<=16);assert.ok(r.totals.length===4&&r.totals.every(n=>Number.isInteger(n)&&n>=0));assert.ok(Math.max(...r.totals)>=100);
    assert.deepEqual(r.winners,r.totals.flatMap((n,p)=>n===Math.min(...r.totals)?[p]:[]));
    const extra=r.totals.reduce((a,b)=>a+b,0)-26*r.rounds;assert.ok(extra>=0&&extra%52===0&&extra/52<=r.rounds);
  });
  const wins=data.records.reduce((sum,r)=>sum+(r.winners.includes(r.newSeat)?1/r.winners.length:0),0)/plan.games;
  assert.ok(Math.abs(wins-data.winShares[0])<1e-12);
}
function aggregate() {
  verify();fs.mkdirSync('exploration-report',{recursive:true});
  const data=Object.fromEntries(Object.keys(plan.variants).map(label=>{
    const raw=read('exploration-inputs/hearts-next-exploration-v1-'+label+'/result.json');validate(raw,label);return [label,raw];
  }));
  const baseline=data.baseline,rows=[];
  let seed=20270202;const rng=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  const win=r=>r.winners.includes(r.newSeat)?1/r.winners.length:0;
  for(const [label,run] of Object.entries(data)) {
    const blocks=[];
    for(let i=0;i<plan.games;i+=4)blocks.push(run.records.slice(i,i+4).reduce((sum,row,k)=>sum+win(row)-win(baseline.records[i+k]),0)/4);
    const boot=[];for(let trial=0;trial<10000;trial++){let sum=0;for(let b=0;b<blocks.length;b++)sum+=blocks[Math.floor(rng()*blocks.length)];boot.push(sum/blocks.length);}boot.sort((a,b)=>a-b);
    rows.push({variant:label,games:run.games,winShare:run.winShares[0],pairedDifference:run.winShares[0]-baseline.winShares[0],pairedBlockBootstrap95:[boot[250],boot[9749]],meanDecisionMilliseconds:run.meanDecisionMilliseconds,changedMatchResults:run.records.filter((r,i)=>JSON.stringify(r)!==JSON.stringify(baseline.records[i])).length});
  }
  fs.writeFileSync('exploration-report/comparison.json',JSON.stringify({plan,rows,sourceRootManifest:read(prefix+'manifest.json'),limitation:'Small fixed-sample exploration, not a long-budget superiority proof. The endgame-proof wrapper also has a bounded proof-search time. Preserve all outcomes; any selected new candidate needs fresh independent 200/1200-ms confirmation.'},null,2)+'\n');
  const markdown=['# Exploratory variant comparison','',plan.stage+'. All variants use 80 full matches, the same fresh seeds, 128 candidate worlds and 16 unmodified original worlds per decision. Configured time limits are zero.','',
    '| Variant | Win share | Paired difference to baseline | Paired block interval |','| --- | ---: | ---: | --- |',
    ...rows.map(r=>'| '+r.variant+' | '+(100*r.winShare).toFixed(2)+'% | '+(100*r.pairedDifference).toFixed(2)+' pp | '+r.pairedBlockBootstrap95.map(n=>(100*n).toFixed(2)).join(' – ')+' pp |'),'',
    'These data select hypotheses for further investigation. They do not establish higher-budget superiority. Keep the frozen 85331e2 confirmation unchanged; any selected new source requires fresh independent long-budget holdout data.',''].join('\n');
  fs.writeFileSync('exploration-report/RESULTS.md',markdown);if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,markdown);console.log(markdown);
}
try {
  if(process.argv[2]==='verify')verify();
  else if(process.argv[2]==='run')run(process.argv[3]);
  else if(process.argv[2]==='aggregate')aggregate();
  else throw Error('Specify verify, run <variant>, or aggregate');
} catch(error) {console.error(error);process.exitCode=1;}
