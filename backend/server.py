from fastapi import FastAPI, APIRouter, HTTPException, Query
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import random
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, date, timezone

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

# --- Models ---

VALID_ROLES = ["Portiere", "Difensore", "Centrocampista", "Attaccante"]

class PlayerCreate(BaseModel):
    name: str
    surname: str
    nickname: str
    date_of_birth: str  # ISO format YYYY-MM-DD
    photo: Optional[str] = None  # base64 string
    role: str
    strength: int = Field(ge=1, le=10)

class PlayerUpdate(BaseModel):
    name: Optional[str] = None
    surname: Optional[str] = None
    nickname: Optional[str] = None
    date_of_birth: Optional[str] = None
    photo: Optional[str] = None
    role: Optional[str] = None
    strength: Optional[int] = Field(default=None, ge=1, le=10)

class PlayerResponse(BaseModel):
    id: str
    name: str
    surname: str
    nickname: str
    date_of_birth: str
    age: int
    photo: Optional[str] = None
    role: str
    strength: int
    created_at: str
    updated_at: str

class TeamGenerateRequest(BaseModel):
    player_ids: List[str]
    players_per_team: int = 5

class TeamResponse(BaseModel):
    team_a: List[PlayerResponse]
    team_b: List[PlayerResponse]
    team_a_avg_strength: float
    team_b_avg_strength: float

def calculate_age(dob_str: str) -> int:
    dob = date.fromisoformat(dob_str)
    today = date.today()
    age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
    return age

def player_doc_to_response(doc: dict) -> dict:
    return {
        "id": doc["id"],
        "name": doc["name"],
        "surname": doc["surname"],
        "nickname": doc["nickname"],
        "date_of_birth": doc["date_of_birth"],
        "age": calculate_age(doc["date_of_birth"]),
        "photo": doc.get("photo"),
        "role": doc["role"],
        "strength": doc["strength"],
        "created_at": doc["created_at"],
        "updated_at": doc["updated_at"],
    }

# --- Routes ---

@api_router.get("/")
async def root():
    return {"message": "Calcetto Manager API"}

@api_router.post("/players", response_model=PlayerResponse)
async def create_player(player: PlayerCreate):
    if player.role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Ruolo non valido. Scegli tra: {VALID_ROLES}")
    
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": str(uuid.uuid4()),
        "name": player.name,
        "surname": player.surname,
        "nickname": player.nickname,
        "date_of_birth": player.date_of_birth,
        "photo": player.photo,
        "role": player.role,
        "strength": player.strength,
        "created_at": now,
        "updated_at": now,
    }
    await db.players.insert_one(doc)
    return player_doc_to_response(doc)

@api_router.get("/players", response_model=List[PlayerResponse])
async def get_players(
    search: Optional[str] = Query(None),
    role: Optional[str] = Query(None),
    min_strength: Optional[int] = Query(None, ge=1, le=10),
    max_strength: Optional[int] = Query(None, ge=1, le=10),
    sort_by: Optional[str] = Query("nickname"),
    sort_order: Optional[str] = Query("asc"),
):
    query = {}
    if search:
        query["$or"] = [
            {"nickname": {"$regex": search, "$options": "i"}},
            {"name": {"$regex": search, "$options": "i"}},
            {"surname": {"$regex": search, "$options": "i"}},
        ]
    if role and role in VALID_ROLES:
        query["role"] = role
    if min_strength is not None or max_strength is not None:
        strength_q = {}
        if min_strength is not None:
            strength_q["$gte"] = min_strength
        if max_strength is not None:
            strength_q["$lte"] = max_strength
        query["strength"] = strength_q

    sort_dir = 1 if sort_order == "asc" else -1
    valid_sorts = ["nickname", "strength", "role", "created_at"]
    sort_field = sort_by if sort_by in valid_sorts else "nickname"

    docs = await db.players.find(query, {"_id": 0}).sort(sort_field, sort_dir).to_list(1000)
    return [player_doc_to_response(d) for d in docs]

@api_router.get("/players/{player_id}", response_model=PlayerResponse)
async def get_player(player_id: str):
    doc = await db.players.find_one({"id": player_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Giocatore non trovato")
    return player_doc_to_response(doc)

@api_router.put("/players/{player_id}", response_model=PlayerResponse)
async def update_player(player_id: str, player: PlayerUpdate):
    doc = await db.players.find_one({"id": player_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Giocatore non trovato")
    
    update_data = {k: v for k, v in player.dict().items() if v is not None}
    if "role" in update_data and update_data["role"] not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Ruolo non valido. Scegli tra: {VALID_ROLES}")
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.players.update_one({"id": player_id}, {"$set": update_data})
    
    updated = await db.players.find_one({"id": player_id}, {"_id": 0})
    return player_doc_to_response(updated)

@api_router.delete("/players/{player_id}")
async def delete_player(player_id: str):
    result = await db.players.delete_one({"id": player_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Giocatore non trovato")
    return {"message": "Giocatore eliminato"}

@api_router.post("/generate-teams", response_model=TeamResponse)
async def generate_teams(req: TeamGenerateRequest):
    if len(req.player_ids) < 2:
        raise HTTPException(status_code=400, detail="Servono almeno 2 giocatori")
    
    players = []
    for pid in req.player_ids:
        doc = await db.players.find_one({"id": pid}, {"_id": 0})
        if doc:
            players.append(doc)
    
    if len(players) < 2:
        raise HTTPException(status_code=400, detail="Giocatori non trovati")
    
    # Balanced team generation: sort by strength, alternate assignment
    sorted_players = sorted(players, key=lambda p: p["strength"], reverse=True)
    
    team_a = []
    team_b = []
    sum_a = 0
    sum_b = 0
    
    for p in sorted_players:
        if sum_a <= sum_b:
            team_a.append(p)
            sum_a += p["strength"]
        else:
            team_b.append(p)
            sum_b += p["strength"]
    
    # Shuffle within teams for variety
    random.shuffle(team_a)
    random.shuffle(team_b)
    
    avg_a = sum_a / len(team_a) if team_a else 0
    avg_b = sum_b / len(team_b) if team_b else 0
    
    return {
        "team_a": [player_doc_to_response(p) for p in team_a],
        "team_b": [player_doc_to_response(p) for p in team_b],
        "team_a_avg_strength": round(avg_a, 1),
        "team_b_avg_strength": round(avg_b, 1),
    }

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
