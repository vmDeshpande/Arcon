#!/usr/bin/env python3
"""Generate Arcon V2 evaluation comparison report."""

import json
import os
from datetime import datetime

EVAL_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "outputs", "evaluation")

configs = [
    {"name": "Baseline", "file": "baseline.jsonl", "model": "Qwen/Qwen3-4B", "adapter": "None"},
    {"name": "Arcon V1", "file": "arcon-v1.jsonl", "model": "Qwen/Qwen3-4B", "adapter": "training/outputs/arcon-v1/adapter"},
    {"name": "Arcon V2 Epoch 2", "file": "arcon-v2-epoch2.jsonl", "model": "Qwen/Qwen3-4B", "adapter": "training/outputs/arcon-v2/checkpoints/checkpoint-epoch2-step237"},
    {"name": "Arcon V2 Epoch 3", "file": "arcon-v2-epoch3.jsonl", "model": "Qwen/Qwen3-4B", "adapter": "training/outputs/arcon-v2/adapter"},
]

results = {}
for cfg in configs:
    path = os.path.join(EVAL_DIR, cfg["file"])
    records = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            if line.strip():
                records.append(json.loads(line))
    results[cfg["name"]] = {"records": records, "config": cfg}

categories = ["identity", "cognition", "emotion", "curiosity", "memory", "personality", "anomalies", "general_capability", "multi_turn"]

report_lines = []
report_lines.append("# Arcon V2 Evaluation")
report_lines.append("")
report_lines.append("## Configurations")
report_lines.append("")
report_lines.append("| Configuration | Model | Adapter |")
report_lines.append("|---|---|---|")
for cfg in configs:
    report_lines.append(f"| {cfg['name']} | {cfg['model']} | {cfg['adapter']} |")
report_lines.append("")
report_lines.append("## Execution")
report_lines.append("")
report_lines.append("- Evaluation prompts: 100")
report_lines.append("- Configurations: 4")
report_lines.append("- Total generations: 400")
report_lines.append("")

report_lines.append("## Results")
report_lines.append("")
report_lines.append("| Configuration | Total | Completed | Failed | Avg Time (s) | Total Time (s) | Peak VRAM (MB) |")
report_lines.append("|---|---|---|---|---|---|---|")
for name, data in results.items():
    recs = data["records"]
    successful = [r for r in recs if r.get("response") is not None]
    failed = [r for r in recs if r.get("response") is None]
    avg_time = sum(r["generation_time_seconds"] for r in successful if r.get("generation_time_seconds")) / len(successful) if successful else 0
    total_time = sum(r["generation_time_seconds"] for r in successful if r.get("generation_time_seconds"))
    peak_vram = max(r.get("generation_time_seconds", 0) for r in recs)  # placeholder
    report_lines.append(f"| {name} | {len(recs)} | {len(successful)} | {len(failed)} | {avg_time:.2f} | {total_time:.2f} | N/A |")
report_lines.append("")

report_lines.append("## Category Comparison")
report_lines.append("")
header = "| Category | " + " | ".join(c["name"] for c in configs) + " |"
report_lines.append(header)
report_lines.append("|---" * (len(configs) + 1) + "|")
for cat in categories:
    row = f"| {cat} |"
    for cfg in configs:
        recs = results[cfg["name"]]["records"]
        count = sum(1 for r in recs if r.get("category") == cat)
        row += f" {count} |"
    report_lines.append(row)
report_lines.append("")

report_lines.append("## Sample Responses")
report_lines.append("")
for name, data in results.items():
    report_lines.append(f"### {name}")
    report_lines.append("")
    recs = data["records"]
    for r in recs[:3]:
        response = r.get("response", "FAILED")
        if response and len(response) > 200:
            response = response[:200] + "..."
        report_lines.append(f"- **{r['prompt_id']}** ({r['category']}): {response}")
    report_lines.append("")

report_lines.append("## Critical Failures")
report_lines.append("")
for name, data in results.items():
    failures = [r for r in data["records"] if r.get("response") is None]
    if failures:
        report_lines.append(f"### {name}")
        report_lines.append("")
        for r in failures:
            report_lines.append(f"- {r['prompt_id']}: {r.get('error', 'unknown')}")
        report_lines.append("")

report_lines.append("## Observations")
report_lines.append("")
report_lines.append("Baseline evaluation completed on vanilla Qwen3-4B without Arcon training or LoRA adapter.")
report_lines.append("")
report_lines.append("## Overall Recommendation")
report_lines.append("")
report_lines.append("PENDING_MANUAL_REVIEW")
report_lines.append("")

report_path = os.path.join(EVAL_DIR, "arcon-v2-comparison.md")
with open(report_path, "w", encoding="utf-8") as f:
    f.write("\n".join(report_lines))

print(f"Report saved to {report_path}")
