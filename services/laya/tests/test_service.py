from fastapi.testclient import TestClient
from app.main import app
from app.engine import laya_engine

# Preload model for tests
laya_engine.load_model()
client = TestClient(app)


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "convaiinnovations/laya" in data["model"]
    assert data["ready"] is True

def test_decision_easy_board():
    board = [
        [
            {"row": 0, "col": 0, "isRevealed": True, "isFlagged": False, "adjacentMines": 1},
            {"row": 0, "col": 1, "isRevealed": False, "isFlagged": False, "adjacentMines": None},
        ],
        [
            {"row": 1, "col": 0, "isRevealed": True, "isFlagged": False, "adjacentMines": 1},
            {"row": 1, "col": 1, "isRevealed": False, "isFlagged": False, "adjacentMines": None},
        ]
    ]
    req = {
        "engine": "laya",
        "difficulty": "easy",
        "state": board,
        "excludeCells": []
    }
    response = client.post("/v1/decision", json=req)
    assert response.status_code == 200
    data = response.json()
    assert data["engine"] == "laya"
    assert data["status"] == "success"
    assert data["move"]["valid"] is True
    assert data["move"]["choice"] in ["0-1", "1-1"]
    assert data["latencyMs"] > 0
    assert data["decisionMode"] == "direct"

def test_decision_exclude_cells():
    board = [
        [
            {"row": 0, "col": 0, "isRevealed": True, "isFlagged": False, "adjacentMines": 1},
            {"row": 0, "col": 1, "isRevealed": False, "isFlagged": False, "adjacentMines": None},
        ],
        [
            {"row": 1, "col": 0, "isRevealed": True, "isFlagged": False, "adjacentMines": 1},
            {"row": 1, "col": 1, "isRevealed": False, "isFlagged": False, "adjacentMines": None},
        ]
    ]
    # Exclude 0-1, only 1-1 is available
    req = {
        "engine": "laya",
        "difficulty": "easy",
        "state": board,
        "excludeCells": ["0-1"]
    }
    response = client.post("/v1/decision", json=req)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["move"]["choice"] == "1-1"

def test_decision_no_candidates():
    board = [
        [
            {"row": 0, "col": 0, "isRevealed": True, "isFlagged": False, "adjacentMines": 0},
            {"row": 0, "col": 1, "isRevealed": True, "isFlagged": False, "adjacentMines": 0},
        ]
    ]
    req = {
        "engine": "laya",
        "difficulty": "easy",
        "state": board,
        "excludeCells": []
    }
    response = client.post("/v1/decision", json=req)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "no_candidates"
    assert data["move"]["choice"] is None
