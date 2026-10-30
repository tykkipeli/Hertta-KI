import {createDealSampler as originalSampler} from './base/src/deals.js';
import {shuffle} from './base/src/game.js';

// Additional hard constraints follow from public legal actions alone:
// leading an unbroken heart proves only hearts remained, and discarding a
// penalty on trick one proves that no zero-point card remained then.
export function publicCardConstraints(o) {
  const allowed = Array.from({length: 4}, () => Array(52).fill(true));
  for (let p = 0; p < 4; p++) for (const s of o.voids[p]) {
    for (let c = s * 13; c < (s + 1) * 13; c++) allowed[p][c] = false;
  }
  let broken = false;
  for (const [index, trick] of [...o.history.map(t => t.trick), o.trick].entries()) {
    if (!trick.length) continue;
    const led = Math.floor(trick[0].card / 13);
    for (let at = 0; at < trick.length; at++) {
      const {player, card} = trick[at], color = Math.floor(card / 13);
      if (at === 0 && color === 3 && !broken) {
        for (let c = 0; c < 39; c++) allowed[player][c] = false;
      }
      if (at > 0 && color !== led) {
        for (let c = led * 13; c < (led + 1) * 13; c++) allowed[player][c] = false;
        if (index === 0 && (card >= 39 || card === 36)) {
          for (let c = 0; c < 39; c++) if (c !== 36) allowed[player][c] = false;
        }
      }
      if (color === 3) broken = true;
    }
  }
  return allowed;
}

export function createDealSampler(o) {
  const original = originalSampler(o), allowed = publicCardConstraints(o);
  const voids = allowed.map(cards => [0,1,2,3].filter(s => cards.slice(s*13,(s+1)*13).every(yes => !yes)));
  const players = [0, 1, 2, 3].filter(p => p !== o.player);
  const seen = new Set([...o.hand, ...o.history.flatMap(t => t.trick.map(x => x.card)), ...o.trick.map(x => x.card)]);
  const fixed = Array.from({length: 4}, () => []);
  fixed[o.player] = o.hand.slice();
  for (const [owner, cards] of Object.entries(o.known || {})) {
    const p = Number(owner);
    if (p === o.player) continue;
    for (const c of cards) if (!seen.has(c)) {fixed[p].push(c); seen.add(c);}
  }
  const pool = Array.from({length: 52}, (_, c) => c).filter(c => !seen.has(c));
  const capacity = players.map(p => o.counts[p] - fixed[p].length);
  const invalid = capacity.some(n => n < 0) || capacity.reduce((a,b) => a+b,0) !== pool.length || fixed.some((hand,p) => hand.some(c => !allowed[p][c]));
  const nullSampler = Object.assign(() => null, {totalDeals: 0, publicRuleConstraints: true});
  if (invalid) return nullSampler;
  // Preserve the exact old random stream when no additional information exists.
  const changed = pool.some(c => players.some((p,i) => capacity[i] > 0 && !o.voids[p].includes(Math.floor(c/13)) && !allowed[p][c]));
  if (!changed) {
    if (voids.every((colors,p) => colors.every(s => o.voids[p].includes(s)))) return original;
    const draw = rng => {
      const world = original(rng);
      return world ? {...world, voids: voids.map(colors => colors.slice())} : null;
    };
    return Object.assign(draw, {totalDeals: original.totalDeals, publicRuleConstraints: true});
  }
  const byMask = new Map();
  for (const c of pool) {
    const mask = players.reduce((n,p,i) => n | (allowed[p][c] && capacity[i] > 0 ? 1 << i : 0),0);
    if (!mask) return nullSampler;
    if (!byMask.has(mask)) byMask.set(mask, []);
    byMask.get(mask).push(c);
  }
  const groups = [...byMask].sort((a,b) => bits(a[0])-bits(b[0]) || a[0]-b[0]);
  function bits(n) {return (n&1)+((n>>1)&1)+((n>>2)&1);}
  const factorial=[1];for(let i=1;i<=39;i++)factorial[i]=factorial[i-1]*i;
  const memo = new Map();
  function allocations(g, cap, visit) {
    const [mask,cards] = groups[g], n=cards.length;
    for(let a=mask&1?Math.max(0,n-cap[1]-cap[2]):0;a<=Math.min(n,mask&1?cap[0]:0);a++) {
      for(let b=mask&2?Math.max(0,n-a-cap[2]):0;b<=Math.min(n-a,mask&2?cap[1]:0);b++) {
        const c=n-a-b;if(c>cap[2] || (c && !(mask&4)))continue;
        visit([a,b,c],factorial[n]/(factorial[a]*factorial[b]*factorial[c]));
      }
    }
  }
  function ways(g,cap) {
    if(cap.some(n=>n<0))return 0;
    if(g===groups.length)return cap.every(n=>n===0)?1:0;
    const key=g*196+cap[0]*14+cap[1];if(memo.has(key))return memo.get(key);
    let total=0;allocations(g,cap,(allocation,multiple)=>{total+=multiple*ways(g+1,cap.map((n,i)=>n-allocation[i]));});
    memo.set(key,total);return total;
  }
  const totalDeals=ways(0,capacity);
  if(!totalDeals)return nullSampler;
  const played=Array(52).fill(false);for(const t of [...o.history,{trick:o.trick}])for(const x of t.trick)played[x.card]=true;
  const draw=(rng=Math.random)=>{
    const hands=fixed.map(h=>h.slice());let cap=capacity.slice();
    for(let g=0;g<groups.length;g++) {
      let target=rng()*ways(g,cap),selected;
      allocations(g,cap,(allocation,multiple)=>{
        if(selected)return;const weight=multiple*ways(g+1,cap.map((n,i)=>n-allocation[i]));
        if(weight<=0)return;target-=weight;if(target<0)selected=allocation;
      });
      if(!selected)return null;
      const cards=shuffle(groups[g][1].slice(),rng);let at=0;
      selected.forEach((n,i)=>{hands[players[i]].push(...cards.slice(at,at+n));at+=n;cap[i]-=n;});
    }
    for(const p of players)shuffle(hands[p],rng);
    return {hands,turn:o.turn,trick:o.trick.map(x=>({...x})),taken:o.taken.slice(),broken:o.broken,completed:o.completed,history:o.history.slice(),voids:voids.map(v=>v.slice()),played:played.slice()};
  };
  return Object.assign(draw,{totalDeals,publicRuleConstraints:true});
}
export function sample(o,rng=Math.random) {return createDealSampler(o)(rng);}
