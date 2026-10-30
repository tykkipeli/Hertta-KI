import assert from 'node:assert/strict';
import { deal, createState, passCards, play } from './base/src/game.js';
import { choosePass as oldPass } from './base/test/fixtures/ai-v1.js';
import { choosePass } from './base/src/agent.js';
import { observe } from './base/src/observation.js';
import { conservativePolicy } from './base/src/reference-policy.js';
import { createDealSampler } from './base/src/deals.js';
import { createAcrossBelief } from './across-belief.js';
function rng(seed){return ()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);}
let truthChecks=0, sampledChecks=0, discounted=0;
for(const pass of [oldPass, choosePass])for(let seed=0;seed<40;seed++) {
 const random=rng(seed+103303), hands=deal(random), selections=hands.map(h=>pass(h));
 const sent={2:selections[0]},received={from:2,cards:selections[2]};
 passCards(hands,selections,2);const state=createState(hands);
 for(let step=0;step<48;step++){
  if(step%12===0){
   const o=observe(state,0,sent,[0,0,0,0],received),copy=structuredClone(o);
   const world=structuredClone(state), before=structuredClone(world);
   const draw=createDealSampler(o),belief=createAcrossBelief(o,draw);
   if(belief.weight){
    assert.equal(belief.weight(world),1);truthChecks++;
    for(let n=0;n<4;n++){
     const hypothetical=draw(random),weight=belief.weight(hypothetical);
     assert.ok(weight>0&&weight<=1);sampledChecks++;discounted+=weight<1;
    }
   }
   assert.deepEqual(o,copy);assert.deepEqual(world,before);
   assert.equal(createAcrossBelief({...o,humanPlayer:2},draw).mode,'uniform');
   assert.equal(createAcrossBelief({...o,received:{...received,from:1}},draw).mode,'uniform');
  }
  play(state,conservativePolicy(state,random));
 }
}
console.log(JSON.stringify({truthChecks,sampledChecks,discounted,description:'structural correctness only, no playing strength evidence'}));
