from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .models import DecisionRequest, DecisionResponse, HealthResponse
from .engine import laya_engine

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Preload model on startup to eliminate cold starts
    laya_engine.load_model()
    yield

app = FastAPI(
    title="Laya Minesweeper Decision Service",
    description="Dedicated microservice serving Convai Innovations Laya System-1 decision model for Minesweeper",
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS for local and hosted web development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def verify_token(authorization: str = Header(None)):
    if settings.API_KEY:
        expected = f"Bearer {settings.API_KEY}"
        if not authorization or authorization != expected:
            raise HTTPException(status_code=401, detail="Unauthorized")
    return True

@app.get("/health", response_model=HealthResponse)
def health():
    return HealthResponse(
        status="healthy",
        model=settings.MODEL_ID,
        device=settings.DEVICE,
        ready=laya_engine.ready
    )

@app.post("/v1/decision", response_model=DecisionResponse)
def get_decision(req: DecisionRequest, authorized: bool = Depends(verify_token)):
    return laya_engine.predict(req)
