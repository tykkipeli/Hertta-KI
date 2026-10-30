# Unconfirmed public match-ending bounds

Not deployed. Base runtime is frozen candidate 85331e2. No performance outcome exists yet. Do not run CPU-intensive exploration concurrently with the live confirmation.

The fourth player can know who receives a completed trick. With two or more existing point takers, shooting the moon can no longer reverse penalties. If public totals plus points already taken guarantee that the match ends, adding all remaining penalties to each opponent in turn gives a conservative upper bound on how low anyone can finish relative to us. Cards proving a certain loss are removed when an alternative exists; cards proving a certain outright win are preferred. All ties and possible moon reversals remain outside these strict certificates.

The same rule is available to our own rollout pilot via public totals. Opponent pilots retain their original model. No other actual hand is an input. Passing, queen inference, and the frozen reference are otherwise unchanged.

This is a rule-correctness argument, not an independent statistical playing-strength result. Prototype public score bounds were independently verified over 182 legal moves, including 20 certain wins, 72 certain losses and 1,579 possible remaining point allocations. The isolated series 85331e2 must still finish unchanged. If this hypothesis is later investigated, use fresh training and confirmation seeds and report every outcome.
