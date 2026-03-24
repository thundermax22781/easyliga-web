import pytest
import requests
import os
from pathlib import Path
from dotenv import load_dotenv

# Backend API testing for NEW FEATURES in Calcetto App
# Tests: 0.5 strength increments, team generation with custom names/colors/avg_age

# Load frontend .env to get EXPO_PUBLIC_BACKEND_URL
frontend_env = Path(__file__).parent.parent.parent / 'frontend' / '.env'
load_dotenv(frontend_env)

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    raise ValueError("EXPO_PUBLIC_BACKEND_URL not found in environment")


class TestStrengthIncrements:
    """Test 0.5 strength increments feature"""
    
    def test_create_player_strength_7_5(self):
        """Create player with strength 7.5 (0.5 increment)"""
        payload = {
            "name": "TEST_Decimal",
            "surname": "TEST_Strength",
            "nickname": "TEST_7.5",
            "date_of_birth": "1995-05-15",
            "role": "Attaccante",
            "strength": 7.5
        }
        
        response = requests.post(f"{BASE_URL}/api/players", json=payload)
        assert response.status_code == 200, f"Failed to create player with strength 7.5: {response.text}"
        
        created = response.json()
        assert created["strength"] == 7.5
        print(f"✓ Player created with strength 7.5")
        
        # Verify persistence
        player_id = created["id"]
        get_response = requests.get(f"{BASE_URL}/api/players/{player_id}")
        assert get_response.status_code == 200
        fetched = get_response.json()
        assert fetched["strength"] == 7.5
        print(f"✓ Strength 7.5 persisted correctly")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/players/{player_id}")
    
    def test_create_player_strength_1_5(self):
        """Create player with strength 1.5 (minimum with 0.5)"""
        payload = {
            "name": "TEST_Min",
            "surname": "TEST_Strength",
            "nickname": "TEST_1.5",
            "date_of_birth": "1995-05-15",
            "role": "Portiere",
            "strength": 1.5
        }
        
        response = requests.post(f"{BASE_URL}/api/players", json=payload)
        assert response.status_code == 200
        created = response.json()
        assert created["strength"] == 1.5
        print(f"✓ Player created with strength 1.5")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/players/{created['id']}")
    
    def test_create_player_strength_9_5(self):
        """Create player with strength 9.5 (near maximum)"""
        payload = {
            "name": "TEST_High",
            "surname": "TEST_Strength",
            "nickname": "TEST_9.5",
            "date_of_birth": "1995-05-15",
            "role": "Attaccante",
            "strength": 9.5
        }
        
        response = requests.post(f"{BASE_URL}/api/players", json=payload)
        assert response.status_code == 200
        created = response.json()
        assert created["strength"] == 9.5
        print(f"✓ Player created with strength 9.5")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/players/{created['id']}")
    
    def test_create_player_invalid_strength_increment(self):
        """Create player with invalid strength increment (e.g., 7.3) should fail"""
        payload = {
            "name": "TEST_Invalid",
            "surname": "TEST_Strength",
            "nickname": "TEST_7.3",
            "date_of_birth": "1995-05-15",
            "role": "Attaccante",
            "strength": 7.3
        }
        
        response = requests.post(f"{BASE_URL}/api/players", json=payload)
        assert response.status_code == 400, "Should reject non-0.5 increment strength"
        print(f"✓ Invalid strength increment 7.3 rejected correctly")
    
    def test_update_player_strength_to_decimal(self):
        """Update player strength to decimal value"""
        # Create player with integer strength
        payload = {
            "name": "TEST_Update",
            "surname": "TEST_Decimal",
            "nickname": "TEST_UpdateDecimal",
            "date_of_birth": "1995-05-15",
            "role": "Centrocampista",
            "strength": 6
        }
        create_response = requests.post(f"{BASE_URL}/api/players", json=payload)
        player_id = create_response.json()["id"]
        
        # Update to decimal strength
        update_payload = {"strength": 8.5}
        update_response = requests.put(f"{BASE_URL}/api/players/{player_id}", json=update_payload)
        assert update_response.status_code == 200
        
        updated = update_response.json()
        assert updated["strength"] == 8.5
        print(f"✓ Player strength updated to 8.5")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/players/{player_id}")


