from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import accounts, export, news, notebook, playbooks, stats, trades

app = FastAPI(title="Trading Journal API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.cors_origins.split(",") if origin.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(accounts.router)
app.include_router(trades.router)
app.include_router(stats.router)
app.include_router(news.router)
app.include_router(export.router)
app.include_router(notebook.router)
app.include_router(playbooks.router)


@app.get("/health")
def health():
    return {"status": "ok"}
