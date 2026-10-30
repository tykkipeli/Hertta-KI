import assert from 'node:assert/strict';
import {createState,legal,play,deal} from './base/src/game.js';
import {observe} from './base/src/observation.js';
import {createDealSampler as originalSampler} from './base/src/deals.js';
import {createDealSampler,publicCardConstraints} from './deals.js';

let seed=20270119;
const rng=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
function handsWithSpecial(special) {
  const remaining=Array.from({length:52},(_,c)=>c).filter(c=>!special.includes(c));
  const others=[remaining.splice(0,13),remaining.splice(0,13),remaining];
  return [others[0],special,others[1],others[2]];
}
function replay(o,world) {
  const hands=world.hands.map(h=>h.slice());
  const actions=[...o.history.flatMap(t=>t.trick),...o.trick];
  for(const x of actions)hands[x.player].push(x.card);
  const state=createState(hands);
  for(const x of actions) {
    assert.equal(state.turn,x.player);
    assert.ok(legal(state).includes(x.card),'hypothesis contradicts a public legal action');
    play(state,x.card);
  }
  assert.equal(state.turn,o.turn);
  assert.deepEqual(state.taken,o.taken);
}
function exhaustivePublicWorlds(o) {
  const played=[...o.history.flatMap(t=>t.trick),...o.trick];
  const seen=new Set([...o.hand,...played.map(x=>x.card)]);
  const pool=Array.from({length:52},(_,c)=>c).filter(c=>!seen.has(c));
  const hands=Array.from({length:4},(_,p)=>p===o.player?o.hand.slice():[]);
  const worlds=new Set();
  const key=h=>JSON.stringify(h.map(cards=>cards.slice().sort((a,b)=>a-b)));
  function assign(i) {
    if(i===pool.length) {
      try {replay(o,{hands});worlds.add(key(hands));} catch(error) {if(error.code!=='ERR_ASSERTION')throw error;}
      return;
    }
    for(let p=0;p<4;p++)if(p!==o.player&&hands[p].length<o.counts[p]) {
      hands[p].push(pool[i]);assign(i+1);hands[p].pop();
    }
  }
  assign(0);return {worlds,key};
}
const penalty=createState(handsWithSpecial(Array.from({length:13},(_,i)=>39+i)));
play(penalty,0);play(penalty,39);
const penaltyObservation=observe(penalty,2);
const drawPenalty=createDealSampler(penaltyObservation);
assert.ok(drawPenalty.publicRuleConstraints);
// Player one holds twelve of the thirteen remaining eligible cards (12 hearts
// plus the queen). All thirteen omitted-card choices have equal completions.
let queen=0;
for(let i=0;i<512;i++) {
  const w=drawPenalty(rng);assert.ok(w);
  assert.ok(w.hands[1].every(c=>c>=39||c===36));
  queen+=w.hands[1].includes(36);replay(penaltyObservation,w);
}
assert.ok(Math.abs(queen/512-12/13)<0.06);
let choose=1;for(let i=1;i<=12;i++)choose=choose*(25-12+i)/i;
assert.ok(Math.abs(drawPenalty.totalDeals-13*choose)<0.01);

const heart=createState(handsWithSpecial([12,...Array.from({length:12},(_,i)=>39+i)]));
play(heart,0);play(heart,12);
while(heart.completed===0)play(heart,legal(heart)[0]);
assert.equal(heart.turn,1);assert.equal(heart.broken,false);
play(heart,39);
const heartObservation=observe(heart,heart.turn), drawHeart=createDealSampler(heartObservation);
assert.ok(drawHeart.publicRuleConstraints);
for(let i=0;i<64;i++) {
  const world=drawHeart(rng);assert.ok(world);
  assert.ok(world.hands[1].every(c=>c>=39));replay(heartObservation,world);
}

// With no additional public restriction, preserve every random draw and world.
const ordinary=createState(deal(rng)),o=observe(ordinary,ordinary.turn);
const beforeSeed=seed, oldWorld=originalSampler(o)(rng), afterSeed=seed;
seed=beforeSeed;const newWorld=createDealSampler(o)(rng);
assert.deepEqual(newWorld,oldWorld);assert.equal(seed,afterSeed);

// Every actual remaining card must retain positive support. Test complete
// legal rounds and independently replay sampled small remaining worlds.
let observations=0,changed=0;
for(let round=0;round<12;round++) {
  const state=createState(round===0?handsWithSpecial(Array.from({length:13},(_,i)=>39+i)):round===1?handsWithSpecial([12,...Array.from({length:12},(_,i)=>39+i)]):deal(rng));
  while(state.completed<13) {
    const o=observe(state,state.turn),allowed=publicCardConstraints(o);
    for(let p=0;p<4;p++)for(const c of state.hands[p])assert.ok(allowed[p][c],'actual legal hand excluded');
    if(state.hands.every(h=>h.length<=2)) {
      const sampler=createDealSampler(o),world=sampler(rng);assert.ok(world);replay(o,world);
      if(sampler.publicRuleConstraints) {
        changed++;
        const {worlds,key}=exhaustivePublicWorlds(o);
        assert.ok(Math.abs(sampler.totalDeals-worlds.size)<1e-9,'sampler must count precisely all rule-consistent worlds');
        for(let i=0;i<16;i++)assert.ok(worlds.has(key(sampler(rng).hands)));
      }
    }
    observations++;
    const choices=legal(state);play(state,choices[Math.floor(rng()*choices.length)]);
  }
}
const hidden=structuredClone(penaltyObservation);
const frozen=JSON.stringify(hidden);createDealSampler(hidden)(rng);assert.equal(JSON.stringify(hidden),frozen);
console.log(JSON.stringify({passed:true,observations,uniformQueenFrequency:queen/512,expectedQueenFrequency:12/13,smallChangedCases:changed,firstTrickPenaltyWorlds:512,unbrokenHeartWorlds:64,normalRngAndWorldPreserved:true}));
