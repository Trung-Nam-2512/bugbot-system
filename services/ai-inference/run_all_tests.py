#!/usr/bin/env python3
"""
Run All Tests for Phase 2 Week 4 Day 5
"""

import os
import sys
import subprocess
import time
from pathlib import Path

def run_test(test_name, script_path):
    """Run a test script"""
    print(f"\n{'='*60}")
    print(f"Running: {test_name}")
    print(f"{'='*60}")
    
    try:
        result = subprocess.run(
            [sys.executable, script_path],
            cwd=Path(__file__).parent,
            capture_output=False,
            text=True
        )
        return result.returncode == 0
    except Exception as e:
        print(f"Error running {test_name}: {e}")
        return False

def main():
    """Main test runner"""
    print("Phase 2 Week 4 Day 5: Integration Testing")
    print("=" * 60)
    
    tests = [
        ("Error Scenarios", "test_error_scenarios.py"),
        ("Performance Test", "test_performance.py"),
        ("Integration với Backend", "test_integration_backend.py"),
        ("API Endpoints", "test_api_endpoints.py"),
    ]
    
    results = []
    start_time = time.time()
    
    for test_name, script_path in tests:
        if not os.path.exists(script_path):
            print(f"\n[SKIP] {test_name}: Script not found ({script_path})")
            results.append((test_name, False, "Script not found"))
            continue
        
        success = run_test(test_name, script_path)
        results.append((test_name, success, None))
        
        if not success:
            print(f"\n[WARN] {test_name} failed")
    
    total_time = time.time() - start_time
    
    # Summary
    print("\n" + "=" * 60)
    print("Test Summary")
    print("=" * 60)
    
    passed = sum(1 for _, success, _ in results if success)
    total = len(results)
    
    for test_name, success, error in results:
        status = "[PASS]" if success else "[FAIL]"
        if error:
            print(f"{test_name}: {status} ({error})")
        else:
            print(f"{test_name}: {status}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    print(f"Time: {total_time:.2f}s")
    
    if passed == total:
        print("\n[SUCCESS] All tests passed!")
        return 0
    else:
        print(f"\n[WARN] {total - passed} test(s) failed")
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)


