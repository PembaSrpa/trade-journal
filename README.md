cd backend
source venv/bin/activate.fish
uvicorn app.main:app --reload


cd frontend
npm run dev


cd frontend
npm run build
npx cap sync android
cd android
./gradlew assembleDebug