import requests
import sys
from datetime import datetime
import json

class SignageEstimatingAPITester:
    def __init__(self, base_url="https://signage-estimator-1.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.user_id = None
        self.company_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_data = {
            'material_id': None,
            'ink_id': None, 
            'labour_id': None,
            'install_id': None,
            'recipe_id': None,
            'quote_id': None,
            'approval_id': None
        }

    def run_test(self, name, method, endpoint, expected_status, data=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {method} {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return True, response.json() if response.content else {}
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    print(f"   Response: {response.json()}")
                except:
                    print(f"   Response: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    # Auth Tests
    def test_register(self):
        """Test user registration"""
        timestamp = datetime.now().strftime('%H%M%S')
        test_data = {
            "email": f"test_manager_{timestamp}@example.com",
            "password": "TestPass123!",
            "company_name": f"Test Company {timestamp}",
            "full_name": "Test Manager"
        }
        
        success, response = self.run_test(
            "Register New Manager",
            "POST",
            "auth/register", 
            200,
            data=test_data
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            self.user_id = response['user']['id']
            self.company_id = response['user']['company_id']
            print(f"   📋 User ID: {self.user_id}")
            print(f"   📋 Company ID: {self.company_id}")
            return True
        return False

    def test_login(self):
        """Test user login - only if register failed"""
        success, response = self.run_test(
            "Login Check",
            "GET",
            "auth/me",
            200
        )
        return success

    # Material CRUD Tests
    def test_create_material(self):
        """Test creating a material"""
        material_data = {
            "name": "Test Vinyl Banner",
            "cost_per_sqm": 15.50,
            "roll_width": 1370,
            "waste_default_percent": 10.0
        }
        
        success, response = self.run_test(
            "Create Material",
            "POST",
            "materials",
            200,
            data=material_data
        )
        
        if success and 'id' in response:
            self.test_data['material_id'] = response['id']
            print(f"   📋 Material ID: {response['id']}")
            return True
        return False

    def test_get_materials(self):
        """Test fetching materials"""
        success, response = self.run_test(
            "Get Materials",
            "GET",
            "materials",
            200
        )
        
        if success and isinstance(response, list):
            print(f"   📋 Found {len(response)} materials")
            return True
        return False

    def test_update_material(self):
        """Test updating a material"""
        if not self.test_data['material_id']:
            print("❌ Skipping material update - no material ID")
            return False
            
        update_data = {
            "name": "Updated Test Vinyl Banner",
            "cost_per_sqm": 16.00,
            "roll_width": 1370,
            "waste_default_percent": 12.0
        }
        
        success, response = self.run_test(
            "Update Material",
            "PUT",
            f"materials/{self.test_data['material_id']}",
            200,
            data=update_data
        )
        return success

    # Ink Profile Tests
    def test_create_ink_profile(self):
        """Test creating an ink profile"""
        ink_data = {
            "name": "Standard CMYK",
            "cost_per_sqm": 2.50
        }
        
        success, response = self.run_test(
            "Create Ink Profile",
            "POST",
            "ink-profiles",
            200,
            data=ink_data
        )
        
        if success and 'id' in response:
            self.test_data['ink_id'] = response['id']
            print(f"   📋 Ink Profile ID: {response['id']}")
            return True
        return False

    def test_get_ink_profiles(self):
        """Test fetching ink profiles"""
        success, response = self.run_test(
            "Get Ink Profiles",
            "GET",
            "ink-profiles",
            200
        )
        
        if success and isinstance(response, list):
            print(f"   📋 Found {len(response)} ink profiles")
            return True
        return False

    # Labour Type Tests
    def test_create_labour_type(self):
        """Test creating a labour type"""
        labour_data = {
            "name": "Design & Setup",
            "rate_per_hour": 75.00
        }
        
        success, response = self.run_test(
            "Create Labour Type",
            "POST",
            "labour-types",
            200,
            data=labour_data
        )
        
        if success and 'id' in response:
            self.test_data['labour_id'] = response['id']
            print(f"   📋 Labour Type ID: {response['id']}")
            return True
        return False

    def test_get_labour_types(self):
        """Test fetching labour types"""
        success, response = self.run_test(
            "Get Labour Types",
            "GET",
            "labour-types",
            200
        )
        
        if success and isinstance(response, list):
            print(f"   📋 Found {len(response)} labour types")
            return True
        return False

    # Install Type Tests
    def test_create_install_type(self):
        """Test creating an install type"""
        install_data = {
            "name": "Standard Wall Mount",
            "crew": 2,
            "default_hours": 4.0,
            "rate": 120.00,
            "equipment_cost": 50.00
        }
        
        success, response = self.run_test(
            "Create Install Type",
            "POST",
            "install-types",
            200,
            data=install_data
        )
        
        if success and 'id' in response:
            self.test_data['install_id'] = response['id']
            print(f"   📋 Install Type ID: {response['id']}")
            return True
        return False

    def test_get_install_types(self):
        """Test fetching install types"""
        success, response = self.run_test(
            "Get Install Types",
            "GET",
            "install-types",
            200
        )
        
        if success and isinstance(response, list):
            print(f"   📋 Found {len(response)} install types")
            return True
        return False

    # Travel Settings Tests
    def test_get_travel_settings(self):
        """Test fetching travel settings"""
        success, response = self.run_test(
            "Get Travel Settings",
            "GET",
            "travel-settings",
            200
        )
        
        if success and 'aa_rate_per_km' in response:
            print(f"   📋 AA Rate: ${response['aa_rate_per_km']}")
            return True
        return False

    def test_update_travel_settings(self):
        """Test updating travel settings"""
        settings_data = {
            "aa_rate_per_km": 3.75,
            "default_tolls": 55.00
        }
        
        success, response = self.run_test(
            "Update Travel Settings",
            "PUT",
            "travel-settings",
            200,
            data=settings_data
        )
        return success

    # Recipe Tests
    def test_create_recipe(self):
        """Test creating a recipe"""
        if not all([self.test_data['material_id'], self.test_data['ink_id'], self.test_data['labour_id']]):
            print("❌ Skipping recipe creation - missing dependencies")
            return False
            
        recipe_data = {
            "name": "Test Banner Recipe",
            "lines": [
                {
                    "line_type": "MATERIAL",
                    "reference_id": self.test_data['material_id'],
                    "qty_driver": "SQM",
                    "multiplier": 1.0,
                    "waste_percent": 10.0,
                    "default_markup_percent": 30.0,
                    "markup_allowed": True,
                    "override_requires_approval": True
                },
                {
                    "line_type": "INK",
                    "reference_id": self.test_data['ink_id'],
                    "qty_driver": "SQM", 
                    "multiplier": 1.0,
                    "waste_percent": 0.0,
                    "default_markup_percent": 40.0,
                    "markup_allowed": True,
                    "override_requires_approval": False
                },
                {
                    "line_type": "LABOUR",
                    "reference_id": self.test_data['labour_id'],
                    "qty_driver": "HOURS",
                    "multiplier": 0.5,
                    "waste_percent": 0.0,
                    "default_markup_percent": 50.0,
                    "markup_allowed": True,
                    "override_requires_approval": False
                }
            ]
        }
        
        success, response = self.run_test(
            "Create Recipe",
            "POST",
            "recipes",
            200,
            data=recipe_data
        )
        
        if success and 'id' in response:
            self.test_data['recipe_id'] = response['id']
            print(f"   📋 Recipe ID: {response['id']}")
            print(f"   📋 Recipe Version: {response.get('version', 1)}")
            return True
        return False

    def test_get_recipes(self):
        """Test fetching recipes"""
        success, response = self.run_test(
            "Get Recipes",
            "GET",
            "recipes",
            200
        )
        
        if success and isinstance(response, list):
            print(f"   📋 Found {len(response)} recipes")
            return True
        return False

    # Quote Tests
    def test_create_quote(self):
        """Test creating a quote"""
        quote_data = {
            "client_name": "Test Client Co.",
            "description": "Test banner signage quote"
        }
        
        success, response = self.run_test(
            "Create Quote",
            "POST",
            "quotes",
            200,
            data=quote_data
        )
        
        if success and 'id' in response:
            self.test_data['quote_id'] = response['id']
            print(f"   📋 Quote ID: {response['id']}")
            return True
        return False

    def test_add_quote_line(self):
        """Test adding a line to quote"""
        if not all([self.test_data['quote_id'], self.test_data['recipe_id']]):
            print("❌ Skipping quote line - missing quote or recipe ID")
            return False
            
        line_data = {
            "recipe_id": self.test_data['recipe_id'],
            "width_mm": 2000.0,
            "height_mm": 1000.0,
            "quantity": 2,
            "markup_override": 25.0  # This should trigger approval
        }
        
        success, response = self.run_test(
            "Add Quote Line",
            "POST",
            f"quotes/{self.test_data['quote_id']}/lines",
            200,
            data=line_data
        )
        
        if success and 'lines' in response:
            print(f"   📋 Quote now has {len(response['lines'])} lines")
            print(f"   📋 Total Amount: ${response['total_amount']:.2f}")
            # Check if approval was created
            for line in response['lines']:
                if line.get('approval_required'):
                    print(f"   ⚠️  Line requires approval (status: {line.get('approval_status')})")
            return True
        return False

    def test_get_quotes(self):
        """Test fetching quotes"""
        success, response = self.run_test(
            "Get Quotes",
            "GET",
            "quotes",
            200
        )
        
        if success and isinstance(response, list):
            print(f"   📋 Found {len(response)} quotes")
            return True
        return False

    def test_get_quote_detail(self):
        """Test fetching quote details"""
        if not self.test_data['quote_id']:
            print("❌ Skipping quote detail - no quote ID")
            return False
            
        success, response = self.run_test(
            "Get Quote Detail",
            "GET",
            f"quotes/{self.test_data['quote_id']}",
            200
        )
        
        if success and 'id' in response:
            print(f"   📋 Quote Lines: {len(response.get('lines', []))}")
            print(f"   📋 Status: {response.get('status')}")
            return True
        return False

    # Approval Tests
    def test_get_approvals(self):
        """Test fetching approval requests"""
        success, response = self.run_test(
            "Get Approvals",
            "GET",
            "approvals",
            200
        )
        
        if success and isinstance(response, list):
            print(f"   📋 Found {len(response)} pending approvals")
            if response:
                self.test_data['approval_id'] = response[0]['id']
                print(f"   📋 First Approval ID: {response[0]['id']}")
            return True
        return False

    def test_approve_request(self):
        """Test approving a markup request"""
        if not self.test_data['approval_id']:
            print("❌ Skipping approval - no approval ID")
            return False
            
        success, response = self.run_test(
            "Approve Markup Request",
            "POST",
            f"approvals/{self.test_data['approval_id']}/approve",
            200
        )
        return success

    # Export Tests
    def test_export_pdf(self):
        """Test PDF export"""
        if not self.test_data['quote_id']:
            print("❌ Skipping PDF export - no quote ID")
            return False
            
        url = f"{self.base_url}/api/quotes/{self.test_data['quote_id']}/export/pdf"
        headers = {}
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'
            
        self.tests_run += 1
        print(f"\n🔍 Testing Export PDF...")
        
        try:
            response = requests.get(url, headers=headers)
            success = response.status_code == 200 and response.headers.get('content-type') == 'application/pdf'
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - PDF exported ({len(response.content)} bytes)")
                return True
            else:
                print(f"❌ Failed - Status: {response.status_code}, Content-Type: {response.headers.get('content-type')}")
                return False
        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False

    def test_export_bom(self):
        """Test BOM Excel export"""
        if not self.test_data['quote_id']:
            print("❌ Skipping BOM export - no quote ID")
            return False
            
        url = f"{self.base_url}/api/quotes/{self.test_data['quote_id']}/export/bom"
        headers = {}
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'
            
        self.tests_run += 1
        print(f"\n🔍 Testing Export BOM...")
        
        try:
            response = requests.get(url, headers=headers)
            expected_content_type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            success = response.status_code == 200 and response.headers.get('content-type') == expected_content_type
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Excel exported ({len(response.content)} bytes)")
                return True
            else:
                print(f"❌ Failed - Status: {response.status_code}, Content-Type: {response.headers.get('content-type')}")
                return False
        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False

    # Cleanup Tests
    def test_delete_material(self):
        """Test deleting material"""
        if not self.test_data['material_id']:
            return True  # Skip if no material to delete
            
        success, response = self.run_test(
            "Delete Material",
            "DELETE",
            f"materials/{self.test_data['material_id']}",
            200
        )
        return success

def main():
    print("🚀 Starting Signage Estimating API Tests")
    print("=" * 60)
    
    tester = SignageEstimatingAPITester()
    failed_tests = []
    
    # Authentication Flow
    print("\n📋 AUTHENTICATION TESTS")
    if not tester.test_register():
        failed_tests.append("Registration")
        print("❌ Registration failed - cannot continue with other tests")
        return 1
        
    if not tester.test_login():
        failed_tests.append("Login Check")

    # Manager CRUD Operations
    print("\n📋 MATERIAL MANAGEMENT TESTS")
    if not tester.test_create_material():
        failed_tests.append("Create Material")
    if not tester.test_get_materials():
        failed_tests.append("Get Materials")
    if not tester.test_update_material():
        failed_tests.append("Update Material")

    print("\n📋 INK PROFILE TESTS")
    if not tester.test_create_ink_profile():
        failed_tests.append("Create Ink Profile")
    if not tester.test_get_ink_profiles():
        failed_tests.append("Get Ink Profiles")

    print("\n📋 LABOUR TYPE TESTS")
    if not tester.test_create_labour_type():
        failed_tests.append("Create Labour Type")
    if not tester.test_get_labour_types():
        failed_tests.append("Get Labour Types")

    print("\n📋 INSTALL TYPE TESTS")  
    if not tester.test_create_install_type():
        failed_tests.append("Create Install Type")
    if not tester.test_get_install_types():
        failed_tests.append("Get Install Types")

    print("\n📋 TRAVEL SETTINGS TESTS")
    if not tester.test_get_travel_settings():
        failed_tests.append("Get Travel Settings")
    if not tester.test_update_travel_settings():
        failed_tests.append("Update Travel Settings")

    print("\n📋 RECIPE TESTS")
    if not tester.test_create_recipe():
        failed_tests.append("Create Recipe")
    if not tester.test_get_recipes():
        failed_tests.append("Get Recipes")

    print("\n📋 QUOTE MANAGEMENT TESTS")
    if not tester.test_create_quote():
        failed_tests.append("Create Quote")
    if not tester.test_add_quote_line():
        failed_tests.append("Add Quote Line")
    if not tester.test_get_quotes():
        failed_tests.append("Get Quotes") 
    if not tester.test_get_quote_detail():
        failed_tests.append("Get Quote Detail")

    print("\n📋 APPROVAL WORKFLOW TESTS")
    if not tester.test_get_approvals():
        failed_tests.append("Get Approvals")
    if not tester.test_approve_request():
        failed_tests.append("Approve Request")

    print("\n📋 EXPORT FUNCTIONALITY TESTS")
    if not tester.test_export_pdf():
        failed_tests.append("Export PDF")
    if not tester.test_export_bom():
        failed_tests.append("Export BOM")

    print("\n📋 CLEANUP TESTS")
    # Note: Not adding cleanup failures to failed_tests as they're not critical

    # Print Results
    print("\n" + "=" * 60)
    print(f"📊 TEST RESULTS")
    print(f"Tests Run: {tester.tests_run}")
    print(f"Tests Passed: {tester.tests_passed}")
    print(f"Tests Failed: {tester.tests_run - tester.tests_passed}")
    print(f"Success Rate: {(tester.tests_passed / tester.tests_run * 100):.1f}%")
    
    if failed_tests:
        print(f"\n❌ FAILED TESTS:")
        for test in failed_tests:
            print(f"   - {test}")
    else:
        print(f"\n✅ ALL CORE TESTS PASSED!")
    
    return 0 if len(failed_tests) == 0 else 1

if __name__ == "__main__":
    sys.exit(main())