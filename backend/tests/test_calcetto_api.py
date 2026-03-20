import pytest
import requests
import os
from datetime import date
from pathlib import Path
from dotenv import load_dotenv

# Backend API testing for Calcetto Player Management App
# Tests: CRUD operations, search/filter, team generation

# Load frontend .env to get EXPO_PUBLIC_BACKEND_URL
frontend_env = Path(__file__).parent.parent.parent / 'frontend' / '.env'
load_dotenv(frontend_env)

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    raise ValueError("EXPO_PUBLIC_BACKEND_URL not found in environment")

class TestHealthCheck:
    """Health check endpoint"""
    
    def test_api_root(self):
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print(f"✓ API root accessible: {data}")


class TestPlayerCRUD:
    """Player CRUD operations with persistence verification"""
    
    def test_create_player_and_verify(self):
        """Create a new player and verify it persists"""
        payload = {
            "name": "TEST_Mario",
            "surname": "TEST_Rossi",
            "nickname": "TEST_SuperMario",
            "date_of_birth": "1995-05-15",
            "role": "Attaccante",
            "strength": 8
        }
        
        # Create player
        response = requests.post(f"{BASE_URL}/api/players", json=payload)
        assert response.status_code == 200, f"Failed to create player: {response.text}"
        
        created = response.json()
        assert created["name"] == payload["name"]
        assert created["nickname"] == payload["nickname"]
        assert created["role"] == payload["role"]
        assert created["strength"] == payload["strength"]
        assert "id" in created
        assert "age" in created
        assert created["age"] > 0
        
        player_id = created["id"]
        print(f"✓ Player created: {player_id}")
        
        # Verify persistence with GET
        get_response = requests.get(f"{BASE_URL}/api/players/{player_id}")
        assert get_response.status_code == 200
        fetched = get_response.json()
        assert fetched["id"] == player_id
        assert fetched["nickname"] == payload["nickname"]
        print(f"✓ Player persisted correctly")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/players/{player_id}")
    
    def test_get_all_players(self):
        """Get list of all players"""
        response = requests.get(f"{BASE_URL}/api/players")
        assert response.status_code == 200
        
        players = response.json()
        assert isinstance(players, list)
        print(f"✓ Retrieved {len(players)} players")
        
        if len(players) > 0:
            player = players[0]
            assert "id" in player
            assert "nickname" in player
            assert "role" in player
            assert "strength" in player
            assert "age" in player
    
    def test_get_single_player(self):
        """Get a single player by ID"""
        # First create a test player
        payload = {
            "name": "TEST_Luigi",
            "surname": "TEST_Verdi",
            "nickname": "TEST_Luigi",
            "date_of_birth": "1998-03-20",
            "role": "Centrocampista",
            "strength": 7
        }
        create_response = requests.post(f"{BASE_URL}/api/players", json=payload)
        player_id = create_response.json()["id"]
        
        # Get the player
        response = requests.get(f"{BASE_URL}/api/players/{player_id}")
        assert response.status_code == 200
        
        player = response.json()
        assert player["id"] == player_id
        assert player["nickname"] == payload["nickname"]
        assert player["role"] == payload["role"]
        print(f"✓ Retrieved player: {player['nickname']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/players/{player_id}")
    
    def test_get_nonexistent_player(self):
        """Get non-existent player returns 404"""
        response = requests.get(f"{BASE_URL}/api/players/nonexistent-id-12345")
        assert response.status_code == 404
        print(f"✓ Non-existent player returns 404")
    
    def test_update_player_and_verify(self):
        """Update player and verify changes persist"""
        # Create player
        payload = {
            "name": "TEST_Paolo",
            "surname": "TEST_Bianchi",
            "nickname": "TEST_Paolo",
            "date_of_birth": "1992-08-10",
            "role": "Difensore",
            "strength": 6
        }
        create_response = requests.post(f"{BASE_URL}/api/players", json=payload)
        player_id = create_response.json()["id"]
        
        # Update player
        update_payload = {
            "nickname": "TEST_PaoloBoss",
            "strength": 9
        }
        update_response = requests.put(f"{BASE_URL}/api/players/{player_id}", json=update_payload)
        assert update_response.status_code == 200
        
        updated = update_response.json()
        assert updated["nickname"] == "TEST_PaoloBoss"
        assert updated["strength"] == 9
        print(f"✓ Player updated")
        
        # Verify persistence
        get_response = requests.get(f"{BASE_URL}/api/players/{player_id}")
        fetched = get_response.json()
        assert fetched["nickname"] == "TEST_PaoloBoss"
        assert fetched["strength"] == 9
        print(f"✓ Update persisted correctly")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/players/{player_id}")
    
    def test_update_nonexistent_player(self):
        """Update non-existent player returns 404"""
        response = requests.put(
            f"{BASE_URL}/api/players/nonexistent-id-12345",
            json={"strength": 5}
        )
        assert response.status_code == 404
        print(f"✓ Update non-existent player returns 404")
    
    def test_delete_player_and_verify(self):
        """Delete player and verify it's gone"""
        # Create player
        payload = {
            "name": "TEST_Marco",
            "surname": "TEST_Neri",
            "nickname": "TEST_Marco",
            "date_of_birth": "1990-12-25",
            "role": "Portiere",
            "strength": 7
        }
        create_response = requests.post(f"{BASE_URL}/api/players", json=payload)
        player_id = create_response.json()["id"]
        
        # Delete player
        delete_response = requests.delete(f"{BASE_URL}/api/players/{player_id}")
        assert delete_response.status_code == 200
        print(f"✓ Player deleted")
        
        # Verify deletion
        get_response = requests.get(f"{BASE_URL}/api/players/{player_id}")
        assert get_response.status_code == 404
        print(f"✓ Deletion verified - player not found")
    
    def test_delete_nonexistent_player(self):
        """Delete non-existent player returns 404"""
        response = requests.delete(f"{BASE_URL}/api/players/nonexistent-id-12345")
        assert response.status_code == 404
        print(f"✓ Delete non-existent player returns 404")


