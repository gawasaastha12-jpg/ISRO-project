"""
fix_pipeline_patch.py
─────────────────────
Run once to patch pipeline_patch_v6.py so C-class (label 2) is downsampled
to 25% alongside the existing B-class (label 1) downsampling.

    python fix_pipeline_patch.py

After running, re-run the pipeline:
    python pipeline_patch_v6.py --input ../data/processed/dataset_research_v5.csv
    python train.py
"""

import re, sys, os

TARGET = "pipeline_patch_v6.py"

if not os.path.exists(TARGET):
    print(f"[ERROR] {TARGET} not found in current directory.")
    print("        Run this script from your scripts/ folder.")
    sys.exit(1)

content = open(TARGET, encoding="utf-8").read()

# ── Patch 1: raise B_CLASS_KEEP_FRACTION from 0.15 to 0.40 ─────────────────
old_b = "B_CLASS_KEEP_FRACTION = 0.15"
new_b = "B_CLASS_KEEP_FRACTION = 0.40"
if old_b in content:
    content = content.replace(old_b, new_b)
    print(f"[PATCH 1] B_CLASS_KEEP_FRACTION  0.15 → 0.40")
elif "B_CLASS_KEEP_FRACTION = 0.40" in content:
    print(f"[PATCH 1] B_CLASS_KEEP_FRACTION already 0.40 — skipping")
else:
    print(f"[WARN] Could not find B_CLASS_KEEP_FRACTION line — skipping patch 1")

# ── Patch 2: add C-class downsampling block ──────────────────────────────────
# Find the existing elif lbl == 1 block and the else block that follows it,
# then insert a new elif lbl == 2 block between them.

old_else = """        else:
            # Labels 2, 3, 4 — never discard
            print(f"  label {lbl}: {len(group):,} → {len(group):,} (kept 100%)")
            parts.append(group)"""

new_elif_plus_else = """        elif lbl == 2:
            # Downsample C-class — after threshold fix it became 51-65% majority
            # Target: ~25% kept so final C share is ~15-20%, balanced with M/X
            C_KEEP = 0.25
            keep = group.sample(frac=C_KEEP, random_state=random_state)
            print(f"  label {lbl}: {len(group):,} → {len(keep):,} (kept {C_KEEP:.0%})")
            parts.append(keep)

        else:
            # Labels 3, 4 (M and X) — never discard, always keep 100%
            print(f"  label {lbl}: {len(group):,} → {len(group):,} (kept 100%)")
            parts.append(group)"""

if old_else in content:
    content = content.replace(old_else, new_elif_plus_else)
    print(f"[PATCH 2] C-class downsampling block inserted")
elif "elif lbl == 2:" in content:
    print(f"[PATCH 2] C-class elif already present — skipping")
else:
    print(f"[WARN] Could not find else block — patch 2 skipped")
    print(f"       Open pipeline_patch_v6.py manually and add C-class downsampling")

# ── Write back ────────────────────────────────────────────────────────────────
open(TARGET, "w", encoding="utf-8").write(content)
print(f"\n[DONE] {TARGET} patched successfully.")
print(f"\nNow run:")
print(f"  python pipeline_patch_v6.py --input ../data/processed/dataset_research_v5.csv")
print(f"  python train.py")
print()
print("Expected final distribution after patching:")
print("  label 0 quiet :  ~8-10%")
print("  label 1 B-like: ~30-35%")
print("  label 2 C-like: ~18-22%")
print("  label 3 M-like: ~25-30%")
print("  label 4 X-like:  ~8-12%")