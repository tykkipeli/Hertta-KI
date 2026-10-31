#!/usr/bin/env bash
set -euo pipefail
cd /workspace/Hertta-KI
worker="$1"
seed=$((20380131 + worker * 1000003))
root=artifacts/learned-rollout-20261031/screen
exec 9>"$root/worker-$worker.lock"
flock -n 9 || exit 0
for arm in control neural-opponents neural-all; do
  snapshot=artifacts/match-research-20261031/baseline
  if [ "$arm" != control ]; then snapshot="artifacts/learned-rollout-20261031/$arm/snapshot"; fi
  node scripts/benchmark-opponents.js --candidate "$snapshot" --baseline artifacts/match-research-20261031/baseline --out "$root/$arm/worker-$worker" --games 40 --ms 0 --samples 64 --seed "$seed" >> "$root/worker-$worker.log" 2>&1
done
