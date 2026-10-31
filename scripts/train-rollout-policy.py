"""Small listwise policy distillation; NumPy only, deterministic whole-block splits."""
import copy
import hashlib
import json
import os
import sys
import time
from pathlib import Path

# Do not exhaust the four-core environment with nested BLAS threads.
os.environ.setdefault("OPENBLAS_NUM_THREADS", "1")
os.environ.setdefault("OMP_NUM_THREADS", "1")
import numpy as np

root = Path(sys.argv[1] if len(sys.argv) > 1 else "artifacts/learned-rollout-20261031")
manifest = json.loads((root / "data-manifest.json").read_text())
assert hashlib.sha256((root / "policy-data.jsonl").read_bytes()).hexdigest() == manifest["dataSha256"]
records = [json.loads(line) for line in (root / "policy-data.jsonl").open()]
n, k, d = len(records), 13, 47
x = np.zeros((n, k, d), dtype=np.float32)
values = np.full((n, k), -1e9, dtype=np.float32)
mask = np.zeros((n, k), dtype=bool)
folds = np.zeros(n, dtype=np.int32)
blocks = np.zeros(n, dtype=np.uint32)
for i, row in enumerate(records):
    size = len(row["x"])
    x[i, :size] = row["x"]
    values[i, :size] = row["values"]
    mask[i, :size] = True
    folds[i], blocks[i] = row["fold"], row["blockSeed"]
del records
train, valid, test = np.flatnonzero(folds >= 2), np.flatnonzero(folds == 1), np.flatnonzero(folds == 0)
assert not set(blocks[train]) & set(blocks[valid])
assert not set(blocks[train]) & set(blocks[test])
assert not set(blocks[valid]) & set(blocks[test])
temperature = 2.0
targets = np.exp(np.maximum(-80, (values - values.max(axis=1, keepdims=True)) / temperature)) * mask
targets /= targets.sum(axis=1, keepdims=True)

def forward(data, params):
    if "w1" in params:
        hidden = np.maximum(0, data @ params["w1"] + params["b1"])
        return (hidden @ params["w2"]).reshape(data.shape[:-1]), hidden
    return (data @ params["w2"]).reshape(data.shape[:-1]), data

def metrics(indices, params=None, reference=False):
    if reference:
        logits = x[indices, :, 0]
    else:
        logits = forward(x[indices], params)[0]
    logits = np.where(mask[indices], logits, -1e9)
    chosen = logits.argmax(axis=1)
    regret = values[indices].max(axis=1) - values[indices, chosen]
    centered = logits - logits.max(axis=1, keepdims=True)
    log_z = np.log(np.exp(centered).sum(axis=1))
    ce = -np.sum(targets[indices] * centered, axis=1) + log_z
    return {"decisions": len(indices), "blocks": len(set(blocks[indices])), "teacherRegret": float(regret.mean()), "withinPoint2": float((regret <= 0.2).mean()), "crossEntropy": float(ce.mean())}

rng = np.random.default_rng(20370117)
report = {"dataSha256": manifest["dataSha256"], "featureSha256": manifest["featureSha256"], "seed": 20370117, "temperature": temperature, "split": manifest["split"], "selection": "Lowest validation teacher regret over epochs 5,10,...,40; test examined only after model selection. Imitation accuracy is not match strength.", "reference": {"validation": metrics(valid, reference=True), "test": metrics(test, reference=True)}, "models": {}}
began = time.monotonic()
for name, width in [("linear", 0), ("neural24", 24)]:
    if width:
        params = {"w1": rng.normal(0, 0.15, (d, width)).astype(np.float32), "b1": np.zeros(width, dtype=np.float32), "w2": rng.normal(0, 0.15, (width, 1)).astype(np.float32)}
    else:
        params = {"w2": np.zeros((d, 1), dtype=np.float32)}
    momentum = {key: np.zeros_like(v) for key, v in params.items()}
    variance = {key: np.zeros_like(v) for key, v in params.items()}
    step, history, best, best_score = 0, [], None, float("inf")
    for epoch in range(1, 41):
        ordering = rng.permutation(train)
        for start in range(0, len(ordering), 512):
            ix = ordering[start:start+512]
            data = x[ix]
            logits, hidden = forward(data, params)
            logits = np.where(mask[ix], logits, -1e9)
            prob = np.exp(logits - logits.max(axis=1, keepdims=True)) * mask[ix]
            prob /= prob.sum(axis=1, keepdims=True)
            delta = ((prob - targets[ix]) / len(ix)).reshape(-1, 1)
            h = hidden.reshape(-1, hidden.shape[-1])
            gradients = {"w2": h.T @ delta + 1e-5 * params["w2"]}
            if width:
                dh = (delta @ params["w2"].T) * (h > 0)
                gradients["w1"] = data.reshape(-1, d).T @ dh + 1e-5 * params["w1"]
                gradients["b1"] = dh.sum(axis=0)
            step += 1
            for key, gradient in gradients.items():
                momentum[key] = 0.9 * momentum[key] + 0.1 * gradient
                variance[key] = 0.999 * variance[key] + 0.001 * gradient ** 2
                params[key] -= 0.003 * (momentum[key] / (1 - 0.9 ** step)) / (np.sqrt(variance[key] / (1 - 0.999 ** step)) + 1e-8)
        if epoch % 5 == 0:
            score = metrics(valid, params)
            history.append({"epoch": epoch, **score})
            if score["teacherRegret"] < best_score:
                best_score, best = score["teacherRegret"], copy.deepcopy(params)
                selected_epoch = epoch
            print(json.dumps({"model": name, "epoch": epoch, **score, "seconds": time.monotonic() - began}), flush=True)
    exported = {key: value.tolist() for key, value in best.items()}
    (root / (name + "-weights.json")).write_text(json.dumps(exported) + "\n")
    report["models"][name] = {"width": width, "selectedEpoch": selected_epoch, "history": history, "validation": metrics(valid, best), "test": metrics(test, best)}
    # Cross-language inference fixtures from untouched test inputs.
    fixture_ix = test[:100]
    fixture = [{"features": x[i, mask[i]].tolist(), "logits": forward(x[i, mask[i]], best)[0].tolist()} for i in fixture_ix]
    (root / (name + "-fixtures.json")).write_text(json.dumps(fixture) + "\n")
report["seconds"] = time.monotonic() - began
(root / "training-report.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps(report))
