import os
import re
import subprocess

folder = r"C:\Users\Aastha\Downloads"

for file in os.listdir(folder):
    if file.endswith(".sh"):
        path = os.path.join(folder, file)

        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            text = f.read()

        urls = re.findall(r'https?://\S+', text)

        for url in urls:
            print("Downloading:", url)
            subprocess.run(["curl", "-O", url])