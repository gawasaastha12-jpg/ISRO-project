# Aditya-L1 Solar Intelligence Platform

An advanced, real-time AI monitoring and predictive operations dashboard for the **Aditya-L1 mission**, integrating data streams from the **SOLEXS** (Solar Low Energy X-ray Spectrometer), **HEL1OS** (High Energy L1 Orbiting X-ray Spectrometer), and **VELC** (Visible Emission Line Coronagraph) payloads.

---

## 🚀 Key Platform Features

### 1. Real-Time Solar Flare Forecasting
* **Multi-Horizon Onset Probabilities:** Dynamic classification forecast models monitoring flare peak likelihoods across 7 key horizons: `5m`, `10m`, `15m`, `30m`, `60m`, `120m`, and `180m`.
* **SVG Trend Sparklines:** Embedded under each timeline card to visually map rolling probability history over the past 6 inference iterations.
* **Physics-Guided Risk Fusion:** Combines payload observations in a Bayesian fusion oracle to calculate calibrated flare risks.

### 2. Operational Metrics & Lead Time Display
* **Dynamic Lead Time:** Calculates the longest warning horizon currently exceeding the `35%` alert threshold, giving operators the maximum possible lead time.
* **Next Event Countdown:** Establishes the estimated onset time (UTC) of the next expected solar event.
* **Master Solar Catalogue:** Expanded prediction database displaying telemetry coverage metrics, active NOAA region tracking, and GOES-class cross-reference check badges.

### 3. GOES Ground-Truth Cross-Referencing
* Integrates historical NOAA GOES-class event verification tags (`X-Class`, `M-Class`, `C-Class`) into the Master Catalogue layout to cross-validate SOLEXS observation anomalies against established space weather logs.

### 4. Technical Session Report Export
* **Colorful Cosmic Theme:** Provides a two-page printable report styled with deep-space navy and neon borders matching the active operations room dashboard.
* **Grid Layout Protection:** Employs CSS Grid formatting to prevent text compression and margin squishing across different PDF render engines.
* **Methodology Deep Dive:** Dedicated second page describing the underlying machine learning pipeline architecture.

---

## 🧠 AI Pipeline Methodology & Mathematics

### 1. Physics-Informed Feature Engineering
The model extracts **74 distinct thermodynamic parameters** from raw light curves and spectral data streams to capture the physical state of the solar corona:
* **Peak Prominence:** Isolates localized micro-burst amplitudes above baseline coronal flux.
* **Spectral Chaos Entropy:** Computes pre-flare fluctuations in X-ray emission spectra.
* **Thermal Flux Gradients:** First and second-order derivatives tracking plasma heating acceleration.
* **Thermal Ratios (Fe XIV / Fe XVIII):** Approximates coronal plasma temperature variations.

### 2. Imbalance Resolution via Resampling
Solar flares are highly sparse events ($<2\%$ active states). To prevent quiet-state classification bias:
* **SMOTE (Synthetic Minority Over-sampling Technique):** Applied to oversample historic C, M, and X-class pre-flare onset windows.
* **Weighted Splits:** Utilizes specialized class weighting in XGBoost split calculations to balance sensitivity and false-alarm rates.

### 3. Isotonic Probability Calibration
Raw classifiers yield decision boundary logits rather than physical probabilities. We apply a post-processing **Isotonic Regression** function to map raw model outputs to true, calibrated empirical onset probabilities. This ensures that a predicted probability of 40% maps to a true historical recurrence likelihood of 40%.

### 4. XGBoost Feature Importance (5-Minute Nowcast Model)
The share of total model gain attributed to the top 5 operational features:
$$\text{Peak Height Ratio (11.0\%)} + \text{Signal-to-Noise Ratio (10.1\%)} + \text{Maximum Peak Flux (7.8\%)} + \text{Peak Count (7.6\%)} + \text{Coronal Energy Flux (7.1\%)} + \text{Others (56.4\%)} = 100.0\%$$

---

## 🛠️ System Architecture & Setup

### Python Backend Dependencies

| Package | Version | Purpose |
|---|---|---|
| `fastapi` | ≥ 0.100 | REST API framework |
| `uvicorn` | ≥ 0.20 | ASGI server |
| `pydantic` / `pydantic-settings` | ≥ 2.0 | Schema validation & config |
| `python-multipart` | ≥ 0.0.6 | File upload support |
| `pandas` | ≥ 1.5 | Tabular data processing |
| `numpy` | ≥ 1.20 | Numerical arrays |
| `scipy` | ≥ 1.8 | Signal processing (FFT, peaks, stats) |
| `scikit-learn` | ≥ 1.0 | Isotonic calibration, metrics |
| `xgboost` | ≥ 1.6 | Deployed 5-min forecast model |
| `lightgbm` | ≥ 3.3 | Multi-model comparison baseline |
| `joblib` | ≥ 1.1 | Model serialisation (`.pkl`) |
| `astropy` | ≥ 5.0 | FITS file ingestion (SoLEXS light-curves) |
| `matplotlib` | ≥ 3.5 | Report plots & visualisations |
| `opencv-python-headless` | ≥ 4.5 | Image processing utilities |
| `umap-learn` | ≥ 0.5 | Feature-space dimensionality reduction |
| `psutil` | ≥ 5.9 | System memory / CPU monitoring |

### Node.js Frontend Dependencies (`frontend_vf`)

| Package | Version | Purpose |
|---|---|---|
| `react` / `react-dom` | ^19 | UI framework |
| `vite` | ^7 | Dev server & bundler |
| `typescript` | 5.6 | Type safety |
| `tailwindcss` | ^4 | Utility-first CSS |
| `framer-motion` | ^12 | Page & component animations |
| `gsap` | ^3.15 | Storyboard / Three.js timeline animations |
| `three` + `@types/three` | ^0.184 | 3D cinematic storyboard scenes |
| `recharts` | ^2.15 | Dashboard time-series charts |
| `axios` | ^1.12 | Backend API HTTP client |
| `wouter` | ^3.3 | Client-side routing |
| `@radix-ui/*` | ^1–2 | Accessible UI primitives |
| `lucide-react` | ^0.453 | Icon set |
| `sonner` | ^2 | Toast notifications |
| `zod` | ^4 | Runtime schema validation |
| `react-hook-form` | ^7 | Form state management |
| `nanoid` | ^5 | Unique prediction IDs |
| `embla-carousel-react` | ^8 | Carousel component |
| `next-themes` | ^0.4 | Dark/light theme support |

### Execution & Deployment

#### Option A: 1-Click Docker Deployment (Production Ready)
```bash
docker compose up --build -d
```
- Access Dashboard: `http://localhost:3000`
- Access Backend API & Docs: `http://localhost:8000/docs`

#### Option B: Local Development Execution

1. **Install Python dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

2. **Launch Python API Server**:
   ```bash
   python -m uvicorn backend.api.main:app --reload --port 8000
   ```

3. **Launch Frontend** (from `frontend_vf/`):
   ```bash
   cd frontend_vf
   npm install
   npm run dev
   ```

The platform is accessible locally at `http://localhost:3000/`.

> 📘 **Full Cloud & Production Deployment Guide:** See [DEPLOYMENT.md](DEPLOYMENT.md) for Render, Railway, Vercel, AWS EC2, and Ubuntu VPS guides.


