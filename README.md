cd backend
source venv/bin/activate.fish
uvicorn app.main:app --reload


cd frontend
npm run dev