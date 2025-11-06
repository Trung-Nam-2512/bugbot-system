#!/usr/bin/env python3
"""
Error Scenarios Test
Test error handling trong các scenarios khác nhau
"""

import os
import sys
import asyncio
from pathlib import Path
from dotenv import load_dotenv
import tempfile

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from inference import InferenceService
from utils.logger import setup_logger

load_dotenv()

logger = setup_logger(__name__)

async def test_invalid_image_format():
    """Test invalid image format"""
    print("1. Testing invalid image format...")
    
    try:
        inference_service = InferenceService()
        await inference_service.initialize()
        
        # Create invalid image file
        invalid_file = tempfile.NamedTemporaryFile(delete=False, suffix=".txt")
        invalid_file.write(b"This is not an image")
        invalid_file.close()
        
        try:
            result = await inference_service.detect(invalid_file.name)
            print("   [WARN] Invalid image was processed (should fail)")
            return False
        except Exception as e:
            print(f"   [OK] Invalid image correctly rejected: {type(e).__name__}")
            return True
        finally:
            os.remove(invalid_file.name)
            await inference_service.cleanup()
            
    except Exception as e:
        print(f"   [ERROR] Test error: {e}")
        return False

async def test_missing_image():
    """Test missing image file"""
    print("\n2. Testing missing image file...")
    
    try:
        inference_service = InferenceService()
        await inference_service.initialize()
        
        try:
            result = await inference_service.detect("/nonexistent/image.jpg")
            print("   [WARN] Missing image was processed (should fail)")
            return False
        except Exception as e:
            print(f"   [OK] Missing image correctly rejected: {type(e).__name__}")
            return True
        finally:
            await inference_service.cleanup()
            
    except Exception as e:
        print(f"   [ERROR] Test error: {e}")
        return False

async def test_uninitialized_service():
    """Test using uninitialized service"""
    print("\n3. Testing uninitialized service...")
    
    try:
        inference_service = InferenceService()
        # Don't initialize
        
        try:
            result = await inference_service.detect("test.jpg")
            print("   [WARN] Uninitialized service was used (should fail)")
            return False
        except RuntimeError as e:
            if "not initialized" in str(e).lower():
                print(f"   [OK] Uninitialized service correctly rejected")
                return True
            else:
                print(f"   [WARN] Wrong error: {e}")
                return False
        except Exception as e:
            print(f"   [WARN] Unexpected error: {e}")
            return False
            
    except Exception as e:
        print(f"   [ERROR] Test error: {e}")
        return False

async def test_model_loading_error():
    """Test model loading error (invalid path)"""
    print("\n4. Testing model loading error...")
    
    try:
        inference_service = InferenceService(
            model_path="nonexistent/model.pt"
        )
        
        try:
            await inference_service.initialize()
            print("   [WARN] Invalid model path was loaded (should fail)")
            return False
        except Exception as e:
            print(f"   [OK] Invalid model path correctly rejected: {type(e).__name__}")
            return True
            
    except Exception as e:
        print(f"   [ERROR] Test error: {e}")
        return False

async def main():
    """Main test function"""
    print("Error Scenarios Testing")
    print("=" * 50)
    
    results = []
    
    # Test scenarios
    results.append(("Invalid Image Format", await test_invalid_image_format()))
    results.append(("Missing Image", await test_missing_image()))
    results.append(("Uninitialized Service", await test_uninitialized_service()))
    results.append(("Model Loading Error", await test_model_loading_error()))
    
    # Summary
    print("\n" + "=" * 50)
    print("Error Scenarios Test Results:")
    print("=" * 50)
    for name, result in results:
        status = "[PASS]" if result else "[FAIL]"
        print(f"{name}: {status}")
    
    all_passed = all(r[1] for r in results)
    
    if all_passed:
        print("\n[SUCCESS] All error scenario tests passed!")
        return 0
    else:
        print("\n[WARN] Some error scenario tests failed")
        return 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)


