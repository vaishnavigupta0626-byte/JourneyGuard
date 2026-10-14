# JourneyGuard

JourneyGuard is a React/Vite dashboard backed by a Flask API. Risk labels and scores are transparent heuristics based on session feature flags; they are not trained ML predictions or calibrated probabilities.

## Requirements

* Node.js 20+ (Node 22 recommended)
* Python 3.12 recommended
* The session dataset at `\~/Hackathon/ai/data/raw/session\_features.csv` (Windows: `%USERPROFILE%\\Hackathon\\ai\\data\\raw\\session\_features.csv`)

## Run the backend (PowerShell)

```powershell
cd .\\backend
py -3.12 -m venv venv
.\\venv\\Scripts\\Activate.ps1
python -m pip install --upgrade pip
pip install flask flask-cors pandas
python app.py
```

The API runs at `http://127.0.0.1:5000`. Check `http://127.0.0.1:5000/health`.

## Run the frontend (second PowerShell window)

```powershell
cd path\\to\\JourneyGuard

npm install

npm run dev

```

Open the URL printed by Vite. `npm run build` creates a production build.

## Included dashboard features

* Dataset summary and conversion metrics
* Journey stage distribution chart
* Recovery insight cards
* Risk filters, session search, and details panel
* Explainable heuristic score with reasons
* CSV export for the currently loaded and searched sessions (up to the API limit of 100 by default)

If the dataset lives somewhere else, update `SESSION\_FILE` near the top of `backend/app.py`.

