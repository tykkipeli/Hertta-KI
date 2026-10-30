import {decide as baseline} from './base/src/agent.js';
import {certifySmallEndgame,certificateKey} from './belief-certificate.js';
import {moonPotential} from './base/src/strategy.js';
import {matchEndThreat} from './base/src/utility.js';
export {choosePass,observe} from './base/src/agent.js';
export {experimentalProvenance} from './provenance.js';
export const algorithm='Experimental information-set endgame certificates';
let continuation=new Map(),target;
export function decide(o,options={}){
 const key=certificateKey(o);
 if(continuation.has(key))return {card:continuation.get(key),method:'belief-proof',guaranteedValue:target,samples:0,simulations:0};
 const began=performance.now(),milliseconds=options.milliseconds??1200;
 if(o.counts.every(n=>n<=2)&&o.hand.length>1){
  const original=[...o.hand,...o.history.flatMap(t=>t.trick).concat(o.trick).filter(x=>x.player===o.player).map(x=>x.card)];
  const goal=matchEndThreat(o)?1:moonPotential(original)>0.7?78:26;
  const certificate=certifySmallEndgame(o,{target:goal,timeLimit:milliseconds?Math.min(30,milliseconds/4):30});
  if(certificate){continuation=certificate.policy;target=goal;return {card:certificate.card,method:'belief-proof',guaranteedValue:goal,worlds:certificate.worlds,nodes:certificate.nodes,samples:0,simulations:0};}
 }
 return baseline(o,{...options,milliseconds:Math.max(0,milliseconds-(performance.now()-began))});
}
