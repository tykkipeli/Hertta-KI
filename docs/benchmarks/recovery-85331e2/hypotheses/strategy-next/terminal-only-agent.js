import {decide as baseline} from './base/src/agent.js';
import {certifySmallEndgame} from './belief-certificate.js';
import {matchEndThreat} from './base/src/utility.js';
import {legal} from './base/src/game.js';
export {choosePass,observe,sample,policy} from './base/src/agent.js';
export {experimentalProvenance} from './provenance.js';
export const algorithm='Experimental terminal-only information-set win certificates';

export function decide(o,options={}) {
  const began=performance.now(),milliseconds=options.milliseconds??1200;
  if(o.hand.length===2&&o.counts.every(n=>n<=2)&&matchEndThreat(o)) {
    const choices=legal({...o,hands:Array.from({length:4},(_,p)=>p===o.player?o.hand:[])});
    if(choices.length>1) {
      const proof=certifySmallEndgame(o,{target:1,timeLimit:milliseconds?Math.min(8,milliseconds/50):30});
      if(proof) return {
        card:proof.card,method:'information-set-win',objective:'match-win',
        guaranteedWinShare:1,winProbability:1,worlds:proof.worlds,nodes:proof.nodes,
        samples:0,simulations:0,
      };
    }
  }
  // With two own cards, playing the certified first card leaves only one.
  // Every later own move is forced, so fresh workers need no cached policy.
  return baseline(o,{...options,milliseconds:Math.max(0,milliseconds-(performance.now()-began))});
}
