import pytest
import requests
import os
from pathlib import Path
from dotenv import load_dotenv

# Backend API testing for Groups feature in Calcetto App
# Tests: Group CRUD, player-group association, cascade delete

# Load frontend .env to get EXPO_PUBLIC_BACKEND_URL
frontend_env = Path(__file__).parent.parent.parent / 'frontend' / '.env'
load_dotenv(frontend_env)

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    raise ValueError("EXPO_PUBLIC_BACKEND_URL not found in environment")


class TestGroupCRUD:
    """Group CRUD operations with persistence verification"""
    
    def test_create_group_and_verify(self):
        """Create a new group and verify it persists"""
        payload = {"name": "TEST_Martedì Sera"}
        
        # Create group
        response = requests.post(f"{BASE_URL}/api/groups", json=payload)
        assert response.status_code == 200, f"Failed to create group: {response.text}"
        
        created = response.json()
        assert created["name"] == payload["name"]
        assert "id" in created
        assert "created_at" in created
        assert created["player_count"] == 0
        
        group_id = created["id"]
        print(f"✓ Group created: {group_id}")
        
        # Verify persistence with GET
        get_response = requests.get(f"{BASE_URL}/api/groups")
        assert get_response.status_code == 200
        groups = get_response.json()
        assert any(g["id"] == group_id for g in groups)
        print(f"✓ Group persisted correctly")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/groups/{group_id}")
    
    def test_create_group_empty_name(self):
        """Create group with empty name returns 400"""
        payload = {"name": "   "}
        response = requests.post(f"{BASE_URL}/api/groups", json=payload)
        assert response.status_code == 400
        print(f"✓ Empty group name rejected")
    
    def test_get_all_groups(self):
        """Get list of all groups with player counts"""
        response = requests.get(f"{BASE_URL}/api/groups")
        assert response.status_code == 200
        
        groups = response.json()
        assert isinstance(groups, list)
        print(f"✓ Retrieved {len(groups)} groups")
        
        if len(groups) > 0:
            group = groups[0]
            assert "id" in group
            assert "name" in group
            assert "player_count" in group
            assert "created_at" in group
            assert isinstance(group["player_count"], int)
    
    def test_update_group_and_verify(self):
        """Update group name and verify changes persist"""
        # Create group
        create_response = requests.post(f"{BASE_URL}/api/groups", json={"name": "TEST_Original"})
        group_id = create_response.json()["id"]
        
        # Update group
        update_payload = {"name": "TEST_Updated Name"}
        update_response = requests.put(f"{BASE_URL}/api/groups/{group_id}", json=update_payload)
        assert update_response.status_code == 200
        
        updated = update_response.json()
        assert updated["name"] == "TEST_Updated Name"
        assert updated["id"] == group_id
        print(f"✓ Group updated")
        
        # Verify persistence
        get_response = requests.get(f"{BASE_URL}/api/groups")
        groups = get_response.json()
        updated_group = next((g for g in groups if g["id"] == group_id), None)
        assert updated_group is not None
        assert updated_group["name"] == "TEST_Updated Name"
        print(f"✓ Update persisted correctly")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/groups/{group_id}")
    
    def test_update_nonexistent_group(self):
        """Update non-existent group returns 404"""
        response = requests.put(
            f"{BASE_URL}/api/groups/nonexistent-id-12345",
            json={"name": "Test"}
        )
        assert response.status_code == 404
        print(f"✓ Update non-existent group returns 404")
    
    def test_delete_group_and_verify(self):
        """Delete group and verify it's gone"""
        # Create group
        create_response = requests.post(f"{BASE_URL}/api/groups", json={"name": "TEST_ToDelete"})
        group_id = create_response.json()["id"]
        
        # Delete group
        delete_response = requests.delete(f"{BASE_URL}/api/groups/{group_id}")
        assert delete_response.status_code == 200
        print(f"✓ Group deleted")
        
        # Verify deletion
        get_response = requests.get(f"{BASE_URL}/api/groups")
        groups = get_response.json()
        assert not any(g["id"] == group_id for g in groups)
        print(f"✓ Deletion verified - group not found")
    
    def test_delete_nonexistent_group(self):
        """Delete non-existent group returns 404"""
        response = requests.delete(f"{BASE_URL}/api/groups/nonexistent-id-12345")
        assert response.status_code == 404
        print(f"✓ Delete non-existent group returns 404")


