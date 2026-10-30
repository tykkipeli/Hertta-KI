const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const ms=Number(process.argv[2]||200);assert.ok([200,1200].includes(ms));
const root=path.resolve(__dirname,'../ci-proof-85331e2-ci-v1'),pipeline=fs.readFileSync(__dirname+'/runner.cjs','utf8');
const start=pipeline.indexOf('const expected='),end=pipeline.indexOf(';\n(function nodeProgram',start);
assert.ok(start>0&&end>start);
const core=new Function(pipeline.slice(0,start)+'\nreturn core;')();
const expected=JSON.parse(pipeline.slice(start+'const expected='.length,end));
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
for(const [file,sha]of Object.entries(expected))assert.equal(hash(fs.readFileSync(file)),sha,'Frozen root changed: '+file);
const driverSha=hash(core.adapter(fs.readFileSync('benchmark.js','utf8'))),pipelineSha=hash(pipeline);
const slots=core.slots().filter(s=>s.ms===ms),byId=new Map(slots.map(s=>[s.slot,s])),found=new Map();
function directories(dir){const out=[];for(const entry of fs.readdirSync(dir,{withFileTypes:true})){assert.ok(!entry.isSymbolicLink(),'Unexpected symbolic link in proof data');if(entry.isDirectory())out.push(...directories(path.join(dir,entry.name)));}if(fs.existsSync(path.join(dir,'meta.json')))out.push(dir);return out;}
for(const dir of directories(root+'/raw-'+ms+'ms')) {
  const meta=JSON.parse(fs.readFileSync(dir+'/meta.json'));
  assert.equal(meta.campaign,core.campaign);const slot=byId.get(meta.slot);assert.ok(slot,'Unexpected slot: '+meta.slot);
  for(const key of ['slot','seed','ms','worker','block'])assert.equal(meta[key],slot[key]);
  assert.equal(meta.driverSha,driverSha);assert.equal(meta.pipelineSha,pipelineSha);assert.ok(Number.isInteger(meta.attempt)&&meta.attempt>=1&&/^\d+$/.test(meta.runId));
  if(!fs.existsSync(dir+'/result.json'))continue;
  const data=core.validateRun(JSON.parse(fs.readFileSync(dir+'/result.json')),slot,expected);
  if(fs.existsSync(dir+'/checkpoint.json')) {
    const checkpoint=core.validateCheckpoint(JSON.parse(fs.readFileSync(dir+'/checkpoint.json')),slot,expected);
    assert.equal(checkpoint.runId,data.runId);assert.deepEqual(checkpoint.records,data.records.slice(0,checkpoint.records.length));
  }
  if(!found.has(slot.slot))found.set(slot.slot,[]);found.get(slot.slot).push({dir,meta,data});
}
const target=root+'/selected-'+ms+'ms';fs.mkdirSync(target,{recursive:true});
const selected=[],excluded=[],runIds=new Set(),dealSeeds=new Set();
const legacy=new Set();for(let w=0;w<4;w++)for(let b=0;b<(ms===200?40:20);b++)legacy.add(20261260+w*1000003+b*65537);
for(const slot of slots) {
  const candidates=found.get(slot.slot)||[],choice=core.chooseComplete(candidates);assert.ok(choice,'Missing complete slot: '+slot.slot);
  assert.ok(!runIds.has(choice.data.runId),'Duplicate benchmark run ID');runIds.add(choice.data.runId);
  assert.ok(!dealSeeds.has(slot.seed)&&!legacy.has(slot.seed),'Overlapping deal seeds');dealSeeds.add(slot.seed);
  const file=target+'/'+slot.slot+'.json';fs.copyFileSync(choice.dir+'/result.json',file);
  selected.push({slot:slot.slot,seed:slot.seed,file,origin:choice.dir,runId:choice.data.runId,workflowRunId:choice.meta.runId,attempt:choice.meta.attempt});
  for(const other of candidates)if(other!==choice)excluded.push({slot:slot.slot,origin:other.dir,reason:'Earliest complete workflow run and attempt selected before inspecting outcome; duplicate data are not independent'});
}
const selection={at:new Date().toISOString(),campaign:core.campaign,milliseconds:ms,selectedBlocks:selected.length,games:selected.length*4,driverSha,pipelineSha,expectedSource:expected,seedsDisjointFromOriginalCampaign:true,selectionRule:'Earliest complete workflow run/attempt, independently of outcome',selected,excluded};
fs.writeFileSync(root+'/selection-'+ms+'ms.json',JSON.stringify(selection,null,2)+'\n');
fs.writeFileSync(root+'/selected-'+ms+'ms-files.txt',selected.map(s=>s.file).join('\n')+'\n');
console.log(JSON.stringify({allBlocksValidated:true,milliseconds:ms,blocks:selected.length,games:selection.games,seedsDisjointFromOriginalCampaign:true,notPooledWithOriginalCampaign:true}));