class TestTeamGenerationNewFields:
    """Test team generation with custom names, colors, and avg_age"""
    
    @pytest.fixture(scope="class")
    def test_players_with_ages(self):
        """Create test players with different ages for team generation"""
        players = []
        test_data = [
            {"name": "TEST_Young1", "surname": "A", "nickname": "TEST_Y1", "role": "Attaccante", "strength": 9, "date_of_birth": "2000-01-01"},
            {"name": "TEST_Young2", "surname": "B", "nickname": "TEST_Y2", "role": "Difensore", "strength": 8, "date_of_birth": "2001-06-15"},
            {"name": "TEST_Old1", "surname": "C", "nickname": "TEST_O1", "role": "Centrocampista", "strength": 7, "date_of_birth": "1985-03-20"},
            {"name": "TEST_Old2", "surname": "D", "nickname": "TEST_O2", "role": "Portiere", "strength": 6, "date_of_birth": "1987-12-10"},
            {"name": "TEST_Mid1", "surname": "E", "nickname": "TEST_M1", "role": "Attaccante", "strength": 7.5, "date_of_birth": "1995-05-05"},
            {"name": "TEST_Mid2", "surname": "F", "nickname": "TEST_M2", "role": "Difensore", "strength": 6.5, "date_of_birth": "1996-08-25"},
        ]
        
        for data in test_data:
            response = requests.post(f"{BASE_URL}/api/players", json=data)
            if response.status_code == 200:
                players.append(response.json()["id"])
        
        yield players
        
        # Cleanup
        for player_id in players:
            requests.delete(f"{BASE_URL}/api/players/{player_id}")
    
    def test_generate_teams_with_default_names_and_colors(self, test_players_with_ages):
        """Generate teams with default names and colors"""
        payload = {
            "player_ids": test_players_with_ages,
            "players_per_team": 5
        }
        
        response = requests.post(f"{BASE_URL}/api/generate-teams", json=payload)
        assert response.status_code == 200
        
        result = response.json()
        
        # Check new fields exist
        assert "team_a_name" in result
        assert "team_b_name" in result
        assert "team_a_color" in result
        assert "team_b_color" in result
        assert "team_a_avg_age" in result
        assert "team_b_avg_age" in result
        
        # Check default values
        assert result["team_a_name"] == "Squadra A"
        assert result["team_b_name"] == "Squadra B"
        assert result["team_a_color"] == "Bianca"
        assert result["team_b_color"] == "Rossa"
        
        # Check avg_age is calculated
        assert isinstance(result["team_a_avg_age"], (int, float))
        assert isinstance(result["team_b_avg_age"], (int, float))
        assert result["team_a_avg_age"] > 0
        assert result["team_b_avg_age"] > 0
        
        print(f"✓ Teams generated with default names and colors")
        print(f"  Team A: {result['team_a_name']} ({result['team_a_color']}) - Avg Age: {result['team_a_avg_age']}")
        print(f"  Team B: {result['team_b_name']} ({result['team_b_color']}) - Avg Age: {result['team_b_avg_age']}")
    
    def test_generate_teams_with_custom_names(self, test_players_with_ages):
        """Generate teams with custom team names"""
        payload = {
            "player_ids": test_players_with_ages,
            "players_per_team": 5,
            "team_a_name": "I Leoni",
            "team_b_name": "Le Tigri"
        }
        
        response = requests.post(f"{BASE_URL}/api/generate-teams", json=payload)
        assert response.status_code == 200
        
        result = response.json()
        assert result["team_a_name"] == "I Leoni"
        assert result["team_b_name"] == "Le Tigri"
        print(f"✓ Custom team names working: {result['team_a_name']} vs {result['team_b_name']}")
    
    def test_generate_teams_with_custom_colors(self, test_players_with_ages):
        """Generate teams with custom jersey colors"""
        payload = {
            "player_ids": test_players_with_ages,
            "players_per_team": 5,
            "team_a_color": "Verde",
            "team_b_color": "Nera"
        }
        
        response = requests.post(f"{BASE_URL}/api/generate-teams", json=payload)
        assert response.status_code == 200
        
        result = response.json()
        assert result["team_a_color"] == "Verde"
        assert result["team_b_color"] == "Nera"
        print(f"✓ Custom jersey colors working: {result['team_a_color']} vs {result['team_b_color']}")
    
    def test_generate_teams_all_custom_fields(self, test_players_with_ages):
        """Generate teams with all custom fields (names, colors, match type)"""
        payload = {
            "player_ids": test_players_with_ages,
            "players_per_team": 6,
            "team_a_name": "Calcio 6 Team A",
            "team_b_name": "Calcio 6 Team B",
            "team_a_color": "Gialla",
            "team_b_color": "Rossa"
        }
        
        response = requests.post(f"{BASE_URL}/api/generate-teams", json=payload)
        assert response.status_code == 200
        
        result = response.json()
        assert result["team_a_name"] == "Calcio 6 Team A"
        assert result["team_b_name"] == "Calcio 6 Team B"
        assert result["team_a_color"] == "Gialla"
        assert result["team_b_color"] == "Rossa"
        assert "team_a_avg_age" in result
        assert "team_b_avg_age" in result
        
        print(f"✓ All custom fields working")
        print(f"  {result['team_a_name']} ({result['team_a_color']}) - Avg Strength: {result['team_a_avg_strength']}, Avg Age: {result['team_a_avg_age']}")
        print(f"  {result['team_b_name']} ({result['team_b_color']}) - Avg Strength: {result['team_b_avg_strength']}, Avg Age: {result['team_b_avg_age']}")
    
    def test_generate_teams_with_decimal_strengths(self, test_players_with_ages):
        """Verify team generation works with players having decimal strengths"""
        response = requests.post(f"{BASE_URL}/api/generate-teams", json={
            "player_ids": test_players_with_ages,
            "players_per_team": 5
        })
        assert response.status_code == 200
        
        result = response.json()
        
        # Check that avg_strength is calculated correctly with decimal values
        assert isinstance(result["team_a_avg_strength"], (int, float))
        assert isinstance(result["team_b_avg_strength"], (int, float))
        
        # Verify players with decimal strengths are in teams
        all_players = result["team_a"] + result["team_b"]
        has_decimal = any(p["strength"] % 1 != 0 for p in all_players)
        assert has_decimal, "Should have at least one player with decimal strength"
        
        print(f"✓ Team generation works with decimal strengths")
        print(f"  Team A avg: {result['team_a_avg_strength']}, Team B avg: {result['team_b_avg_strength']}")


