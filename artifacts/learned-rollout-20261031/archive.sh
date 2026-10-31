#!/usr/bin/env bash
# Preserve research without switching or changing the working branch/index.
set -euo pipefail
cd /workspace/Hertta-KI
archive_branch=codex/hearts-learned-rollout-research-20261031
archive_ref="refs/heads/$archive_branch"
archive_index=$(mktemp /tmp/hertta-learned-index.XXXXXX)
rm "$archive_index"
trap 'rm -f "$archive_index"' EXIT
export GIT_INDEX_FILE="$archive_index"
archive_parent=$(git rev-parse --verify "$archive_ref" 2>/dev/null || git rev-parse b1cf9f0)
git read-tree "$archive_parent"
git add -- scripts/prepare-analysis.js scripts/trace-matches.js scripts/benchmark-opponents.js scripts/calibrate-match-equity.js scripts/compare-match-variants.js scripts/compare-head-to-head.js scripts/extract-policy-data.js scripts/train-rollout-policy.py
python3 - <<'PY' | git add -f --pathspec-from-file=- --pathspec-file-nul
from pathlib import Path
import sys
root = Path('artifacts/learned-rollout-20261031')
for file in sorted(root.rglob('*')):
    if not file.is_file(): continue
    if file.name in ('policy-data.jsonl',) or file.suffix in ('.log', '.lock', '.tmp'): continue
    if any(part in ('comparator-checks', 'smoke') for part in file.relative_to(root).parts): continue
    if file.suffix not in ('.js', '.mjs', '.json', '.md', '.sh', '.gz'): continue
    sys.stdout.buffer.write(str(file).encode() + b'\0')
for file in sorted(Path('artifacts/match-research-20261031/baseline').rglob('*')):
    if file.is_file(): sys.stdout.buffer.write(str(file).encode() + b'\0')
PY
archive_tree=$(git write-tree)
archive_commit=$(git commit-tree "$archive_tree" -p "$archive_parent" -m "Preserve learned rollout research, frozen sources and complete-game checkpoints")
git update-ref "$archive_ref" "$archive_commit"
git push origin "$archive_branch"
git log -1 --format='%h %s' "$archive_ref"
