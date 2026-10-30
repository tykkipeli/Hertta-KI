import assert from 'node:assert/strict';
import {leadWinProbability} from './lead.js';
import {leadWinProbability as previous} from './base/src/lead.js';

// Independent exhaustive physical-slot allocation. Every placement of the
// lower and higher cards in distinct slots has equal probability.
function exhaustive(caps,lower,higher) {
  const owners=caps.flatMap((n,p)=>Array(n).fill(p));
  const lows=Array(caps.length).fill(0),highs=Array(caps.length).fill(0);
  let wins=0,worlds=0;
  function assign(at,l,h) {
    if(at===owners.length) {
      if(l||h)return;worlds++;
      if(highs.every((n,p)=>n===0||lows[p]>0))wins++;
      return;
    }
    if(owners.length-at>l+h)assign(at+1,l,h);
    const p=owners[at];
    if(l){lows[p]++;assign(at+1,l-1,h);lows[p]--;}
    if(h){highs[p]++;assign(at+1,l,h-1);highs[p]--;}
  }
  assign(0,lower,higher);assert.ok(worlds);return {value:wins/worlds,worlds};
}
let cases=0,worlds=0;
for(const caps of [[1],[2],[3],[1,1],[1,2],[2,2],[1,1,1],[1,1,2],[1,2,2],[2,2,2],[1,2,3],[2,3,3]]) {
  const total=caps.reduce((a,b)=>a+b,0);
  for(let l=0;l<=total;l++)for(let h=0;h<=total-l;h++) {
    const reference=exhaustive(caps,l,h);
    const actual=leadWinProbability(caps,l,h);
    assert.ok(Math.abs(actual-reference.value)<1e-12,JSON.stringify({caps,l,h,actual,expected:reference.value}));
    assert.equal(leadWinProbability(caps.slice().reverse(),l,h),actual);
    cases++;worlds+=reference.worlds;
  }
}
assert.equal(leadWinProbability([1,1,1],2,1),0);
assert.ok(previous(3,2,1)>0.5);
assert.equal(leadWinProbability([13,13,13],5,0),1);
assert.equal(leadWinProbability([13,13,13],0,5),0);
assert.equal(leadWinProbability([],0,0),1);
for(let n=1;n<=3;n++)for(let l=0;l<5;l++)for(let h=0;h<5;h++)assert.equal(leadWinProbability(n,l,h),previous(n,l,h));
console.log(JSON.stringify({passed:true,exactCapacityCases:cases,physicalAllocations:worlds,oldLastCardEstimate:previous(3,2,1),correctedLastCardEstimate:leadWinProbability([1,1,1],2,1),strengthEvidence:false}));
