import { legal, play, roundScores } from './base/src/game.js';
import { matchEndThreat, terminalWinShare } from './base/src/utility.js';
import { enumerateSmallDeals } from './belief-endgame.js';

export function certificateKey(o) {
 const actions=[...o.history.flatMap(t=>t.trick),...o.trick];
 return JSON.stringify([o.player,o.totals,Object.entries(o.known||{}),[...o.hand].sort((a,b)=>a-b),actions.map(x=>[x.player,x.card])]);
}

// AND/OR proof. A winning future action is the same for all remaining worlds
// at that public history. Return the continuation policy as well as the first
// action; merely solving a future world with extra information is insufficient.
export function certifySmallEndgame(o,{target=matchEndThreat(o)?1:26,nodeLimit=20000,timeLimit=30}={}) {
 const began=performance.now(), worlds=enumerateSmallDeals(o);
 if(!worlds)return null;
 const match=matchEndThreat(o), player=o.player;
 let nodes=0;
 function passes(s){
  const scores=roundScores(s.taken);
  const value=match?(Math.max(...scores.map((n,p)=>n+o.totals[p]))>=100?terminalWinShare(scores,o.totals,player):0):scores.reduce((n,x,p)=>n+(p===player?-3*x:x),0);
  return value>=target;
 }
 function search(s,possible){
  if(++nodes>nodeLimit||(nodes%64===0&&performance.now()-began>timeLimit))throw Error('budget');
  if(s.completed===13)return passes(s)?new Map():null;
  const own=s.turn===player,moves=new Set();
  for(const hands of own?[possible[0]]:possible)for(const card of legal({...s,hands}))moves.add(card);
  const policy=new Map();
  for(const card of moves){
   const compatible=possible.filter(hands=>legal({...s,hands}).includes(card));
   const child={...s,hands:compatible[0].map(h=>h.slice()),trick:s.trick.map(x=>({...x})),taken:s.taken.slice(),history:s.history.slice(),voids:s.voids.map(v=>v.slice())};
   play(child,card);
   const remaining=compatible.map(hands=>hands.map((h,p)=>p===s.turn?h.filter(c=>c!==card):h));
   const branch=search(child,remaining);
   if(own&&branch){
    branch.set(certificateKey({...s,hand:possible[0][player],player,totals:o.totals,known:o.known}),card);
    return branch;
   }
   if(!own&&!branch)return null;
   if(!own)for(const [key,value] of branch)policy.set(key,value);
  }
  return own?null:policy;
 }
 try{
  const state={...o,hands:worlds[0],history:o.history.slice()};
  const policy=search(state,worlds);
  if(!policy)return null;
  return {card:policy.get(certificateKey(o)),policy,target,match,worlds:worlds.length,nodes,milliseconds:performance.now()-began};
 }catch(error){if(error.message==='budget')return null;throw error;}
}
