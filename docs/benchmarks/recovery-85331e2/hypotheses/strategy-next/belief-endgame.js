import {legal, play, roundScores, createState} from './base/src/game.js';
import {matchEndsThisRound,matchEndThreat,terminalWinShare} from './base/src/utility.js';

// Experimental exact adversarial search with a shared information set. Unlike
// solving each sampled deal separately, future own moves cannot depend on an
// unseen assignment. An opposing public card narrows the possible worlds.
export function enumerateSmallDeals(o,{maxWorlds=90}={}) {
 if(o.counts.some(n=>n>2))return null;
 const hands=Array.from({length:4},()=>[]);hands[o.player]=o.hand.slice();
 const seen=new Set([...o.hand,...o.history.flatMap(t=>t.trick.map(x=>x.card)),...o.trick.map(x=>x.card)]);
 for(const [owner,cards] of Object.entries(o.known||{}))for(const c of cards){
  if(!seen.has(c)){hands[Number(owner)].push(c);seen.add(c);}
 }
 const pool=Array.from({length:52},(_,c)=>c).filter(c=>!seen.has(c));
 const capacity=o.counts.map((n,p)=>n-hands[p].length);
 if(capacity.some(n=>n<0)||capacity.reduce((a,b)=>a+b,0)!==pool.length)return null;
 if(hands.some((hand,p)=>hand.some(c=>o.voids[p].includes(Math.floor(c/13)))))return null;
 const worlds=[];
 const publicActions=[...o.history.flatMap(t=>t.trick),...o.trick];
 function agreesWithAllPublicRules(remaining){
  // Public legal actions reveal more than ordinary follow-suit voids: an
  // unbroken-heart lead, for example, shows that only hearts were held then.
  const original=remaining.map(h=>h.slice());
  for(const x of publicActions)original[x.player].push(x.card);
  if(original.some(h=>h.length!==13||new Set(h).size!==13))return false;
  const state=createState(original);
  for(const x of publicActions){
   if(state.turn!==x.player||!legal(state).includes(x.card))return false;
   play(state,x.card);
  }
  return state.turn===o.turn&&state.completed===o.completed&&state.broken===o.broken&&state.taken.every((n,p)=>n===o.taken[p]);
 }
 function assign(i){
  if(worlds.length>maxWorlds)return;
  if(i===pool.length){if(agreesWithAllPublicRules(hands))worlds.push(hands.map(h=>h.slice().sort((a,b)=>a-b)));return;}
  const c=pool[i];
  for(let p=0;p<4;p++)if(p!==o.player&&capacity[p]>0&&!o.voids[p].includes(Math.floor(c/13))){
   hands[p].push(c);capacity[p]--;assign(i+1);capacity[p]++;hands[p].pop();
  }
 }
 assign(0);return worlds.length&&worlds.length<=maxWorlds?worlds:null;
}

export function solveBeliefEndgame(o,{nodeLimit=20000,timeLimit=10,prune=true}={}){
 const started=performance.now(),worlds=enumerateSmallDeals(o);
 if(!worlds)return null;
 const terminal=matchEndsThisRound(o)||matchEndThreat(o),player=o.player;
 let nodes=0;
 function utility(s){
  const scores=roundScores(s.taken);
  return terminal?(Math.max(...scores.map((n,p)=>n+o.totals[p]))>=100?terminalWinShare(scores,o.totals,player):0):scores.reduce((n,x,p)=>n+(p===player?-3*x:x),0);
 }
 function search(s,possible,alpha,beta){
  if(++nodes>nodeLimit||(nodes%64===0&&performance.now()-started>timeLimit))throw Error('budget');
  if(s.completed===13)return utility(s);
  const own=s.turn===player;
  const moves=new Set();
  for(const hands of own?[possible[0]]:possible)for(const card of legal({...s,hands}))moves.add(card);
  let best=own?-Infinity:Infinity;
  for(const card of moves){
   const compatible=possible.filter(hands=>legal({...s,hands}).includes(card));
   const child={...s,hands:compatible[0].map(h=>h.slice()),trick:s.trick.map(x=>({...x})),taken:s.taken.slice(),history:[],voids:s.voids.map(v=>v.slice())};
   play(child,card);
   const remaining=compatible.map(hands=>hands.map((h,p)=>p===s.turn?h.filter(c=>c!==card):h));
   const result=search(child,remaining,alpha,beta);
   if(own){best=Math.max(best,result);alpha=Math.max(alpha,best);}else{best=Math.min(best,result);beta=Math.min(beta,best);}
   if(prune&&alpha>=beta)break;
  }
  return best;
 }
 try{
  let value=-Infinity,card;
  const state={...o,hands:worlds[0],history:[]};
  const upper=terminal?1:78;
  for(const c of legal(state)){
   const child={...state,hands:worlds[0].map(h=>h.slice()),trick:o.trick.map(x=>({...x})),taken:o.taken.slice(),history:[],voids:o.voids.map(v=>v.slice())};
   play(child,c);
   const remaining=worlds.map(hands=>hands.map((h,p)=>p===player?h.filter(x=>x!==c):h));
   const result=search(child,remaining,prune?value:-Infinity,Infinity);
   if(result>value){value=result;card=c;}
   if(prune&&value===upper)break;
  }
  return {card,value,terminal,nodes,worlds:worlds.length,milliseconds:performance.now()-started};
 }catch(error){if(error.message==='budget')return null;throw error;}
}
