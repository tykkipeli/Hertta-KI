const fs=require('node:fs'),path=require('node:path');
const root=__dirname;
let ticks=0;
const timer=setInterval(()=>{
 try{
  const status=JSON.parse(fs.readFileSync(path.join(root,'status.json')));
  const jobs=status.jobs.filter(j=>j.milliseconds===200);
  let matches=0;
  for(const j of jobs){
   const file=path.join(root,'jobs',j.id,'checkpoint.json');
   if(fs.existsSync(file))matches+=JSON.parse(fs.readFileSync(file)).records.length;
  }
  console.log(JSON.stringify({at:new Date().toISOString(),completed:matches,target:640,state:status.state}));
  if(jobs.some(j=>j.state==='failed')||status.state==='failed'){
   console.log('FAILED '+JSON.stringify(status));clearInterval(timer);process.exitCode=1;return;
  }
  const assessment=path.join(root,'assessment.json');
  if(fs.existsSync(assessment)){
   const a=JSON.parse(fs.readFileSync(assessment));
   const result=a.budgets.find(b=>b.milliseconds===200);
   if(result?.state==='completed'){
    console.log('COMPLETE '+JSON.stringify(a));clearInterval(timer);return;
   }
  }
  if(++ticks>600){clearInterval(timer);throw Error('Primary benchmark exceeded ten hours; inspect environment and workers');}
 }catch(e){console.error(String(e));clearInterval(timer);process.exitCode=1;}
},60000);
console.log('Waiting for all 640 predeclared matches; no early success decisions.');
