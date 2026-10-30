# Isolated confirmation of candidate 85331e2

Runtime is frozen from commit 85331e2 (same AI runtime as 03a5efe). See docs/VALIDATION.md: 640 complete matches at 200 ms per move, then 320 at 1,200 ms. Four workers run 160 and 80 matches each, with minimum 16 Monte Carlo worlds and the SAME budgets for every player. Exactly one new player competes against three frozen original ai-v1 copies. No reference execution acceleration, global clone replacement or substituted old observations is installed. Public original input format is retained for the old AI.

Primary criterion: completed 640-game 200-ms series, 95% whole-four-seat-block bootstrap interval entirely above 25%. Evaluate 1,200 ms separately. Do not pool versions or time budgets. Record negative outcomes. No result is promised in advance. Seeds: 20261260, 21261263, 22261266, 23261269. The earlier 9caa65f setup trial and superseded queue are NOT confirmation data.

The controller waits for ready.json (source and checks verified), then for the previous original 1,200-ms series and exploratory benchmark processes to finish. It then uses four workers within the environment's four-core CPU quota. Do not launch CPU-intensive experiments concurrently with this confirmation.

All source hashes, normal original benchmark and checkpoint driver are in manifest.json and snapshot/. A four-game deterministic test showed exact agreement between normal and checkpoint benchmark records, and checkpoint reload retained all records and the run ID. No runtime source is edited during the series. Atomic checkpoints save every completed match. Progress is saved every round. Failed workers retry up to three times and repeat only the incomplete current match.

Inspect status.json, jobs/*/progress.json, jobs/*/checkpoint.json, jobs/*/worker.log. Full finished data are jobs/*/result.json. The controller writes summary-200ms.json and summary-1200ms.json after all jobs; the first may also be calculated once its four workers have finished. watcher.cjs can evaluate completed budgets earlier and prints progress without reporting interim strength claims.

Detached start/resume from repository root:

```sh
nohup setsid node artifacts/strategy-validation-85331e2/runner.cjs >> artifacts/strategy-validation-85331e2/runner.log 2>&1 < /dev/null &
```

PID lock prevents duplicates and detects zombie processes. Cloud suspension or destruction can still stop the work. Files are local and ignored by Git. A restored environment may need this command again. Inspect a suspicious stale lock before removing it. Never reset source snapshots or discard failed test outcomes to obtain a favourable result.
