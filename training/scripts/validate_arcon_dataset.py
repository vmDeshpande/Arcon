#!/usr/bin/env python3
"""Validate Arcon Training Dataset V1."""

import json
import os
import hashlib
from collections import Counter
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATASET_DIR = os.path.join(BASE_DIR, "datasets", "arcon_v1")
REPORT_DIR = os.path.join(BASE_DIR, "outputs", "test")
os.makedirs(REPORT_DIR, exist_ok=True)

REQUIRED_FIELDS = ["messages", "metadata"]
REQUIRED_METADATA = ["id", "category", "subcategory", "difficulty", "source"]
VALID_ROLES = {"user", "assistant"}


def load_jsonl(path):
    examples = []
    with open(path, "r", encoding="utf-8") as f:
        for lineno, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            try:
                examples.append((lineno, json.loads(line)))
            except json.JSONDecodeError as e:
                examples.append((lineno, {"__json_error__": str(e)}))
    return examples


def validate_file(path, name):
    errors = []
    warnings = []
    examples = []
    if not os.path.exists(path):
        errors.append(f"File missing: {path}")
        return errors, warnings, examples

    examples = load_jsonl(path)
    for lineno, ex in examples:
        if "__json_error__" in ex:
            errors.append(f"{name}:{lineno} JSON parse error: {ex['__json_error__']}")
            continue

        # Required fields
        for field in REQUIRED_FIELDS:
            if field not in ex:
                errors.append(f"{name}:{lineno} missing required field '{field}'")

        # Metadata checks
        meta = ex.get("metadata", {})
        for field in REQUIRED_METADATA:
            if field not in meta:
                errors.append(f"{name}:{lineno} metadata missing '{field}'")

        # Message roles
        for i, msg in enumerate(ex.get("messages", [])):
            role = msg.get("role")
            if role not in VALID_ROLES:
                errors.append(f"{name}:{lineno} message[{i}] invalid role '{role}'")
            content = msg.get("content", "")
            if not isinstance(content, str) or len(content.strip()) == 0:
                warnings.append(f"{name}:{lineno} message[{i}] empty content")

        # Empty messages list
        if not ex.get("messages"):
            warnings.append(f"{name}:{lineno} no messages")

    return errors, warnings, examples


def main():
    report_lines = []
    def rprint(msg=""):
        print(msg)
        report_lines.append(str(msg))

    rprint("# Arcon Dataset V1 Validation Report")
    rprint(f"Generated: {datetime.utcnow().isoformat()}Z")
    rprint()

    train_path = os.path.join(DATASET_DIR, "train.jsonl")
    val_path = os.path.join(DATASET_DIR, "validation.jsonl")

    all_errors = []
    all_warnings = []

    # Validate files
    train_errors, train_warnings, train_examples = validate_file(train_path, "train.jsonl")
    val_errors, val_warnings, val_examples = validate_file(val_path, "validation.jsonl")
    all_errors.extend(train_errors)
    all_warnings.extend(train_warnings)
    all_warnings.extend(val_warnings)

    rprint("## JSONL Syntax")
    json_errors = [e for e in all_errors if "JSON parse error" in e]
    rprint(f"Errors: {len(json_errors)}")
    if json_errors:
        for e in json_errors[:5]:
            rprint(f"  - {e}")

    rprint()
    rprint("## Schema Validation")
    schema_errors = [e for e in all_errors if "missing required" in e or "invalid role" in e or "metadata missing" in e]
    rprint(f"Errors: {len(schema_errors)}")
    if schema_errors:
        for e in schema_errors[:10]:
            rprint(f"  - {e}")

    rprint()
    rprint("## Content Validation")
    content_warnings = [w for w in all_warnings if "empty content" in w or "no messages" in w]
    rprint(f"Warnings: {len(content_warnings)}")
    if content_warnings:
        for w in content_warnings[:10]:
            rprint(f"  - {w}")

    rprint()
    rprint("## Duplicate Check")
    all_examples = train_examples + val_examples
    content_hashes = Counter()
    for _, ex in all_examples:
        if "__json_error__" in ex:
            continue
        msgs = ex.get("messages", [])
        content = " ".join(m.get("content", "") for m in msgs)
        h = hashlib.md5(content.encode("utf-8")).hexdigest()
        content_hashes[h] += 1

    duplicates = {h: c for h, c in content_hashes.items() if c > 1}
    rprint(f"Duplicate examples: {len(duplicates)}")
    if duplicates:
        for h, c in list(duplicates.items())[:5]:
            rprint(f"  - hash={h[:12]}... count={c}")

    rprint()
    rprint("## Train/Validation Leakage")
    train_contents = set()
    val_contents = set()
    for _, ex in train_examples:
        if "__json_error__" not in ex:
            content = " ".join(m.get("content", "") for m in ex.get("messages", []))
            train_contents.add(content)
    for _, ex in val_examples:
        if "__json_error__" not in ex:
            content = " ".join(m.get("content", "") for m in ex.get("messages", []))
            val_contents.add(content)

    leakage = train_contents & val_contents
    rprint(f"Exact content matches: {len(leakage)}")
    if leakage:
        for content in list(leakage)[:5]:
            rprint(f"  - {content[:80]}...")

    rprint()
    rprint("## Category Distribution")
    all_cats = Counter()
    train_cats = Counter()
    val_cats = Counter()
    for _, ex in train_examples:
        if "__json_error__" not in ex:
            cat = ex.get("metadata", {}).get("category", "unknown")
            all_cats[cat] += 1
            train_cats[cat] += 1
    for _, ex in val_examples:
        if "__json_error__" not in ex:
            cat = ex.get("metadata", {}).get("category", "unknown")
            all_cats[cat] += 1
            val_cats[cat] += 1

    rprint(f"Total: {dict(all_cats)}")
    rprint(f"Train: {dict(train_cats)}")
    rprint(f"Validation: {dict(val_cats)}")

    rprint()
    rprint("## Length Validation")
    max_len = 0
    long_examples = []
    for _, ex in all_examples:
        if "__json_error__" in ex:
            continue
        for m in ex.get("messages", []):
            l = len(m.get("content", ""))
            if l > max_len:
                max_len = l
            if l > 500:
                long_examples.append((ex.get("id", "?"), l))
    rprint(f"Max content length: {max_len}")
    if long_examples:
        rprint(f"Examples > 500 chars: {len(long_examples)}")
        for ex_id, l in long_examples[:5]:
            rprint(f"  - {ex_id}: {l} chars")

    rprint()
    rprint("## Overall Status")
    if not all_errors and not duplicates:
        rprint("PASS")
        rprint("All structural checks passed. Dataset is ready for human review.")
    else:
        rprint("FAIL")
        rprint(f"Errors: {len(all_errors)}, Duplicates: {len(duplicates)}")

    rprint()
    rprint("## Summary")
    rprint(f"Train examples: {len(train_examples)}")
    rprint(f"Validation examples: {len(val_examples)}")
    rprint(f"Total examples: {len(all_examples)}")
    rprint(f"Errors: {len(all_errors)}")
    rprint(f"Warnings: {len(all_warnings)}")
    rprint(f"Duplicates: {len(duplicates)}")
    rprint(f"Leakage: {len(leakage)}")

    report_path = os.path.join(REPORT_DIR, "arcon-dataset-v1-validation.txt")
    with open(report_path, "w", encoding="utf-8") as f:
        f.write("\n".join(report_lines))
    rprint(f"\nReport saved to {report_path}")


if __name__ == "__main__":
    main()
