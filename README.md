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
Raw classifiers yield decision boundary logits rather than physical probabilities. We apply a post-processing **Isotonic Regression** function to map raw model confidence outputs to true, calibrated empirical onset probabilities:
$$\text{Peak Density Ratio (11.0\%)} + \text{Signal-to-Noise Ratio (10.1\%)} + \text{Maximum Peak Flux (7.8\%)} + \text{Peak Count (7.6\%)} + \text{Coronal Energy Flux (7.1\%)} + \text{Others (56.4\%)} = 100.0\%$$

---

## 🛠️ System Architecture & Setup

### Requirements
* **Backend:** Python 3.10+, FastAPI, Uvicorn, XGBoost, Scikit-learn
* **Frontend:** Node.js 18+, React, Vite, Tailwind CSS, Lucide icons

### Execution Commands

#### 1. Launch Python API Server
```bash
# Navigate to workspace root
python -m uvicorn backend.api.main:app --reload --port 8000
```

#### 2. Launch Client UI App
```bash
# Navigate to frontend folder
cd frontend
npm run dev
```
The platform is accessible locally at `http://localhost:3000/`.
