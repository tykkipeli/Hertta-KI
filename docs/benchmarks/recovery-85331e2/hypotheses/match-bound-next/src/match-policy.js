import {strategicChoice as original} from './strategy.js';
import {finishCandidates} from './public-finish.js';
export function strategicChoice(v){
 if(v.length!==3||!v.totals)return original(v);
 const bound=finishCandidates(v.choices,v.turn,v.taken,v.totals,v.pot,c=>Math.floor(c/13)===v.led&&c%13>v.top?v.turn:v.winner);
 return original({...v,choices:bound.cards});
}
