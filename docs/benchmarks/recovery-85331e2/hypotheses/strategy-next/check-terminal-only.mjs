import assert from 'node:assert/strict';
import {deal,createState,play,legal,roundScores} from './base/src/game.js';
import {conservativePolicy} from './base/src/reference-policy.js';
import {observe} from './base/src/observation.js';
import {decide as baseline} from './base/src/agent.js';
import {terminalWinShare} from './base/src/utility.js';
import {enumerateSmallDeals} from './belief-endgame.js';
import {decide} from './terminal-only-agent.js';
function seeded(seed){return()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);}
const copy=s=>({...s,hands:s.hands.map(h=>h.slice()),trick:s.trick.map(x=>({...x})),taken:s.taken.slice(),history:s.history.slice(),voids:s.voids.map(v=>v.slice()),played:s.played?.slice()});
let normal=0,proofs=0,terminals=0;
for(let seed=0;seed<16;seed++) {
  const rng=seeded(20270300+seed),state=createState(deal(rng));
  while(state.completed<11)play(state,conservativePolicy(state,rng));
  const player=state.turn,ordinary=observe(state,player);
  const base=baseline(ordinary,{milliseconds:0,minSamples:2,rng:seeded(seed+77)});
  const candidate=decide(ordinary,{milliseconds:0,minSamples:2,rng:seeded(seed+77)});
  assert.deepEqual(candidate,base,'ordinary-round behaviour must remain exact');normal++;
  const totals=[99,99,99,99].map((n,p)=>p===player?0:n),o=observe(state,player,{},totals);
  const before=structuredClone(o),result=decide(o,{milliseconds:0,minSamples:2,rng:seeded(seed+91)});
  assert.deepEqual(o,before);assert.ok(legal(state).includes(result.card));
  if(result.method!=='information-set-win')continue;
  proofs++;
  function verify(s) {
    if(s.completed===13){const scores=roundScores(s.taken);assert.ok(Math.max(...scores.map((n,p)=>n+totals[p]))>=100);assert.equal(terminalWinShare(scores,totals,player),1);terminals++;return;}
    const choices=legal(s);
    if(s.turn===player)assert.equal(choices.length,1,'future own actions must be forced without memory');
    for(const card of choices){const child=copy(s);play(child,card);verify(child);}
  }
  for(const hands of enumerateSmallDeals(o)) {
    const child={...copy(state),hands:hands.map(h=>h.slice())};play(child,result.card);verify(child);
  }
}
console.log(JSON.stringify({passed:true,ordinaryStatesExactlyPreserved:normal,terminalProofs:proofs,allAdversarialTerminalsVerified:terminals,noPrivateContinuationMemoryRequired:true,strengthEvidence:false}));
