"""
Test script với detailed logging để tìm vấn đề
"""

import requests
import sys
import time

BASE_URL = "http://localhost:8001"

def test_with_logging():
    """Test endpoint với logging chi tiết"""
    print(f"\n{'='*60}")
    print(f"Testing: GET {BASE_URL}/api/projects")
    print(f"{'='*60}\n")
    
    try:
        print("[1] Making request...")
        response = requests.get(f"{BASE_URL}/api/projects", timeout=10)
        print(f"[2] Response status: {response.status_code}")
        print(f"[3] Response headers: {dict(response.headers)}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"[4] Response data: {data}")
            print("\n[SUCCESS] Request successful!")
            return True
        else:
            print(f"[4] Response status code: {response.status_code}")
            print(f"[5] Response text: {response.text[:500]}")
            
            # Try to parse JSON
            try:
                error_data = response.json()
                print(f"[6] Error JSON: {error_data}")
                if "detail" in error_data:
                    print(f"[7] Error detail: {error_data['detail']}")
            except Exception as e:
                print(f"[6] Could not parse JSON: {e}")
            
            print("\n[FAIL] Request failed")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"[ERROR] Request exception: {type(e).__name__}: {e}")
        return False
    except Exception as e:
        print(f"[ERROR] Unexpected exception: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    # Wait for server to be ready
    print("Waiting for server to be ready...")
    time.sleep(3)
    
    result = test_with_logging()
    sys.exit(0 if result else 1)