class TestPlayerGroupAssociation:
    """Test player-group association and filtering"""
    
    @pytest.fixture(scope="class")
    def test_group(self):
        """Create a test group"""
        response = requests.post(f"{BASE_URL}/api/groups", json={"name": "TEST_PlayerGroup"})
        group_id = response.json()["id"]
        yield group_id
        # Cleanup
        requests.delete(f"{BASE_URL}/api/groups/{group_id}")
    
    def test_create_player_with_group_id(self, test_group):
        """Create player with group_id"""
        payload = {
            "name": "TEST_GroupPlayer",
            "surname": "TEST_Surname",
            "nickname": "TEST_GP",
            "date_of_birth": "1995-05-15",
            "role": "Attaccante",
            "strength": 7,
            "group_id": test_group
        }
        
        response = requests.post(f"{BASE_URL}/api/players", json=payload)
        assert response.status_code == 200, f"Failed to create player: {response.text}"
        
        created = response.json()
        assert created["name"] == payload["name"]
        player_id = created["id"]
        print(f"✓ Player created with group_id")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/players/{player_id}")
    
    def test_filter_players_by_group_id(self, test_group):
        """Filter players by group_id"""
        # Create 2 players in the test group
        player_ids = []
        for i in range(2):
            payload = {
                "name": f"TEST_Filter{i}",
                "surname": "TEST",
                "nickname": f"TEST_F{i}",
                "date_of_birth": "1995-01-01",
                "role": "Attaccante",
                "strength": 5,
                "group_id": test_group
            }
            response = requests.post(f"{BASE_URL}/api/players", json=payload)
            if response.status_code == 200:
                player_ids.append(response.json()["id"])
        
        # Filter by group_id
        response = requests.get(f"{BASE_URL}/api/players?group_id={test_group}")
        assert response.status_code == 200
        
        players = response.json()
        # Should have at least the 2 we just created
        assert len(players) >= 2
        print(f"✓ Filter by group_id returned {len(players)} players")
        
        # Cleanup
        for player_id in player_ids:
            requests.delete(f"{BASE_URL}/api/players/{player_id}")
    
    def test_group_player_count_updates(self, test_group):
        """Verify player_count updates when players are added/removed"""
        # Get initial count
        groups_response = requests.get(f"{BASE_URL}/api/groups")
        groups = groups_response.json()
        initial_group = next((g for g in groups if g["id"] == test_group), None)
        initial_count = initial_group["player_count"] if initial_group else 0
        
        # Add a player
        payload = {
            "name": "TEST_Count",
            "surname": "TEST",
            "nickname": "TEST_C",
            "date_of_birth": "1995-01-01",
            "role": "Portiere",
            "strength": 6,
            "group_id": test_group
        }
        create_response = requests.post(f"{BASE_URL}/api/players", json=payload)
        player_id = create_response.json()["id"]
        
        # Check count increased
        groups_response = requests.get(f"{BASE_URL}/api/groups")
        groups = groups_response.json()
        updated_group = next((g for g in groups if g["id"] == test_group), None)
        assert updated_group["player_count"] == initial_count + 1
        print(f"✓ Player count increased: {initial_count} -> {updated_group['player_count']}")
        
        # Delete player
        requests.delete(f"{BASE_URL}/api/players/{player_id}")
        
        # Check count decreased
        groups_response = requests.get(f"{BASE_URL}/api/groups")
        groups = groups_response.json()
        final_group = next((g for g in groups if g["id"] == test_group), None)
        assert final_group["player_count"] == initial_count
        print(f"✓ Player count decreased back to {initial_count}")


class TestCascadeDelete:
    """Test cascade delete: deleting group deletes all its players"""
    
    def test_delete_group_cascades_to_players(self):
        """Deleting a group should delete all its players"""
        # Create group
        group_response = requests.post(f"{BASE_URL}/api/groups", json={"name": "TEST_CascadeGroup"})
        group_id = group_response.json()["id"]
        
        # Create 3 players in this group
        player_ids = []
        for i in range(3):
            payload = {
                "name": f"TEST_Cascade{i}",
                "surname": "TEST",
                "nickname": f"TEST_C{i}",
                "date_of_birth": "1995-01-01",
                "role": "Difensore",
                "strength": 5,
                "group_id": group_id
            }
            response = requests.post(f"{BASE_URL}/api/players", json=payload)
            if response.status_code == 200:
                player_ids.append(response.json()["id"])
        
        assert len(player_ids) == 3
        print(f"✓ Created 3 players in group")
        
        # Verify players exist
        for player_id in player_ids:
            response = requests.get(f"{BASE_URL}/api/players/{player_id}")
            assert response.status_code == 200
        print(f"✓ All players exist before group deletion")
        
        # Delete group
        delete_response = requests.delete(f"{BASE_URL}/api/groups/{group_id}")
        assert delete_response.status_code == 200
        print(f"✓ Group deleted")
        
        # Verify all players are deleted
        for player_id in player_ids:
            response = requests.get(f"{BASE_URL}/api/players/{player_id}")
            assert response.status_code == 404
        print(f"✓ All players cascade deleted with group")


class TestGroupsWithRoleFilter:
    """Test that role filtering works within group context"""
    
    @pytest.fixture(scope="class")
    def test_group_with_players(self):
        """Create a group with players of different roles"""
        # Create group
        group_response = requests.post(f"{BASE_URL}/api/groups", json={"name": "TEST_RoleFilterGroup"})
        group_id = group_response.json()["id"]
        
        # Create players with different roles
        player_ids = []
        roles = ["Portiere", "Difensore", "Centrocampista", "Attaccante"]
        for i, role in enumerate(roles):
            payload = {
                "name": f"TEST_Role{i}",
                "surname": "TEST",
                "nickname": f"TEST_R{i}",
                "date_of_birth": "1995-01-01",
                "role": role,
                "strength": 5,
                "group_id": group_id
            }
            response = requests.post(f"{BASE_URL}/api/players", json=payload)
            if response.status_code == 200:
                player_ids.append(response.json()["id"])
        
        yield {"group_id": group_id, "player_ids": player_ids}
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/groups/{group_id}")
    
    def test_filter_by_group_and_role(self, test_group_with_players):
        """Filter players by both group_id and role"""
        group_id = test_group_with_players["group_id"]
        
        # Filter by group and Portiere role
        response = requests.get(f"{BASE_URL}/api/players?group_id={group_id}&role=Portiere")
        assert response.status_code == 200
        
        players = response.json()
        assert len(players) >= 1
        assert all(p["role"] == "Portiere" for p in players)
        print(f"✓ Filter by group + Portiere: found {len(players)} players")
        
        # Filter by group and Attaccante role
        response = requests.get(f"{BASE_URL}/api/players?group_id={group_id}&role=Attaccante")
        assert response.status_code == 200
        
        players = response.json()
        assert len(players) >= 1
        assert all(p["role"] == "Attaccante" for p in players)
        print(f"✓ Filter by group + Attaccante: found {len(players)} players")
