"""
Backend tests for:
- Material CRUD with simplified width/height fields and auto-calculated total_sqm
- Session lockout: login from another device terminates old session and locks account for 3 hours
- Password change functionality
- Logout clears session properly
"""
import pytest
import requests
import os
import time
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestHealthAndBasics:
    """Basic connectivity and auth flow tests"""

    def test_api_accessible(self):
        """Test that API is reachable"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        # Should return 401 without token, not 500
        assert response.status_code == 401 or response.status_code == 403
        print("API accessible - returns proper auth error for unauthenticated request")


class TestUserRegistrationAndLogin:
    """Test user registration and login flows"""
    
    def test_register_procurement_user(self):
        """Register a new PROCUREMENT user for testing"""
        unique_email = f"TEST_procurement_{uuid.uuid4().hex[:8]}@test.com"
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "testpass123",
            "company_name": "Test Company",
            "full_name": "Test Procurement User",
            "role": "PROCUREMENT"
        })
        assert response.status_code == 200, f"Registration failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data["user"]["email"] == unique_email
        assert data["user"]["role"] == "PROCUREMENT"
        print(f"Successfully registered PROCUREMENT user: {unique_email}")
        return data

    def test_register_ceo_user(self):
        """Register a new CEO user for testing"""
        unique_email = f"TEST_ceo_{uuid.uuid4().hex[:8]}@test.com"
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "testpass123",
            "company_name": "Test Company CEO",
            "full_name": "Test CEO User",
            "role": "CEO"
        })
        assert response.status_code == 200, f"Registration failed: {response.text}"
        data = response.json()
        assert data["user"]["role"] == "CEO"
        print(f"Successfully registered CEO user: {unique_email}")
        return data

    def test_login_success(self):
        """Test successful login with valid credentials"""
        # First register
        unique_email = f"TEST_login_{uuid.uuid4().hex[:8]}@test.com"
        reg_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "logintest123",
            "company_name": "Login Test Company",
            "full_name": "Login Test User",
            "role": "MANAGER"
        })
        assert reg_response.status_code == 200
        
        # Logout to clear session
        token = reg_response.json()["access_token"]
        requests.post(f"{BASE_URL}/api/auth/logout", headers={"Authorization": f"Bearer {token}"})
        
        # Now login
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": unique_email,
            "password": "logintest123"
        })
        assert login_response.status_code == 200
        data = login_response.json()
        assert "access_token" in data
        assert data["user"]["email"] == unique_email
        print(f"Login successful for: {unique_email}")

    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "nonexistent@test.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data
        print("Invalid credentials correctly rejected")


class TestSessionLockout:
    """Test single-session login with 3-hour lockout penalty"""
    
    def test_session_lockout_on_second_device_login(self):
        """Test that logging in from another device triggers lockout"""
        # Register a fresh user
        unique_email = f"TEST_lockout_{uuid.uuid4().hex[:8]}@test.com"
        reg_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "lockouttest123",
            "company_name": "Lockout Test Company",
            "full_name": "Lockout Test User",
            "role": "MANAGER"
        })
        assert reg_response.status_code == 200
        first_token = reg_response.json()["access_token"]
        print(f"User registered with active session: {unique_email}")
        
        # Verify first session works
        me_response = requests.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {first_token}"})
        assert me_response.status_code == 200, "First session should be valid"
        print("First session verified as active")
        
        # Try to login again (simulating second device)
        # This should terminate the old session and lock the account
        login2_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": unique_email,
            "password": "lockouttest123"
        })
        assert login2_response.status_code == 403, f"Expected 403 lockout, got {login2_response.status_code}"
        assert "locked" in login2_response.json().get("detail", "").lower() or "terminated" in login2_response.json().get("detail", "").lower()
        print(f"Second login correctly triggered lockout: {login2_response.json()['detail']}")
        
        # Verify original session is now invalid
        me_response2 = requests.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {first_token}"})
        assert me_response2.status_code == 401, "Original session should be invalidated"
        print("Original session correctly invalidated after lockout trigger")
        
        # Try to login again - should still be locked
        login3_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": unique_email,
            "password": "lockouttest123"
        })
        assert login3_response.status_code == 403
        assert "locked" in login3_response.json().get("detail", "").lower()
        print("Account correctly remains locked on subsequent login attempts")


class TestLogoutClearsSession:
    """Test that logout properly clears session"""
    
    def test_logout_clears_session(self):
        """Test that logout clears the session, allowing fresh login"""
        # Register
        unique_email = f"TEST_logout_{uuid.uuid4().hex[:8]}@test.com"
        reg_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "logouttest123",
            "company_name": "Logout Test Company",
            "full_name": "Logout Test User",
            "role": "MANAGER"
        })
        assert reg_response.status_code == 200
        token = reg_response.json()["access_token"]
        print(f"User registered: {unique_email}")
        
        # Logout
        logout_response = requests.post(f"{BASE_URL}/api/auth/logout", headers={"Authorization": f"Bearer {token}"})
        assert logout_response.status_code == 200
        print("Logout successful")
        
        # Try to use old token
        me_response = requests.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        # After logout, session_id is cleared, so token should be invalid
        assert me_response.status_code == 401, "Token should be invalid after logout"
        print("Old token correctly rejected after logout")
        
        # Login again should work (no lockout because we logged out properly)
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": unique_email,
            "password": "logouttest123"
        })
        assert login_response.status_code == 200, "Should be able to login after proper logout"
        print("Fresh login successful after proper logout")


class TestPasswordChange:
    """Test password change functionality"""
    
    def test_change_password_success(self):
        """Test successful password change"""
        # Register
        unique_email = f"TEST_pwchange_{uuid.uuid4().hex[:8]}@test.com"
        reg_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "oldpassword123",
            "company_name": "PW Change Test",
            "full_name": "PW Change User",
            "role": "MANAGER"
        })
        assert reg_response.status_code == 200
        token = reg_response.json()["access_token"]
        
        # Change password
        change_response = requests.post(f"{BASE_URL}/api/auth/change-password",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "current_password": "oldpassword123",
                "new_password": "newpassword456"
            }
        )
        assert change_response.status_code == 200
        assert change_response.json()["message"] == "Password changed successfully"
        print("Password change successful")
        
        # Logout
        requests.post(f"{BASE_URL}/api/auth/logout", headers={"Authorization": f"Bearer {token}"})
        
        # Login with new password
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": unique_email,
            "password": "newpassword456"
        })
        assert login_response.status_code == 200
        print("Login with new password successful")
        
        # Logout and try old password - should fail
        new_token = login_response.json()["access_token"]
        requests.post(f"{BASE_URL}/api/auth/logout", headers={"Authorization": f"Bearer {new_token}"})
        
        old_pw_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": unique_email,
            "password": "oldpassword123"
        })
        assert old_pw_response.status_code == 401
        print("Old password correctly rejected")
    
    def test_change_password_wrong_current(self):
        """Test password change with incorrect current password"""
        # Register
        unique_email = f"TEST_pwwrong_{uuid.uuid4().hex[:8]}@test.com"
        reg_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "correctpw123",
            "company_name": "PW Wrong Test",
            "full_name": "PW Wrong User",
            "role": "MANAGER"
        })
        assert reg_response.status_code == 200
        token = reg_response.json()["access_token"]
        
        # Try to change with wrong current password
        change_response = requests.post(f"{BASE_URL}/api/auth/change-password",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "current_password": "wrongpassword",
                "new_password": "newpassword456"
            }
        )
        assert change_response.status_code == 400
        assert "incorrect" in change_response.json()["detail"].lower()
        print("Wrong current password correctly rejected")
    
    def test_change_password_too_short(self):
        """Test password change with password too short"""
        unique_email = f"TEST_pwshort_{uuid.uuid4().hex[:8]}@test.com"
        reg_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "validpw123",
            "company_name": "PW Short Test",
            "full_name": "PW Short User",
            "role": "MANAGER"
        })
        assert reg_response.status_code == 200
        token = reg_response.json()["access_token"]
        
        change_response = requests.post(f"{BASE_URL}/api/auth/change-password",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "current_password": "validpw123",
                "new_password": "short"
            }
        )
        assert change_response.status_code == 400
        assert "6 characters" in change_response.json()["detail"]
        print("Short password correctly rejected")


class TestMaterialCRUD:
    """Test Material CRUD with width/height and auto-calculated total_sqm"""
    
    @pytest.fixture
    def procurement_auth(self):
        """Create a PROCUREMENT user and return auth header"""
        unique_email = f"TEST_mat_proc_{uuid.uuid4().hex[:8]}@test.com"
        reg_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "mattest123",
            "company_name": "Material Test Company",
            "full_name": "Material Test User",
            "role": "PROCUREMENT"
        })
        assert reg_response.status_code == 200
        token = reg_response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    @pytest.fixture
    def manager_auth(self):
        """Create a MANAGER user and return auth header (can view but not edit)"""
        unique_email = f"TEST_mat_mgr_{uuid.uuid4().hex[:8]}@test.com"
        reg_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "mattest123",
            "company_name": "Material Test Company MGR",
            "full_name": "Material Test Manager",
            "role": "MANAGER"
        })
        assert reg_response.status_code == 200
        token = reg_response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_create_sheet_material_with_dimensions(self, procurement_auth):
        """Test creating a SHEET material with width/height and verify total_sqm calculation"""
        material_data = {
            "name": f"TEST_Sheet_Material_{uuid.uuid4().hex[:8]}",
            "material_type": "SHEET",
            "width": 1220.0,  # mm
            "height": 2440.0,  # mm
            "thickness": 3.0,
            "sqm_price": 150.50,
            "supplier": "Test Supplier",
            "material_grade": "A",
            "waste_default_percent": 15.0
        }
        
        response = requests.post(f"{BASE_URL}/api/materials", json=material_data, headers=procurement_auth)
        assert response.status_code == 200, f"Create failed: {response.text}"
        
        data = response.json()
        assert data["name"] == material_data["name"]
        assert data["material_type"] == "SHEET"
        assert data["width"] == 1220.0
        assert data["height"] == 2440.0
        
        # Verify total_sqm calculation: (1220 * 2440) / 1,000,000 = 2.9768
        expected_sqm = (1220.0 * 2440.0) / 1_000_000
        assert data["total_sqm"] is not None
        assert abs(data["total_sqm"] - expected_sqm) < 0.01, f"Expected {expected_sqm}, got {data['total_sqm']}"
        print(f"Sheet material created with total_sqm: {data['total_sqm']}")
        
        # Verify GET returns same data
        get_response = requests.get(f"{BASE_URL}/api/materials", headers=procurement_auth)
        assert get_response.status_code == 200
        materials = [m for m in get_response.json() if m["id"] == data["id"]]
        assert len(materials) == 1
        assert materials[0]["total_sqm"] == data["total_sqm"]
        print("GET verified material persistence")
        
        return data
    
    def test_create_roll_material(self, procurement_auth):
        """Test creating a ROLL material with width/height"""
        material_data = {
            "name": f"TEST_Roll_Material_{uuid.uuid4().hex[:8]}",
            "material_type": "ROLL",
            "width": 1370.0,  # Roll width in mm
            "height": 50000.0,  # Roll length in mm
            "sqm_price": 85.00,
            "supplier": "Roll Supplier",
            "waste_default_percent": 10.0
        }
        
        response = requests.post(f"{BASE_URL}/api/materials", json=material_data, headers=procurement_auth)
        assert response.status_code == 200
        
        data = response.json()
        # total_sqm for roll: (1370 * 50000) / 1,000,000 = 68.5 sqm
        expected_sqm = (1370.0 * 50000.0) / 1_000_000
        assert abs(data["total_sqm"] - expected_sqm) < 0.01
        print(f"Roll material created with total_sqm: {data['total_sqm']}")
    
    def test_create_unit_material_no_sqm(self, procurement_auth):
        """Test creating a UNIT material (no total_sqm calculation)"""
        material_data = {
            "name": f"TEST_Unit_Material_{uuid.uuid4().hex[:8]}",
            "material_type": "UNIT",
            "unit_price": 250.00,
            "supplier": "LED Supplier",
            "waste_default_percent": 5.0
        }
        
        response = requests.post(f"{BASE_URL}/api/materials", json=material_data, headers=procurement_auth)
        assert response.status_code == 200
        
        data = response.json()
        assert data["material_type"] == "UNIT"
        assert data["total_sqm"] is None, "UNIT materials should not have total_sqm"
        assert data["unit_price"] == 250.00
        print(f"Unit material created without total_sqm")
    
    def test_update_material_recalculates_sqm(self, procurement_auth):
        """Test that updating width/height recalculates total_sqm"""
        # Create initial material
        create_data = {
            "name": f"TEST_Update_Material_{uuid.uuid4().hex[:8]}",
            "material_type": "BOARD",
            "width": 1000.0,
            "height": 1000.0,
            "sqm_price": 100.00,
            "waste_default_percent": 10.0
        }
        create_response = requests.post(f"{BASE_URL}/api/materials", json=create_data, headers=procurement_auth)
        assert create_response.status_code == 200
        material = create_response.json()
        
        initial_sqm = material["total_sqm"]
        assert abs(initial_sqm - 1.0) < 0.01  # 1000x1000mm = 1 sqm
        
        # Update dimensions
        update_data = {
            "name": material["name"],
            "material_type": "BOARD",
            "width": 2000.0,
            "height": 2000.0,
            "sqm_price": 100.00,
            "waste_default_percent": 10.0
        }
        update_response = requests.put(f"{BASE_URL}/api/materials/{material['id']}", json=update_data, headers=procurement_auth)
        assert update_response.status_code == 200
        
        updated = update_response.json()
        expected_sqm = (2000.0 * 2000.0) / 1_000_000  # 4 sqm
        assert abs(updated["total_sqm"] - expected_sqm) < 0.01
        print(f"Material updated, total_sqm recalculated from {initial_sqm} to {updated['total_sqm']}")
        
        # Verify with GET
        get_response = requests.get(f"{BASE_URL}/api/materials", headers=procurement_auth)
        updated_mat = [m for m in get_response.json() if m["id"] == material["id"]][0]
        assert abs(updated_mat["total_sqm"] - expected_sqm) < 0.01
        print("GET verified updated total_sqm")
    
    def test_delete_material(self, procurement_auth):
        """Test deleting a material"""
        # Create material
        create_data = {
            "name": f"TEST_Delete_Material_{uuid.uuid4().hex[:8]}",
            "material_type": "SHEET",
            "width": 500.0,
            "height": 500.0,
            "sqm_price": 50.00,
            "waste_default_percent": 10.0
        }
        create_response = requests.post(f"{BASE_URL}/api/materials", json=create_data, headers=procurement_auth)
        assert create_response.status_code == 200
        material_id = create_response.json()["id"]
        
        # Delete
        delete_response = requests.delete(f"{BASE_URL}/api/materials/{material_id}", headers=procurement_auth)
        assert delete_response.status_code == 200
        
        # Verify it's gone
        get_response = requests.get(f"{BASE_URL}/api/materials", headers=procurement_auth)
        materials = [m for m in get_response.json() if m["id"] == material_id]
        assert len(materials) == 0
        print("Material deleted and verified gone")
    
    def test_manager_cannot_create_material(self, manager_auth):
        """Test that MANAGER role cannot create materials"""
        material_data = {
            "name": f"TEST_Manager_Material_{uuid.uuid4().hex[:8]}",
            "material_type": "SHEET",
            "width": 1000.0,
            "height": 1000.0,
            "sqm_price": 100.00,
            "waste_default_percent": 10.0
        }
        
        response = requests.post(f"{BASE_URL}/api/materials", json=material_data, headers=manager_auth)
        assert response.status_code == 403, "MANAGER should not be able to create materials"
        print("MANAGER correctly denied material creation")
    
    def test_manager_can_view_materials(self, procurement_auth, manager_auth):
        """Test that MANAGER can view materials created by PROCUREMENT"""
        # PROCUREMENT creates a material
        material_data = {
            "name": f"TEST_View_Material_{uuid.uuid4().hex[:8]}",
            "material_type": "SHEET",
            "width": 800.0,
            "height": 600.0,
            "sqm_price": 75.00,
            "waste_default_percent": 12.0
        }
        create_response = requests.post(f"{BASE_URL}/api/materials", json=material_data, headers=procurement_auth)
        assert create_response.status_code == 200
        
        # Note: Different company_id for each user, so this tests view permission on own company
        # The manager will see materials from their own company (empty in this case)
        get_response = requests.get(f"{BASE_URL}/api/materials", headers=manager_auth)
        assert get_response.status_code == 200
        print("MANAGER can view materials endpoint")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
