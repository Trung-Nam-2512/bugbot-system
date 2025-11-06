"""
Test runner for Labeling Service
Run all tests with proper configuration
"""

import os
import sys
import subprocess
import argparse

def run_tests(test_type="all", verbose=False, coverage=False):
    """Run tests"""
    test_dir = os.path.dirname(os.path.abspath(__file__))
    
    pytest_args = [
        "-v" if verbose else "",
        "--tb=short",
        "-x"  # Stop on first failure
    ]
    
    if coverage:
        pytest_args.extend([
            "--cov=.",
            "--cov-report=html",
            "--cov-report=term"
        ])
    
    # Select tests based on type
    if test_type == "unit":
        pytest_args.append("tests/test_controllers.py")
    elif test_type == "integration":
        pytest_args.append("tests/test_labelstudio_integration.py")
        pytest_args.append("-m", "not integration")  # Skip integration tests that require Label Studio
    elif test_type == "e2e":
        pytest_args.append("tests/test_e2e_workflow.py")
        pytest_args.append("-m", "e2e")
    else:
        # Run all tests except integration that require running services
        pytest_args.append("tests/")
        pytest_args.append("-m", "not integration")
    
    # Filter empty args
    pytest_args = [arg for arg in pytest_args if arg]
    
    print(f"Running tests: {test_type}")
    print(f"Command: pytest {' '.join(pytest_args)}")
    print()
    
    result = subprocess.run(
        ["pytest"] + pytest_args,
        cwd=test_dir,
        capture_output=False
    )
    
    return result.returncode

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run Labeling Service tests")
    parser.add_argument(
        "--type",
        choices=["all", "unit", "integration", "e2e"],
        default="all",
        help="Test type to run"
    )
    parser.add_argument(
        "-v", "--verbose",
        action="store_true",
        help="Verbose output"
    )
    parser.add_argument(
        "--coverage",
        action="store_true",
        help="Run with coverage"
    )
    
    args = parser.parse_args()
    
    exit_code = run_tests(
        test_type=args.type,
        verbose=args.verbose,
        coverage=args.coverage
    )
    
    sys.exit(exit_code)

