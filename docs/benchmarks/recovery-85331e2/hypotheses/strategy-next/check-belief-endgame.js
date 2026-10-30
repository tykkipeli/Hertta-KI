import assert from 'node:assert/strict';
import {deal,createState,play,legal} from './base/src/game.js';
import {conservativePolicy} from './base/src/reference-policy.js';
import {observe} from './base/src/observation.js';
import {createDealSampler} from './base/src/deals.js';
import {solveKnownEndgame} from './base/src/endgame.js';
import {enumerateSmallDeals,solveBeliefEndgame} from './belief-endgame.js';
function rng(seed){return ()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);}
let checked=0,guaranteedWins=0,guaranteedSafe=0,maxNodes=0;
for(let seed=0;seed<24;seed++){
 const random=rng(seed+88771),state=createState(deal(random));
 while(state.completed<11)play(state,conservativePolicy(state,random));
 const totals=seed%2?[83,97,80,88]:[0,0,0,0];
 const o=observe(state,state.turn,{},totals), before=structuredClone(o);
 const worlds=enumerateSmallDeals(o),sampler=createDealSampler(o);
 assert.ok(worlds.length<=sampler.totalDeals);
 const exact=solveBeliefEndgame(o,{nodeLimit:1000000,timeLimit:Infinity});
 const unpruned=solveBeliefEndgame(o,{nodeLimit:1000000,timeLimit:Infinity,prune:false});
 assert.ok(exact);assert.ok(unpruned);assert.equal(exact.value,unpruned.value);
 assert.ok(legal(state).includes(exact.card));
 for(const hands of worlds){
  const perfect=solveKnownEndgame({...state,hands},o,{nodeLimit:1000000});
  assert.ok(exact.value<=perfect.value);
 }
 assert.deepEqual(o,before);
 assert.equal(solveBeliefEndgame(o,{nodeLimit:0}),null);
 checked++;guaranteedWins+=exact.terminal&&exact.value===1?1:0;
 guaranteedSafe+=!exact.terminal&&exact.value>=26?1:0;
 maxNodes=Math.max(maxNodes,unpruned.nodes);
}
console.log(JSON.stringify({checked,guaranteedWins,guaranteedSafe,maxNodes,description:'exact information-set structure checks, not playing-strength evidence'}));
