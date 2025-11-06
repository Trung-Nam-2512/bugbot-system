#!/usr/bin/env python3
"""
Test API Endpoints
Test all FastAPI endpoints
"""

import os
import sys
import asyncio
import requests
import time
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

BASE_URL = os.getenv("SERVICE_URL", "http://localhost:8000")

def test_root():
    """Test root endpoint"""
    print("Testing GET /")
    try:
        response = requests.get(f"{BASE_URL}/")
        response.raise_for_status()
        data = response.json()
        print(f"   [OK] Status: {data.get('status')}")
        return True
    except Exception as e:
        print(f"   [ERROR] {e}")
        return False

def test_health():
    """Test health check endpoint"""
    print("\nTesting GET /health")
    try:
        response = requests.get(f"{BASE_URL}/health")
        data = response.json()
        print(f"   [OK] Status: {data.get('status')}")
        print(f"   Details: {data.get('details', {})}")
        return data.get("ok", False)
    except Exception as e:
        print(f"   [ERROR] {e}")
        return False

def test_liveness():
    """Test liveness probe"""
    print("\nTesting GET /health/liveness")
    try:
        response = requests.get(f"{BASE_URL}/health/liveness")
        response.raise_for_status()
        data = response.json()
        print(f"   [OK] Status: {data.get('status')}")
        return data.get("ok", False)
    except Exception as e:
        print(f"   [ERROR] {e}")
        return False

def test_readiness():
    """Test readiness probe"""
    print("\nTesting GET /health/readiness")
    try:
        response = requests.get(f"{BASE_URL}/health/readiness")
        data = response.json()
        print(f"   [OK] Status: {data.get('status')}")
        return data.get("ok", False)
    except Exception as e:
        print(f"   [ERROR] {e}")
        return False

def test_stats():
    """Test stats endpoint"""
    print("\nTesting GET /stats")
    try:
        response = requests.get(f"{BASE_URL}/stats")
        response.raise_for_status()
        data = response.json()
        stats = data.get("stats", {})
        print(f"   [OK] Stats:")
        print(f"      Consumed: {stats.get('consumed', 0)}")
        print(f"      Processed: {stats.get('processed', 0)}")
        print(f"      Errors: {stats.get('errors', 0)}")
        print(f"      Detections: {stats.get('detections', 0)}")
        return True
    except Exception as e:
        print(f"   [ERROR] {e}")
        return False

def test_metrics():
    """Test metrics endpoint"""
    print("\nTesting GET /metrics")
    try:
        response = requests.get(f"{BASE_URL}/metrics")
        response.raise_for_status()
        content = response.text
        print(f"   [OK] Metrics (Prometheus format):")
        print(f"      Lines: {len(content.splitlines())}")
        return True
    except Exception as e:
        print(f"   [ERROR] {e}")
        return False

def test_model_info():
    """Test model info endpoint"""
    print("\nTesting GET /model/info")
    try:
        response = requests.get(f"{BASE_URL}/model/info")
        response.raise_for_status()
        data = response.json()
        model_info = data.get("model", {})
        print(f"   [OK] Model Info:")
        print(f"      Path: {model_info.get('model_path')}")
        print(f"      Device: {model_info.get('device')}")
        print(f"      Confidence: {model_info.get('confidence_threshold')}")
        print(f"      Classes: {model_info.get('classes', 'N/A')}")
        return True
    except Exception as e:
        print(f"   [ERROR] {e}")
        return False

def test_inference_run():
    """Test manual inference endpoint"""
    print("\nTesting POST /inference/run")
    try:
        # Try to find a test image
        test_image_paths = [
            "test-image.jpg",
            "../test-image.jpg",
            "../../test-image.jpg",
            "services/ai-inference/test-image.jpg"
        ]
        
        image_path = None
        for path in test_image_paths:
            if os.path.exists(path):
                image_path = path
                break
        
        if not image_path:
            print("   [SKIP] No test image found")
            return True  # Not a failure
        
        # Test with image_path
        response = requests.post(
            f"{BASE_URL}/inference/run",
            params={"image_path": image_path}
        )
        response.raise_for_status()
        data = response.json()
        print(f"   [OK] Inference Results:")
        print(f"      Detections: {data.get('count', 0)}")
        print(f"      Processing time: {data.get('processing_time_ms', 0)}ms")
        return True
    except Exception as e:
        print(f"   [ERROR] {e}")
        return False

def main():
    """Main test function"""
    print("API Endpoints Testing")
    print("=" * 50)
    print(f"Base URL: {BASE_URL}")
    print("=" * 50)
    
    # Wait for service to be ready
    print("\nWaiting for service to be ready...")
    max_retries = 30
    for i in range(max_retries):
        try:
            response = requests.get(f"{BASE_URL}/health/liveness", timeout=2)
            if response.status_code == 200:
                print("   [OK] Service is ready")
                break
        except:
            pass
        time.sleep(1)
        if i == max_retries - 1:
            print("   [ERROR] Service not responding")
            return 1
    
    results = []
    
    # Test endpoints
    results.append(("Root", test_root()))
    results.append(("Health", test_health()))
    results.append(("Liveness", test_liveness()))
    results.append(("Readiness", test_readiness()))
    results.append(("Stats", test_stats()))
    results.append(("Metrics", test_metrics()))
    results.append(("Model Info", test_model_info()))
    results.append(("Inference Run", test_inference_run()))
    
    # Summary
    print("\n" + "=" * 50)
    print("Test Results:")
    print("=" * 50)
    for name, result in results:
        status = "[PASS]" if result else "[FAIL]"
        print(f"{name}: {status}")
    
    all_passed = all(r[1] for r in results)
    
    if all_passed:
        print("\n[SUCCESS] All API endpoint tests passed!")
        return 0
    else:
        print("\n[WARN] Some tests failed")
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)


