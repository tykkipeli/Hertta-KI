# Two-card proof and worker lifecycle

The current information-set proof is restricted to at most two remaining cards per player. After the chosen first card, our player has at most one card left, so every later own move is forced. The module-local continuation Map is therefore unnecessary for card-choice correctness at this limit: a fresh browser worker must play the same sole legal card. Private continuation transfer would become necessary only if the solver were extended to larger own hands with later branching choices. Do not add worker-state plumbing solely for the present two-card proof.

The fixed-sample screening of the original proof wrapper did not show an improvement. Its nonterminal ordinary-zero overrides are not equivalent to guaranteed match wins. Preserve the negative screening result and test any revised override criterion separately.