class TestJerseyColors:
    """Test all valid jersey colors"""
    
    @pytest.fixture(scope="class")
    def minimal_players(self):
        """Create minimal players for color testing"""
        players = []
        for i in range(4):
            payload = {
                "name": f"TEST_Color{i}",
                "surname": "Test",
                "nickname": f"TEST_C{i}",
                "date_of_birth": "1995-01-01",
                "role": "Attaccante",
                "strength": 5
            }
            response = requests.post(f"{BASE_URL}/api/players", json=payload)
            if response.status_code == 200:
                players.append(response.json()["id"])
        
        yield players
        
        # Cleanup
        for player_id in players:
            requests.delete(f"{BASE_URL}/api/players/{player_id}")
    
    def test_all_jersey_colors(self, minimal_players):
        """Test all 5 valid jersey colors"""
        valid_colors = ["Bianca", "Rossa", "Gialla", "Nera", "Verde"]
        
        for color in valid_colors:
            payload = {
                "player_ids": minimal_players,
                "players_per_team": 5,
                "team_a_color": color,
                "team_b_color": "Bianca"
            }
            
            response = requests.post(f"{BASE_URL}/api/generate-teams", json=payload)
            assert response.status_code == 200
            result = response.json()
            assert result["team_a_color"] == color
            print(f"✓ Jersey color '{color}' accepted")
