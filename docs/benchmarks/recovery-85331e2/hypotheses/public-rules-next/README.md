# Public-rule information hypothesis (not deployed)

Base runtime: 85331e2. The live 200/1200 ms confirmation remains unchanged. No playing-strength measurement has been performed for this hypothesis.

A legal unbroken-heart lead proves that the actor held only hearts then. A legal penalty discard on trick one proves no zero-point card remained then. Remaining cards cannot reappear in that player's hand later. The sampler groups unseen cards by admissible owners and counts complete assignments, retaining uniform probability across every rule-consistent assignment. The original sampler and random stream remain exact when no additional restriction applies. Deduced public voids are also passed to rollout pilots; no actual opponent hand is an input.

The independent checks reconstruct complete original hands and replay every public action with the game's legal-move function. They cover 624 legal observations, 512 first-trick-penalty hypotheses, 64 unbroken-heart hypotheses, exact comparison with exhaustive worlds in 24 small information sets, and the analytically known 12/13 queen-holder marginal. These validate rules and sampling, not strength.

Run the inexpensive correctness check with: node artifacts/public-rules-next/check-rules.mjs. CPU-intensive performance exploration must wait until the current confirmation ends or use independently isolated compute. Use fresh exploration and confirmation seeds and preserve negative results.
