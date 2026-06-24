from pathlib import Path

def safe_read(path):
    return Path(path).read_text(encoding="utf-8", errors="ignore")

def safe_write(path, content):
    Path(path).write_text(content, encoding="utf-8")


# -------------------------
# FIX similarity_explorer.py
# -------------------------
file1 = "similarity_explorer.py"
content = safe_read(file1)

content = content.replace(
    '../data',
    '..'
)

content = content.replace(
    '../features/velc_features_with_scores.csv',
    '../features/novelty_detection/velc_novelty_scores.csv'
)

safe_write(file1, content)
print("Fixed similarity_explorer.py")


# -------------------------
# FIX anomaly_gallery.py
# -------------------------
file2 = "anomaly_gallery.py"
content = safe_read(file2)

content = content.replace(
    '../data',
    '..'
)

content = content.replace(
    '../features/anomaly_explanations/anomaly_explanations.csv',
    '../features/novelty_detection/velc_novelty_scores.csv'
)

safe_write(file2, content)
print("Fixed anomaly_gallery.py")