
### 2. Frontend
```
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

### 3. Backend
```
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

Get a free Finnhub API key for `FINNHUB_API_KEY`.