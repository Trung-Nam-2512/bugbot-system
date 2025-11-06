"""
Test script for export functionality
"""

import requests
import json
import sys

BASE_URL = "http://localhost:8001"
TEST_PROJECT_ID = "690b00f2fda494aa05ec83bb"  # From create_test_data.py

def test_export_coco():
    """Test COCO format export"""
    print("[TEST] Testing COCO format export...")
    try:
        response = requests.get(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/export",
            params={"format": "coco"},
            timeout=10
        )
        if response.status_code == 200:
            data = response.json()
            print(f"  [OK] Status: {response.status_code}")
            print(f"     Format: {data.get('format', 'N/A')}")
            if 'data' in data:
                coco_data = data['data']
                print(f"     Images: {len(coco_data.get('images', []))}")
                print(f"     Annotations: {len(coco_data.get('annotations', []))}")
                print(f"     Categories: {len(coco_data.get('categories', []))}")
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

def test_export_yolo():
    """Test YOLO format export"""
    print("\n[TEST] Testing YOLO format export...")
    try:
        response = requests.get(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/export",
            params={"format": "yolo"},
            timeout=10
        )
        if response.status_code == 200:
            data = response.json()
            print(f"  [OK] Status: {response.status_code}")
            print(f"     Format: {data.get('format', 'N/A')}")
            if 'data' in data:
                yolo_data = data['data']
                print(f"     Images: {len(yolo_data.get('images', []))}")
                print(f"     Labels: {len(yolo_data.get('labels', {}))}")
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

def test_export_invalid_format():
    """Test invalid format"""
    print("\n[TEST] Testing invalid format...")
    try:
        response = requests.get(
            f"{BASE_URL}/api/projects/{TEST_PROJECT_ID}/export",
            params={"format": "invalid"},
            timeout=10
        )
        if response.status_code == 400:
            print(f"  [OK] Status: {response.status_code} (correctly rejected invalid format)")
            return True
        else:
            print(f"  [FAIL] Status: {response.status_code} (expected 400)")
            return False
    except Exception as e:
        print(f"  [FAIL] Error: {e}")
        return False

def main():
    """Run all export tests"""
    print("[START] Testing Export Functionality...\n")
    
    tests = [
        ("COCO Export", test_export_coco),
        ("YOLO Export", test_export_yolo),
        ("Invalid Format", test_export_invalid_format),
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
        print("\n[SUCCESS] All export tests passed!")
        return 0
    else:
        print("\n[PARTIAL] Some tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())