class TestPlayerValidation:
    """Input validation tests"""
    
    def test_create_player_invalid_role(self):
        """Create player with invalid role returns 400"""
        payload = {
            "name": "TEST_Invalid",
            "surname": "TEST_Role",
            "nickname": "TEST_Invalid",
            "date_of_birth": "1995-01-01",
            "role": "InvalidRole",
            "strength": 5
        }
        response = requests.post(f"{BASE_URL}/api/players", json=payload)
        assert response.status_code == 400
        print(f"✓ Invalid role rejected")
    
    def test_create_player_invalid_strength(self):
        """Create player with invalid strength (out of range)"""
        payload = {
            "name": "TEST_Invalid",
            "surname": "TEST_Strength",
            "nickname": "TEST_Invalid",
            "date_of_birth": "1995-01-01",
            "role": "Attaccante",
            "strength": 15
        }
        response = requests.post(f"{BASE_URL}/api/players", json=payload)
        assert response.status_code == 422  # Pydantic validation error
        print(f"✓ Invalid strength rejected")


class TestPlayerSearch:
    """Search and filter functionality"""
    
    @pytest.fixture(scope="class")
    def test_players(self):
        """Create test players for search tests"""
        players = []
        test_data = [
            {"name": "TEST_Search1", "surname": "TEST_A", "nickname": "TEST_Bomber", "role": "Attaccante", "strength": 9},
            {"name": "TEST_Search2", "surname": "TEST_B", "nickname": "TEST_Muro", "role": "Difensore", "strength": 8},
            {"name": "TEST_Search3", "surname": "TEST_C", "nickname": "TEST_Regista", "role": "Centrocampista", "strength": 7},
            {"name": "TEST_Search4", "surname": "TEST_D", "nickname": "TEST_Gatto", "role": "Portiere", "strength": 6},
        ]
        
        for data in test_data:
            data["date_of_birth"] = "1995-01-01"
            response = requests.post(f"{BASE_URL}/api/players", json=data)
            if response.status_code == 200:
                players.append(response.json()["id"])
        
        yield players
        
        # Cleanup
        for player_id in players:
            requests.delete(f"{BASE_URL}/api/players/{player_id}")
    
    def test_search_by_nickname(self, test_players):
        """Search players by nickname"""
        response = requests.get(f"{BASE_URL}/api/players?search=Bomber")
        assert response.status_code == 200
        
        players = response.json()
        assert len(players) >= 1
        assert any("Bomber" in p["nickname"] for p in players)
        print(f"✓ Search by nickname works: found {len(players)} players")
    
    def test_filter_by_role_portiere(self, test_players):
        """Filter players by role: Portiere"""
        response = requests.get(f"{BASE_URL}/api/players?role=Portiere")
        assert response.status_code == 200
        
        players = response.json()
        assert all(p["role"] == "Portiere" for p in players)
        print(f"✓ Filter by Portiere: found {len(players)} players")
    
    def test_filter_by_role_difensore(self, test_players):
        """Filter players by role: Difensore"""
        response = requests.get(f"{BASE_URL}/api/players?role=Difensore")
        assert response.status_code == 200
        
        players = response.json()
        assert all(p["role"] == "Difensore" for p in players)
        print(f"✓ Filter by Difensore: found {len(players)} players")
    
    def test_filter_by_role_centrocampista(self, test_players):
        """Filter players by role: Centrocampista"""
        response = requests.get(f"{BASE_URL}/api/players?role=Centrocampista")
        assert response.status_code == 200
        
        players = response.json()
        assert all(p["role"] == "Centrocampista" for p in players)
        print(f"✓ Filter by Centrocampista: found {len(players)} players")
    
    def test_filter_by_role_attaccante(self, test_players):
        """Filter players by role: Attaccante"""
        response = requests.get(f"{BASE_URL}/api/players?role=Attaccante")
        assert response.status_code == 200
        
        players = response.json()
        assert all(p["role"] == "Attaccante" for p in players)
        print(f"✓ Filter by Attaccante: found {len(players)} players")
    
    def test_filter_by_strength_range(self, test_players):
        """Filter players by strength range"""
        response = requests.get(f"{BASE_URL}/api/players?min_strength=7&max_strength=9")
        assert response.status_code == 200
        
        players = response.json()
        assert all(7 <= p["strength"] <= 9 for p in players)
        print(f"✓ Filter by strength range: found {len(players)} players")


