# Public-capacity lead model (unconfirmed research)

Base runtime: 85331e2. Separate from public-rules-next; neither changes the running 200/1200 ms confirmation. No playing-strength result exists.

The baseline lead model assigns each unseen card independently to an eligible opponent. This can assign both a lower and a higher card to an opponent who publicly has only one card left. With three one-card opponents and two lower plus one higher unseen cards, it predicts a 5/9 probability that all higher-card holders can duck; the correct value is zero.

The new approximation allocates cards to public hand slots without replacement and uses inclusion-exclusion over at most three opponents. Only each actor's own hypothetical hand, public plays, public voids and public hand counts enter the pilot. No other hypothetical hand identity is inspected. The model is exact under this slot assumption; other suits' voids, known passed ranks and strategic opponent choices remain approximations.

An independent exhaustive physical-slot enumerator matches 197 cases covering 8,526 allocations. Mathematical zero and one bounds are handled explicitly, and numeric-only callers preserve the original heuristic. Correctness and integration checks do not demonstrate better match play. Use fresh independent exploration and confirmation before deployment.

Check: node artifacts/capacity-lead-next/check-lead.mjs. Defer CPU-intensive exploration until the live confirmation finishes or use independently isolated compute.
