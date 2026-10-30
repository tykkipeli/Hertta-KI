import {leadWinProbability as independent} from './base/src/lead.js';

const binomial=Array.from({length:40},()=>Array(40).fill(0));
for(let n=0;n<40;n++) {
  binomial[n][0]=1;
  for(let k=1;k<=n;k++)binomial[n][k]=(binomial[n-1]?.[k-1]||0)+(binomial[n-1]?.[k]||0);
}
const choose=(n,k)=>n>=0&&k>=0&&k<=n?binomial[n][k]:0;
const cache=new Map();

// Same ducking model as the original lead heuristic, but cards occupy actual
// public hand slots without replacement. It remains an approximation when
// other suits' voids or an opponent's strategic choices affect allocation.
export function leadWinProbability(capacities,lower,higher) {
  if(!Array.isArray(capacities))return independent(capacities,lower,higher);
  const caps=capacities.filter(n=>n>0).slice().sort((a,b)=>a-b);
  if(!caps.length||higher===0)return 1;
  if(lower===0)return 0;
  const total=caps.reduce((a,b)=>a+b,0);
  if(lower+higher>total)throw Error('More unseen suit cards than eligible public hand slots');
  const maximumHigherWithCover=caps.slice(-Math.min(lower,caps.length)).reduce((a,b)=>a+b,0)-lower;
  if(higher>maximumHigherWithCover)return 0;
  if(lower+higher===total&&higher<caps[0])return 1;
  const key=caps.join(',')+';'+lower+';'+higher;
  if(cache.has(key))return cache.get(key);
  const subsets=1<<caps.length,space=Array(subsets).fill(0),parity=Array(subsets).fill(1);
  for(let s=1;s<subsets;s++)for(let p=0;p<caps.length;p++)if(s&(1<<p)) {
    space[s]+=caps[p];parity[s]=-parity[s];
  }
  let probability=0;
  const lowDenom=choose(total,lower),highDenom=choose(total-lower,higher);
  for(let s=0;s<subsets;s++) {
    const noLow=choose(total-space[s],lower)/lowDenom;
    if(!noLow)continue;
    let atLeastOneHigherEach=0,t=s;
    do {
      atLeastOneHigherEach+=parity[t]*choose(total-space[t]-lower,higher)/highDenom;
      t=(t-1)&s;
    }while(t!==s);
    probability+=parity[s]*noLow*atLeastOneHigherEach;
  }
  probability=Math.max(0,Math.min(1,probability));
  cache.set(key,probability);return probability;
}
