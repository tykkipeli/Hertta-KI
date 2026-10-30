import assert from 'node:assert/strict';
import {publicMatchBounds as reference} from '../public-finish-research.mjs';
import {publicMatchBounds} from './src/public-finish.js';
import {strategicChoice} from './src/match-policy.js';
import {choosePass} from './src/agent.js';
import {deal,createState,play,legal,points,suit,rank,winner} from './src/game.js';
import {observe} from './src/observation.js';
import {conservativePolicy} from './src/reference-policy.js';
function rng(seed){return ()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);}
for(let seed=0;seed<100;seed++){
 const random=rng(seed+71632),state=createState(deal(random));
 while(!(state.completed===11&&state.trick.length===3))play(state,conservativePolicy(state,random));
 const totals=Array.from({length:4},()=>Math.floor(random()*35)+65);
 const o=observe(state,state.turn,{},totals),choices=legal(state);
 const expected=reference(o),actual=publicMatchBounds(o,choices);
 assert.deepEqual(actual.cards,expected.cards);assert.equal(actual.reason,expected.reason);
 const led=suit(state.trick[0].card);
 const v={hand:o.hand,choices,turn:o.player,taken:o.taken,totals,led,top:Math.max(...state.trick.filter(x=>suit(x.card)===led).map(x=>rank(x.card))),pot:state.trick.reduce((n,x)=>n+points(x.card),0),length:3,winner:winner(state.trick),completed:11,played:state.played};
 assert.ok(actual.cards.includes(strategicChoice(v)));
}
assert.deepEqual(choosePass([0,5,9,19,20,26,27,28,29,30,31,37,49]),[19,20,49]);
console.log('100 legal positions: root and own rollout guards agree with independently enumerated bounds; requested passing hand unchanged.');
