import urllib.request
import json
import time
import sys

# Configure output to support UTF-8 on Windows
sys.stdout.reconfigure(encoding='utf-8')

url = "http://127.0.0.1:8000/api/v1/dashboard"

print("Starting dynamic correlation telemetry query test (nested keys fixed)...")
print("=" * 60)

for i in range(8):
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            
            # Extract correlation details
            correlation = data.get("analytics", {}).get("correlation", {})
            overall = correlation.get("overall_score")
            pairs = correlation.get("pairs", [])
            
            # Extract metrics nested under instruments
            instruments = data.get("instruments", {})
            solexs = instruments.get("solexs", {})
            hel1os = instruments.get("hel1os", {})
            velc = instruments.get("velc", {})
            
            solexs_conf = solexs.get("forecast_confidence", 0.0)
            hel1os_score = hel1os.get("activity_score", 0.0)
            velc_novelty = velc.get("novelty_score", 0.0)
            
            print(f"[{time.strftime('%H:%M:%S')}] Query {i+1}:")
            print(f"  Live Metrics -> SOLEXS Conf: {solexs_conf:.4f} | HEL1OS Activity: {hel1os_score:.2f} | VELC Anomaly: {velc_novelty:.4f}")
            print(f"  Correlation  -> Overall Pearson r: {overall}")
            for p in pairs:
                print(f"    {p.get('pair')}: {p.get('value')} (Rating: {p.get('rating')})")
            print("-" * 50)
    except Exception as e:
        print(f"Error querying dashboard API: {e}")
        
    time.sleep(10)
