import re
import requests
from pathlib import Path

SCRIPT_FILE = r"C:\Users\Aastha\Downloads\velc_2026Jun16T115041921.sh"

with open(SCRIPT_FILE, "r", encoding="utf-8", errors="ignore") as f:
    text = f.read()

# Extract cookie string
cookie_match = re.search(r'cookies="([^"]+)"', text)
cookies = cookie_match.group(1)

# Extract all download paths
paths = re.findall(r'"/al1/protected/downloadData[^"]+"', text)

BASE_URL = "https://pradan1.issdc.gov.in"

outdir = Path("VELC_DOWNLOADS")
outdir.mkdir(exist_ok=True)

session = requests.Session()
session.headers.update({"Cookie": cookies})

print(f"Found {len(paths)} files")

# TEST ONLY FIRST 10 FILES
for i, p in enumerate(paths[:10], start=1):

    url = BASE_URL + p.strip('"')

    filename = url.split("/")[-1].split("?")[0]

    print(f"[{i}] Downloading {filename}")

    r = session.get(url, stream=True)

    if r.status_code == 200:
        with open(outdir / filename, "wb") as f:
            for chunk in r.iter_content(8192):
                f.write(chunk)

        print("OK")
    else:
        print("FAILED", r.status_code)