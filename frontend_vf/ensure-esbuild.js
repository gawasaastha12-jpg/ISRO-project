import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import os from "os";

if (process.platform === "win32") {
  const rootDir = process.cwd();
  const targets = [
    path.join(rootDir, "node_modules", "@esbuild", "win32-x64", "esbuild.exe"),
    path.join(rootDir, "node_modules", "vite", "node_modules", "@esbuild", "win32-x64", "esbuild.exe"),
    path.join(rootDir, "node_modules", "vite", "node_modules", "esbuild", "esbuild.exe")
  ];

  const missing = targets.some((t) => !fs.existsSync(t));

  if (missing) {
    console.log("[ensure-esbuild] Windows native esbuild.exe missing, resolving...");
    
    // Check if any existing target already has it to copy from
    let source = targets.find((t) => fs.existsSync(t));
    
    // If not found in node_modules, search npm cache or fetch via npx
    if (!source) {
      try {
        console.log("[ensure-esbuild] Fetching matching esbuild@0.28.1 binary via npx...");
        execSync("npx -y esbuild@0.28.1 --version", { stdio: "ignore" });
        
        const cacheDir = path.join(os.homedir(), "AppData", "Local", "npm-cache", "_npx");
        if (fs.existsSync(cacheDir)) {
          function findBinary(dir) {
            try {
              const entries = fs.readdirSync(dir, { withFileTypes: true });
              for (const entry of entries) {
                const full = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                  const res = findBinary(full);
                  if (res) return res;
                } else if (entry.name === "esbuild.exe" && full.includes("win32-x64") && !full.includes("neon")) {
                  try {
                    const ver = execSync(`"${full}" --version`).toString().trim();
                    if (ver === "0.28.1") return full;
                  } catch {}
                }
              }
            } catch {}
            return null;
          }
          source = findBinary(cacheDir);
        }
      } catch (err) {
        console.warn("[ensure-esbuild] Warning during binary download:", err.message);
      }
    }

    if (source && fs.existsSync(source)) {
      for (const t of targets) {
        fs.mkdirSync(path.dirname(t), { recursive: true });
        if (!fs.existsSync(t)) {
          fs.copyFileSync(source, t);
          console.log(`[ensure-esbuild] Restored ${t}`);
        }
      }
    } else {
      console.log("[ensure-esbuild] Installing @esbuild/win32-x64@0.28.1 directly...");
      try {
        execSync("npm install --no-save @esbuild/win32-x64@0.28.1", { stdio: "inherit" });
      } catch (e) {
        console.error("[ensure-esbuild] Could not install @esbuild/win32-x64:", e.message);
      }
    }
  }
}
