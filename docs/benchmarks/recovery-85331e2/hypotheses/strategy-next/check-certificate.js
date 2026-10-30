import assert from 'node:assert/strict';
import {deal,createState,play,legal,roundScores} from './base/src/game.js';
import {conservativePolicy} from './base/src/reference-policy.js';
import {observe} from './base/src/observation.js';
import {terminalWinShare,matchEndThreat} from './base/src/utility.js';
import {enumerateSmallDeals,solveBeliefEndgame} from './belief-endgame.js';
import {certificateKey,certifySmallEndgame} from './belief-certificate.js';
function rng(seed){return ()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);}
function copy(s){return {...s,hands:s.hands.map(h=>h.slice()),trick:s.trick.map(x=>({...x})),taken:s.taken.slice(),history:s.history.slice(),voids:s.voids.map(v=>v.slice()),played:s.played?.slice()};}
let tested=0,certificates=0,leaves=0;
for(let seed=0;seed<24;seed++){
 const random=rng(seed+88771),state=createState(deal(random));
 while(state.completed<11)play(state,conservativePolicy(state,random));
 const player=state.turn;
 for(const totals of [[0,0,0,0],[99,99,99,99].map((n,p)=>p===player?0:n)]){
  const o=observe(state,player,{},totals),before=structuredClone(o);
  const reference=solveBeliefEndgame(o,{nodeLimit:1000000,timeLimit:Infinity});
  const target=matchEndThreat(o)?1:26;
  const certificate=certifySmallEndgame(o,{nodeLimit:1000000,timeLimit:Infinity});
  assert.equal(!!certificate,reference.value>=target);
  assert.deepEqual(o,before);
  if(!certificate){tested++;continue;}
  assert.ok(legal(state).includes(certificate.card));
  function verify(s){
   if(s.completed===13){
    const scores=roundScores(s.taken);
    if(certificate.match){assert.ok(Math.max(...scores.map((n,p)=>n+totals[p]))>=100);assert.equal(terminalWinShare(scores,totals,player),1);}
    else assert.ok(scores.reduce((n,x,p)=>n+(p===player?-3*x:x),0)>=target);
    leaves++;return;
   }
   const moves=s.turn===player?[certificate.policy.get(certificateKey(observe(s,player,{},totals)))]:legal(s);
   for(const card of moves){assert.ok(legal(s).includes(card));const next=copy(s);play(next,card);verify(next);}
  }
  for(const hands of enumerateSmallDeals(o))verify({...copy(state),hands});
  certificates++;tested++;
 }
}
console.log(JSON.stringify({tested,certificates,allAdversarialTerminalsVerified:leaves,description:'certificate and continuation checks only, not match strength evidence'}));