class TestTeamGeneration:
    """Team generation functionality"""
    
    @pytest.fixture(scope="class")
    def team_test_players(self):
        """Create test players for team generation"""
        players = []
        test_data = [
            {"name": "TEST_Team1", "surname": "A", "nickname": "TEST_T1", "role": "Attaccante", "strength": 9},
            {"name": "TEST_Team2", "surname": "B", "nickname": "TEST_T2", "role": "Difensore", "strength": 8},
            {"name": "TEST_Team3", "surname": "C", "nickname": "TEST_T3", "role": "Centrocampista", "strength": 7},
            {"name": "TEST_Team4", "surname": "D", "nickname": "TEST_T4", "role": "Portiere", "strength": 6},
            {"name": "TEST_Team5", "surname": "E", "nickname": "TEST_T5", "role": "Attaccante", "strength": 5},
            {"name": "TEST_Team6", "surname": "F", "nickname": "TEST_T6", "role": "Difensore", "strength": 4},
        ]
        
        for data in test_data:
            data["date_of_birth"] = "1995-01-01"
            response = requests.post(f"{BASE_URL}/api/players", json=data)
            if response.status_code == 200:
                players.append(response.json()["id"])
        
        yield players
        
        # Cleanup
        for player_id in players:
            requests.delete(f"{BASE_URL}/api/players/{player_id}")
    
    def test_generate_teams_success(self, team_test_players):
        """Generate balanced teams successfully"""
        payload = {
            "player_ids": team_test_players,
            "players_per_team": 5
        }
        
        response = requests.post(f"{BASE_URL}/api/generate-teams", json=payload)
        assert response.status_code == 200
        
        result = response.json()
        assert "team_a" in result
        assert "team_b" in result
        assert "team_a_avg_strength" in result
        assert "team_b_avg_strength" in result
        
        assert isinstance(result["team_a"], list)
        assert isinstance(result["team_b"], list)
        assert len(result["team_a"]) > 0
        assert len(result["team_b"]) > 0
        
        total_players = len(result["team_a"]) + len(result["team_b"])
        assert total_players == len(team_test_players)
        
        print(f"✓ Teams generated: Team A ({len(result['team_a'])} players, avg {result['team_a_avg_strength']}), Team B ({len(result['team_b'])} players, avg {result['team_b_avg_strength']})")
    
    def test_generate_teams_insufficient_players(self):
        """Generate teams with insufficient players returns 400"""
        payload = {
            "player_ids": ["single-player-id"],
            "players_per_team": 5
        }
        
        response = requests.post(f"{BASE_URL}/api/generate-teams", json=payload)
        assert response.status_code == 400
        print(f"✓ Insufficient players rejected")
    
    def test_generate_teams_empty_list(self):
        """Generate teams with empty player list returns 400"""
        payload = {
            "player_ids": [],
            "players_per_team": 5
        }
        
        response = requests.post(f"{BASE_URL}/api/generate-teams", json=payload)
        assert response.status_code == 400
        print(f"✓ Empty player list rejected")


class TestAgeCalculation:
    """Age calculation from date of birth"""
    
    def test_age_calculation(self):
        """Verify age is calculated correctly"""
        # Create player with known DOB
        payload = {
            "name": "TEST_Age",
            "surname": "TEST_Test",
            "nickname": "TEST_AgeTest",
            "date_of_birth": "2000-01-01",
            "role": "Attaccante",
            "strength": 5
        }
        
        response = requests.post(f"{BASE_URL}/api/players", json=payload)
        assert response.status_code == 200
        
        player = response.json()
        current_year = date.today().year
        expected_age = current_year - 2000
        
        # Age should be either expected_age or expected_age-1 depending on current date
        assert player["age"] in [expected_age, expected_age - 1]
        print(f"✓ Age calculated correctly: {player['age']} years")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/players/{player['id']}")
