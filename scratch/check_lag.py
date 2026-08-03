import os
import csv
from datetime import datetime

log_path = "logs/predictions.csv"
if os.path.exists(log_path):
    with open(log_path, mode="r", encoding="utf-8") as f:
        reader = list(csv.DictReader(f))
    
    # Find all rows where hel_score > 55
    crossings = []
    for idx, row in enumerate(reader):
        try:
            hel_score = float(row.get("hel_score", 0))
            if hel_score > 55:
                crossings.append((idx, row))
        except ValueError:
            pass
            
    print(f"Total rows: {len(reader)}")
    print(f"Total crossings found: {len(crossings)}")
    if crossings:
        first_idx, first_row = crossings[0]
        first_time = first_row.get("timestamp")
        print(f"First HEL1OS crossing: index={first_idx}, time={first_time}, hel_score={first_row.get('hel_score')}")
        
        # Search for max solexs_peak within index range [first_idx - 2, first_idx + 8]
        search_start = max(0, first_idx - 2)
        search_end = min(len(reader), first_idx + 9)
        
        max_solexs = -1.0
        max_solexs_row = None
        max_solexs_idx = -1
        
        for i in range(search_start, search_end):
            try:
                sol = float(reader[i].get("solexs_peak", 0))
                if sol > max_solexs:
                    max_solexs = sol
                    max_solexs_row = reader[i]
                    max_solexs_idx = i
            except ValueError:
                pass
                
        if max_solexs_row:
            peak_time = max_solexs_row.get("timestamp")
            print(f"SOLEXS peak in window: index={max_solexs_idx}, time={peak_time}, solexs_peak={max_solexs_row.get('solexs_peak')}")
            
            # Compute time difference
            t1 = datetime.fromisoformat(first_time.replace("Z", "+00:00"))
            t2 = datetime.fromisoformat(peak_time.replace("Z", "+00:00"))
            diff = (t2 - t1).total_seconds()
            print(f"Hand-computed temporal lag: {diff} seconds")
            print(f"Index-based lag (diff * 10): {(max_solexs_idx - first_idx) * 10} seconds")
else:
    print("log path does not exist")
