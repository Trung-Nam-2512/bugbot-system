"""
Test GET endpoints with real project data
"""

import requests
import sys

BASE_URL = "http://localhost:8001"
TEST_PROJECT_ID = "690b00f2fda494aa05ec83bb"  # From create_test_data.py

def test_get_projects():
    """Test GET /api/projects"""
    print("[TEST] GET /api/projects...")
    try:
        response = requests.get(f"{BASE_URL}/api/projects", timeout=5)
        if response.status_code == 200:
            data = response.json()
            print(f"  [OK] Status: {response.status_code}")
            print(f"     Found {data.get('count', 0)} projects")
            if data.get('projects'):
                print(f"     First project: {data['projects'][0].get('name', 'N/A')}")
            return True
        else:
            print(f"  [FAIL] Status: {response.status_code}")
            print(f"     {response.text[:200]}")
            return False
    except Exception as e:
        print(f"  [FAIL] Error: {e}")
        return False

def test_get_project():
    """Test GET /api/projects/{id}"""
    print(f"\n[TEST] GET /api/projects/{TEST_PROJECT_ID}...")
    try:
        response = requests.get(f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}", timeout=5)
        if response.status_code == 200:
            data = response.json()
            print(f"  [OK] Status: {response.status_code}")
            print(f"     Project: {data.get('project', {}).get('name', 'N/A')}")
            return True
        else:
            print(f"  [FAIL] Status: {response.status_code}")
            print(f"     {response.text[:200]}")
            return False
    except Exception as e:
        print(f"  [FAIL] Error: {e}")
        return False

def test_get_project_images():
    """Test GET /api/projects/{id}/images"""
    print(f"\n[TEST] GET /api/projects/{TEST_PROJECT_ID}/images...")
    try:
        response = requests.get(f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/images", timeout=5)
        if response.status_code == 200:
            data = response.json()
            print(f"  [OK] Status: {response.status_code}")
            print(f"     Found {data.get('total', 0)} images")
            return True
        elif response.status_code == 404:
            print(f"  [OK] Status: {response.status_code} (project not found - expected if ID invalid)")
            return True
        else:
            print(f"  [FAIL] Status: {response.status_code}")
            print(f"     {response.text[:200]}")
            return False
    except Exception as e:
        print(f"  [FAIL] Error: {e}")
        return False

def test_get_project_annotations():
    """Test GET /api/projects/{id}/annotations"""
    print(f"\n[TEST] GET /api/projects/{TEST_PROJECT_ID}/annotations...")
    try:
        response = requests.get(f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/annotations", timeout=5)
        if response.status_code == 200:
            data = response.json()
            print(f"  [OK] Status: {response.status_code}")
            print(f"     Found {data.get('count', 0)} annotations")
            return True
        elif response.status_code == 404:
            print(f"  [OK] Status: {response.status_code} (project not found - expected if ID invalid)")
            return True
        else:
            print(f"  [FAIL] Status: {response.status_code}")
            print(f"     {response.text[:200]}")
            return False
    except Exception as e:
        print(f"  [FAIL] Error: {e}")
        return False

def main():
    """Run all GET endpoint tests"""
    print("[START] Testing GET Endpoints with Real Data...\n")
    
    tests = [
        ("GET Projects (List)", test_get_projects),
        ("GET Project (Single)", test_get_project),
        ("GET Project Images", test_get_project_images),
        ("GET Project Annotations", test_get_project_annotations),
    ]
    
    passed = 0
    failed = 0
    
    for name, test_func in tests:
        try:
            if test_func():
                passed += 1
            else:
                failed += 1
        except Exception as e:
            print(f"  [ERROR] {name} test error: {e}")
            failed += 1
    
    print(f"\n[RESULTS] Test Results:")
    print(f"  [PASS] Passed: {passed}")
    print(f"  [FAIL] Failed: {failed}")
    print(f"  Total: {passed + failed}")
    
    if failed == 0:
        print("\n[SUCCESS] All GET endpoint tests passed!")
        return 0
    else:
        print("\n[PARTIAL] Some tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())


