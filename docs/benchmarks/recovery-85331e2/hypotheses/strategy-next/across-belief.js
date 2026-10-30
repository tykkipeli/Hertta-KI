import { defensiveRisk, moonPotential } from './base/src/strategy.js';

// Experimental only. Uses public history and the observer's own exchange.
export function createAcrossBelief(o, draw) {
  const received = o.received;
  const uniform = { mode: 'uniform', next: rng => draw(rng) };
  if (!received || received.cards?.length !== 3 || received.from === o.player || received.from === o.humanPlayer || draw.totalDeals === 1) return uniform;
  const other = received.from;
  const sent = o.known?.[other];
  if (sent?.length !== 3) return uniform;
  const publicCards = [...o.history.flatMap(t => t.trick), ...o.trick].filter(x => x.player === other).map(x => x.card);
  function weight(world) {
    const after = [...world.hands[other], ...publicCards];
    if (after.length !== 13 || new Set(after).size !== 13 || !sent.every(c => after.includes(c))) return 1;
    const retained = after.filter(c => !sent.includes(c));
    const original = [...retained, ...received.cards].sort((a,b) => a-b);
    if (new Set(original).size !== 13) return 1;
    const counts = [0,0,0,0];
    original.forEach(c => counts[Math.floor(c/13)]++);
    const danger = c => (c===36?24:c===37?22:c===38?21:c%13) + (c>=39?4:0) + (counts[Math.floor(c/13)]<=3 && Math.floor(c/13)!==2?7:0);
    const oldPass = [...original].sort((a,b) => danger(b)-danger(a)).slice(0,3);
    if (received.cards.every(c => oldPass.includes(c))) return 1;
    // Moon-pass preferences differ. Retain all mass when plausible rather than
    // interpreting a moon attempt as an implausible defensive pass.
    if (moonPotential(original)>0.7) return 1;
    const baseline = defensiveRisk(retained);
    // A globally minimal whole-hand choice necessarily survives every one-card
    // swap. This weaker condition avoids recalculating 286 choices per world.
    for (let i=0;i<retained.length;i++) for (const c of received.cards) {
      const changed = retained.slice(); changed[i]=c;
      if (defensiveRisk(changed)<baseline-1e-10) return 0.2;
    }
    return 1;
  }
  return { mode:'experimental-own-across-exchange', weight, next(rng) {
    let world;
    for (let i=0;i<128;i++) {
      world=draw(rng); if(!world) return null;
      if(rng()<weight(world)) return world;
    }
    return world;
  }};
}
