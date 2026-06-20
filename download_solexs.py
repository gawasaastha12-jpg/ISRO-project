import re
import requests
from pathlib import Path

SCRIPT_FILE = r"C:\Users\Aastha\Downloads\solexs_2026Jun16T125347327.sh"

with open(SCRIPT_FILE, "r", encoding="utf-8", errors="ignore") as f:
    text = f.read()

cookie_match = re.search(r'cookies="([^"]+)"', text)
cookies = cookie_match.group(1)

paths = re.findall(r'/al1/protected/downloadData/solexs[^\s"]+', text)

print("Found", len(paths), "files")

BASE_URL = "https://pradan1.issdc.gov.in"

outdir = Path("SOLEXS_DOWNLOADS")
outdir.mkdir(exist_ok=True)

session = requests.Session()
session.headers.update({"Cookie": cookies})

# TEST FIRST 3 FILES
for i, path in enumerate(paths[:3], start=1):

    url = BASE_URL + path

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