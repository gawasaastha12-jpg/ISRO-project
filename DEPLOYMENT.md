# 🚀 Aditya-L1 Solar Intelligence Platform — Full Deployment Guide

This guide covers how to deploy the complete **Aditya-L1 Solar Intelligence Platform** (FastAPI ML Backend + React/Vite/Three.js Frontend + SCADA Grid Dispatch Engine).

---

## 🏗️ System Architecture Overview

| Component | Technology | Default Port | Role |
| :--- | :--- | :--- | :--- |
| **Backend** | Python 3.10+ / FastAPI / Uvicorn | `8000` | ML Models (XGBoost/LightGBM), NASA POWER API, PVLib, SoLEXS/HEL1OS/VELC FITS telemetry |
| **Frontend** | React 19 / TypeScript / Vite / Tailwind | `3000` (or `80`) | 3D Mission Dashboard, Solar Grid Map, Archive Analysis, Technical Reports |
| **Gateway / Proxy** | Nginx or Express Reverse Proxy | `80` / `3000` | Serves client SPA and routes `/api/*` to the FastAPI backend |

---

## 🎯 Choose Your Deployment Method

- [Method 1: Docker & Docker Compose (Recommended)](#method-1-docker--docker-compose-recommended)
- [Method 2: Cloud PaaS (Render / Railway)](#method-2-cloud-paas-render--railway)
- [Method 3: Split Cloud (Vercel Frontend + Render/AWS Backend)](#method-3-split-cloud-deployment)
- [Method 4: Linux VPS / AWS EC2 (Systemd + Nginx + Let's Encrypt)](#method-4-linux-vps--aws-ec2)
- [Method 5: Local Production Run (Bare Metal)](#method-5-local-production-run)

---

## Method 1: Docker & Docker Compose (Recommended)

Docker Compose provides a single-command, reproducible production environment with an Nginx reverse proxy and FastAPI container connected over an internal bridge network.

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows / macOS) or Docker Engine + Docker Compose Plugin (Linux).

### Step-by-Step Commands

1. **Clone / Navigate to project root**:
   ```bash
   cd ISRO-project
   ```

2. **Build and start the complete stack**:
   ```bash
   docker compose up --build -d
   ```

3. **Verify running containers**:
   ```bash
   docker compose ps
   ```

4. **View logs**:
   ```bash
   # Both containers
   docker compose logs -f

   # Backend only
   docker compose logs -f backend

   # Frontend only
   docker compose logs -f frontend
   ```

5. **Access the application**:
   - 🌐 **Web Dashboard:** `http://localhost:3000`
   - 📡 **Backend Health Check:** `http://localhost:8000/api/v1/health`
   - 📖 **Interactive Swagger Docs:** `http://localhost:8000/docs`

6. **To stop the containers**:
   ```bash
   docker compose down
   ```

---

## Method 2: Cloud PaaS (Render / Railway)

If you want to host the platform on cloud platforms like **Render** or **Railway**:

### Step 1: Deploy Backend (Python FastAPI)

1. Connect your GitHub repository to Render / Railway.
2. Create a new **Web Service** with the following settings:
   - **Root Directory:** `.` (repository root)
   - **Environment:** `Python 3`
   - **Build Command:**
     ```bash
     pip install --upgrade pip && pip install -r requirements.txt
     ```
   - **Start Command:**
     ```bash
     uvicorn backend.api.main:app --host 0.0.0.0 --port $PORT
     ```
   - **Health Check Path:** `/api/v1/health`
3. Note the generated backend URL (e.g. `https://isro-backend.onrender.com`).

### Step 2: Deploy Frontend (Node / Static Web Service)

1. Create another **Web Service** or **Static Site** for the frontend:
   - **Root Directory:** `frontend_vf`
   - **Build Command:**
     ```bash
     npm install && npm run build
     ```
   - **Publish Directory:** `dist/public`
   - **Environment Variables:**
     - `VITE_BACKEND_URL`: `https://isro-backend.onrender.com` (Your backend URL from Step 1)

---

## Method 3: Split Cloud Deployment

Host the frontend globally on **Vercel** / **Netlify** (CDN edges) and the backend on **Render**, **Railway**, or **Fly.io**.

### 1. Deploy Backend to Render/Railway
Follow Step 1 of Method 2 to deploy your FastAPI backend. Verify `https://your-backend.com/api/v1/health` returns `200 OK`.

### 2. Deploy Frontend to Vercel
1. Install Vercel CLI or import repository in [Vercel Dashboard](https://vercel.com):
   - **Framework Preset:** Vite
   - **Root Directory:** `frontend_vf`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist/public`
2. Add Environment Variable:
   - Name: `VITE_BACKEND_URL`
   - Value: `https://your-backend.com`
3. Deploy! All API requests from the React dashboard will automatically point to your cloud backend.

---

## Method 4: Linux VPS / AWS EC2

For an Ubuntu 22.04 / 24.04 server on AWS EC2, DigitalOcean, or Linode:

### 1. Initial Server Setup
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3-pip python3-venv git nginx certbot python3-certbot-nginx
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### 2. Clone and Setup Environment
```bash
git clone https://github.com/your-username/ISRO-project.git /var/www/isro-project
cd /var/www/isro-project

# Python virtual environment
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# Build Frontend
cd /var/www/isro-project/frontend_vf
npm install
npm run build
```

### 3. Create Systemd Service for FastAPI
Create `/etc/systemd/system/isro-backend.service`:
```ini
[Unit]
Description=Aditya-L1 Solar Intelligence Backend
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/var/www/isro-project
ExecStart=/var/www/isro-project/venv/bin/uvicorn backend.api.main:app --host 127.0.0.1 --port 8000 --workers 2
Restart=always
RestartSec=5
Environment=PYTHONUNBUFFERED=1

[Install]
WantedBy=multi-user.target
```

Enable and start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable isro-backend
sudo systemctl start isro-backend
sudo systemctl status isro-backend
```

### 4. Configure Nginx Reverse Proxy
Create `/etc/nginx/sites-available/isro-platform`:
```nginx
server {
    listen 80;
    server_name yourdomain.com; # Or your server's Public IP

    root /var/www/isro-project/frontend_vf/dist/public;
    index index.html;

    # Reverse proxy API requests to FastAPI
    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # SPA routing fallback
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Enable site and restart Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/isro-platform /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

*(Optional)* Enable Free HTTPS with Let's Encrypt:
```bash
sudo certbot --nginx -d yourdomain.com
```

---

## Method 5: Local Production Run

To run the production-built bundle on your local machine:

### Terminal 1: Backend
```bash
# In project root
python -m uvicorn backend.api.main:app --host 0.0.0.0 --port 8000
```

### Terminal 2: Frontend Production Server
```bash
cd frontend_vf
npm run build
npm start
```
The Express production server will serve the UI on `http://localhost:3000` and automatically forward `/api/*` requests to `http://127.0.0.1:8000`.

---

## 🔍 Healthcheck & Verification Checklist

Once deployed, verify that all systems are operational:

1. **System Health:**
   ```bash
   curl http://localhost:8000/api/v1/health
   # Expected response: {"cache":"ONLINE","models":"ONLINE","datasets":"ONLINE","api":"ONLINE", ...}
   ```
2. **Dashboard Data:**
   ```bash
   curl http://localhost:8000/api/v1/dashboard
   ```
3. **Terrestrial Solar Grid Telemetry:**
   ```bash
   curl http://localhost:8000/api/grid-status
   # Expected response: JSON array of 4 solar parks with GHI, DNI, and XGBoost forecasts
   ```
4. **Interactive Documentation:**
   Visit `http://localhost:8000/docs` in your browser.
