import sys
import os

# Align python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
from backend.api.main import app

client = TestClient(app)

horizons = ["5min", "10min", "15min", "30min", "60min", "120min", "180min"]

print("==============================================")
print("VERIFYING ENDPOINTS...")
print("==============================================")

all_ok = True
with TestClient(app) as client:
    for h in horizons:
        try:
            response = client.get(f"/api/v1/forecast/{h}")
            if response.status_code == 200:
                data = response.json()
                status = data.get("status")
                forecast = data.get("forecast")
                confidence = data.get("confidence")
                fsi = data.get("forecast_severity_index")
                confidence_str = f"{confidence:.4f}" if confidence is not None else "None"
                fsi_str = f"{fsi:.2f}" if fsi is not None else "None"
                print(f"GET /forecast/{h:<6} -> Status: {status:<6} | Forecast: {str(forecast):<8} | Confidence: {confidence_str} | FSI: {fsi_str}")
                if status != "ONLINE":
                    all_ok = False
            else:
                print(f"GET /forecast/{h} failed with status code {response.status_code}: {response.text}")
                all_ok = False
        except Exception as e:
            print(f"GET /forecast/{h} error: {e}")
            all_ok = False

    print("----------------------------------------------")

    # Overall forecast
    try:
        response = client.get("/api/v1/forecast")
        if response.status_code == 200:
            data = response.json()
            status = data.get("status")
            forecast = data.get("forecast")
            rate = data.get("forecast_evolution_rate")
            traj = data.get("trajectory")
            print(f"GET /forecast       -> Status: {status:<6} | Forecast: {forecast:<8} | Rate: {rate:.6f} | Trajectory: {traj}")
            if status != "ONLINE":
                all_ok = False
        else:
            print(f"GET /forecast failed with status code {response.status_code}: {response.text}")
            all_ok = False
    except Exception as e:
        print(f"GET /forecast error: {e}")
        all_ok = False

    # History
    try:
        response = client.get("/api/v1/history")
        if response.status_code == 200:
            print("GET /history        -> Success")
        else:
            print(f"GET /history failed with status code {response.status_code}: {response.text}")
            all_ok = False
    except Exception as e:
        print(f"GET /history error: {e}")
        all_ok = False

    # Dashboard
    try:
        response = client.get("/api/v1/dashboard")
        if response.status_code == 200:
            print("GET /dashboard      -> Success")
        else:
            print(f"GET /dashboard failed with status code {response.status_code}: {response.text}")
            all_ok = False
    except Exception as e:
        print(f"GET /dashboard error: {e}")
        all_ok = False

print("==============================================")
if all_ok:
    print("ALL ENDPOINTS VERIFIED: ONLINE!")
else:
    print("SOME ENDPOINTS FAILED OR ARE OFFLINE!")
print("==============================================")
