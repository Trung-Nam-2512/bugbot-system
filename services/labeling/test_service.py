"""
Test script for Labeling Service
Quick test to verify service is working
"""

import requests
import json
import sys

BASE_URL = "http://localhost:8001"

def test_health():
    """Test health endpoints"""
    print("[TEST] Testing health endpoints...")
    
    # Health check
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=5)
        print(f"  [OK] Health check: {response.status_code}")
        print(f"     {response.json()}")
    except Exception as e:
        print(f"  [FAIL] Health check failed: {e}")
        return False
    
    # Liveness
    try:
        response = requests.get(f"{BASE_URL}/health/liveness", timeout=5)
        print(f"  [OK] Liveness: {response.status_code}")
    except Exception as e:
        print(f"  [FAIL] Liveness failed: {e}")
        return False
    
    # Readiness
    try:
        response = requests.get(f"{BASE_URL}/health/readiness", timeout=5)
        print(f"  [OK] Readiness: {response.status_code}")
    except Exception as e:
        print(f"  [FAIL] Readiness failed: {e}")
        return False
    
    return True

def test_projects():
    """Test projects API"""
    print("\n[TEST] Testing projects API...")
    
    # Create project
    try:
        project_data = {
            "name": f"Test Project {int(__import__('time').time())}",
            "description": "Test project for labeling",
            "annotationType": "object_detection",
            "classNames": ["insect", "bird", "animal"]
        }
        response = requests.post(f"{BASE_URL}/api/projects", json=project_data, timeout=5)
        if response.status_code == 200:
            project = response.json()
            project_id = project["project"]["_id"]
            print(f"  [OK] Create project: {response.status_code}")
            print(f"     Project ID: {project_id}")
            
            # Get project
            response = requests.get(f"{BASE_URL}/api/projects/{project_id}", timeout=5)
            if response.status_code == 200:
                print(f"  [OK] Get project: {response.status_code}")
            else:
                print(f"  [FAIL] Get project failed: {response.status_code}")
            
            # List projects
            response = requests.get(f"{BASE_URL}/api/projects", timeout=5)
            if response.status_code == 200:
                projects = response.json()
                print(f"  [OK] List projects: {response.status_code} ({projects['count']} projects)")
            else:
                print(f"  [FAIL] List projects failed: {response.status_code}")
            
            # Cleanup
            response = requests.delete(f"{BASE_URL}/api/projects/{project_id}", timeout=5)
            if response.status_code == 200:
                print(f"  [OK] Delete project: {response.status_code}")
            
            return True
        else:
            print(f"  [FAIL] Create project failed: {response.status_code}")
            print(f"     {response.text}")
            return False
    except Exception as e:
        print(f"  [FAIL] Projects API test failed: {e}")
        return False

def main():
    """Run all tests"""
    print("[START] Starting Labeling Service Tests...\n")
    
    tests = [
        ("Health Checks", test_health),
        ("Projects API", test_projects),
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
        print("\n[SUCCESS] All tests passed!")
        return 0
    else:
        print("\n[FAILED] Some tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())

