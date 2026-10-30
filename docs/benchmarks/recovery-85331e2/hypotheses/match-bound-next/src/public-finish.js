import {points,legal,winner} from './game.js';
// Sufficient bounds derived only from public points, totals and this trick.
export function finishCandidates(choices,player,taken,totals,pot,winnerFor){
 if(!totals)return {cards:choices,reason:'unchanged'};
 const moves=choices.map(card=>{
  const after=taken.slice();after[winnerFor(card)]+=pot+points(card);
  const remaining=26-after.reduce((a,b)=>a+b,0),raw=after.map((n,p)=>n+totals[p]);
  const normal=after.filter(n=>n>0).length>=2,ends=raw.some(n=>n>=100);
  return {card,loses:normal&&ends&&raw.some((n,p)=>p!==player&&n+remaining<raw[player]),wins:normal&&ends&&raw.every((n,p)=>p===player||n>raw[player]+remaining)};
 });
 const wins=moves.filter(m=>m.wins),survives=moves.filter(m=>!m.loses);
 return {cards:(wins.length?wins:survives.length?survives:moves).map(m=>m.card),reason:wins.length?'forced-win':survives.length&&survives.length<moves.length?'avoid-proven-loss':'unchanged'};
}
export function publicMatchBounds(o,choices){
 if(o.trick.length!==3)return {cards:choices,reason:'unchanged'};
 const pot=o.trick.reduce((n,x)=>n+points(x.card),0);
 return finishCandidates(choices,o.player,o.taken,o.totals,pot,c=>winner([...o.trick,{player:o.player,card:c}]));
}
