#!/usr/bin/env python3
"""Assemble Arcon Training Dataset V1 from source files."""

import json
import os
import hashlib
from datetime import datetime
from collections import Counter

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCES_DIR = os.path.join(BASE_DIR, "datasets", "arcon_v1", "sources")
OUTPUT_DIR = os.path.join(BASE_DIR, "datasets", "arcon_v1")
os.makedirs(OUTPUT_DIR, exist_ok=True)

SOURCE_FILES = [
    "identity.jsonl",
    "cognition.jsonl",
    "emotion.jsonl",
    "curiosity.jsonl",
    "memory.jsonl",
    "personality.jsonl",
    "anomalies.jsonl",
]

train_examples = []
val_examples = []

for filename in SOURCE_FILES:
    path = os.path.join(SOURCES_DIR, filename)
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            example = json.loads(line)
            split = example.get("metadata", {}).get("split", "train")
            if split == "validation":
                val_examples.append(example)
            else:
                train_examples.append(example)

# Write train.jsonl
train_path = os.path.join(OUTPUT_DIR, "train.jsonl")
with open(train_path, "w", encoding="utf-8") as f:
    for ex in train_examples:
        f.write(json.dumps(ex, ensure_ascii=False) + "\n")

# Write validation.jsonl
val_path = os.path.join(OUTPUT_DIR, "validation.jsonl")
with open(val_path, "w", encoding="utf-8") as f:
    for ex in val_examples:
        f.write(json.dumps(ex, ensure_ascii=False) + "\n")

# Build manifest
all_examples = train_examples + val_examples
category_counts = Counter(ex.get("metadata", {}).get("category", "unknown") for ex in all_examples)
train_category_counts = Counter(ex.get("metadata", {}).get("category", "unknown") for ex in train_examples)
val_category_counts = Counter(ex.get("metadata", {}).get("category", "unknown") for ex in val_examples)

difficulty_counts = Counter(ex.get("metadata", {}).get("difficulty", "unknown") for ex in all_examples)

max_content_len = max(
    len(m.get("content", ""))
    for ex in all_examples
    for m in ex.get("messages", [])
)

# Compute hashes for duplicate detection
content_hashes = Counter()
for ex in all_examples:
    msgs = ex.get("messages", [])
    content = " ".join(m.get("content", "") for m in msgs)
    h = hashlib.md5(content.encode("utf-8")).hexdigest()
    content_hashes[h] += 1

duplicate_hashes = {h: c for h, c in content_hashes.items() if c > 1}

manifest = {
    "dataset_name": "Arcon Training Dataset V1",
    "version": "v1.0.0",
    "created_at": datetime.utcnow().isoformat() + "Z",
    "base_model": "Qwen/Qwen3-4B",
    "training_method": "QLoRA",
    "total_examples": len(all_examples),
    "train_examples": len(train_examples),
    "validation_examples": len(val_examples),
    "categories": dict(category_counts),
    "train_categories": dict(train_category_counts),
    "validation_categories": dict(val_category_counts),
    "difficulty_distribution": dict(difficulty_counts),
    "max_content_length": max_content_len,
    "creation_method": "Manual curation from Arcon specification documents",
    "validation_status": "pending",
    "known_limitations": [
        "Small dataset size — intended as a behavioral foundation, not final model.",
        "Does not cover all Arcon specification categories.",
        "No real Arcon conversation data included yet.",
        "Validation is structural only; human review still required.",
        "Negative examples are present but not exhaustive.",
        "Multi-turn examples are limited in length.",
    ],
    "source_files": SOURCE_FILES,
    "duplicate_count": len(duplicate_hashes),
}

manifest_path = os.path.join(OUTPUT_DIR, "dataset_manifest.json")
with open(manifest_path, "w", encoding="utf-8") as f:
    json.dump(manifest, f, indent=2, ensure_ascii=False)

print(f"Assembled {len(train_examples)} train + {len(val_examples)} validation = {len(all_examples)} total")
print(f"Categories: {dict(category_counts)}")
print(f"Duplicates: {len(duplicate_hashes)}")
print(f"Max content length: {max_content_len}")
print("Wrote:")
print(f"  {train_path}")
print(f"  {val_path}")
print(f"  {manifest_path}")
