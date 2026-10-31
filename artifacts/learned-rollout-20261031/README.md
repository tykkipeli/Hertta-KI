# Learned rollout research — experimental

This archive preserves an experiment, not an adopted AI or a completed strength claim.
The production baseline is b1cf9f0 (PR8). No experimental runtime files are installed in src/.

93,332 non-forced ordinary-round search decisions were extracted from 1,120 previous
complete matches. Search labels use 64 worlds; the source manifests and original
trace hashes are in data-manifest.json. The feature extractor receives only the
acting player's hand and public information. It does not use real opponent hands
or final match outcomes. Private known-pass memory is not represented.

Whole independent four-seat deal blocks are assigned to training, validation or
test by a deterministic hash. There are 75,504 / 7,379 / 10,449 decisions in those
sets. A scalar action score is learned by listwise soft-target cross entropy.
The 47-input, 24-ReLU-unit network is selected by validation teacher-value regret,
with test examined only after selection. See training-report.json and
heldout-imitation-bootstrap.json. Better imitation is not a strength proof.

## Reproduce training

Node.js >=22, Python3 and NumPy are sufficient; no training framework or remote
AI service is used. training-provenance.json records versions and source hashes.

From the repository root on this archive branch:

```sh
gzip -dc artifacts/learned-rollout-20261031/training-data.jsonl.gz > artifacts/learned-rollout-20261031/policy-data.jsonl
OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 python3 scripts/train-rollout-policy.py artifacts/learned-rollout-20261031
node artifacts/learned-rollout-20261031/check-policy-invariants.mjs
```

The training program validates the decompressed dataset SHA256. Original full
traces are not duplicated here; compressed feature/label data are sufficient to
retrain, while trace hashes preserve provenance. The invariant check additionally
needs the original local self-play trace, so it is optional on a restored archive;
its completed 2,000-case report is policy-invariants.json. Cross-language logits
can be checked directly against neural24-fixtures.json without those traces.

## Match screen

screen/plan.json predates match evaluation: 160 complete games per arm, three arms,
four seat rotations, fresh seeds disjoint from all training-source deal blocks.
One candidate plays against three unchanged recent baseline copies. All four
players receive exactly64 worlds per action and zero wall-clock budget.
Engines are uninstrumented; each worker resumes from complete-match checkpoints.
Passing, hidden-hand sampler, root objective and exact known endgames are unchanged.

Do not inspect partial win rates or edit frozen sources. After all workers finish:

```sh
node scripts/compare-head-to-head.js artifacts/learned-rollout-20261031/screen
```

The comparator checks sources, budgets, complete records, point invariants, seat
rotation, independent blocks and paired whole-block bootstrap intervals.
Candidate selection is exploratory; any positive selection needs fresh independent
confirmation. Fixed-world strength does not establish equal-time GUI strength.

Runtime profiles reveal a substantial computation cost, especially if the network
controls every simulated actor. The `*-fast` snapshots transpose sparse matrix
evaluation; 100 inference fixtures and 40 complete search decisions match the
original exactly, including estimates and caller RNG use. They are not substituted
into the already-running screen. The unrolled inference alternative was slower
and is preserved as a rejected speed experiment.

This branch is a source/data backup. It does not merge PRs, deploy the application,
publish an environment, or start a GitHub Actions workflow.
