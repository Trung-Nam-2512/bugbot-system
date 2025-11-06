"""
Script to convert all MongoDB operations from async (Motor) to sync (pymongo)
This script will wrap all sync operations in run_in_executor
"""

import re
import asyncio

def convert_await_to_sync_executor(content):
    """Convert await db.operations to sync with run_in_executor"""
    
    # Pattern 1: await db.collection.find_one({...})
    pattern1 = r'(\s+)(\w+)\s*=\s*await\s+db\.(\w+)\.find_one\(([^)]+)\)'
    replacement1 = r'\1loop = asyncio.get_event_loop()\n\1\2 = await loop.run_in_executor(\n\1    None,\n\1    lambda: db.\3.find_one(\4)\n\1)'
    
    # Pattern 2: await db.collection.find({...}).to_list(length=N)
    pattern2 = r'(\s+)(\w+)\s*=\s*await\s+db\.(\w+)\.find\(([^)]+)\)\.sort\(([^)]+)\)\.(?:skip\(([^)]+)\)\.)?to_list\(length=(\d+)\)'
    replacement2 = r'\1loop = asyncio.get_event_loop()\n\1\2 = await loop.run_in_executor(\n\1    None,\n\1    lambda: list(db.\3.find(\4).sort(\5)\6.limit(\7)))\n\1)'
    
    # Pattern 3: await db.collection.insert_one({...})
    pattern3 = r'(\s+)(\w+)\s*=\s*await\s+db\.(\w+)\.insert_one\(([^)]+)\)'
    replacement3 = r'\1loop = asyncio.get_event_loop()\n\1\2 = await loop.run_in_executor(\n\1    None,\n\1    lambda: db.\3.insert_one(\4)\n\1)'
    
    # Pattern 4: await db.collection.update_one({...}, {...})
    pattern4 = r'(\s+)await\s+db\.(\w+)\.update_one\(([^)]+)\)'
    replacement4 = r'\1loop = asyncio.get_event_loop()\n\1await loop.run_in_executor(\n\1    None,\n\1    lambda: db.\2.update_one(\3)\n\1)'
    
    # Pattern 5: await db.collection.delete_one({...})
    pattern5 = r'(\s+)await\s+db\.(\w+)\.delete_one\(([^)]+)\)'
    replacement5 = r'\1loop = asyncio.get_event_loop()\n\1await loop.run_in_executor(\n\1    None,\n\1    lambda: db.\2.delete_one(\3)\n\1)'
    
    # Pattern 6: await db.collection.delete_many({...})
    pattern6 = r'(\s+)await\s+db\.(\w+)\.delete_many\(([^)]+)\)'
    replacement6 = r'\1loop = asyncio.get_event_loop()\n\1await loop.run_in_executor(\n\1    None,\n\1    lambda: db.\2.delete_many(\3)\n\1)'
    
    # Pattern 7: await db.collection.count_documents({...})
    pattern7 = r'(\s+)(\w+)\s*=\s*await\s+db\.(\w+)\.count_documents\(([^)]+)\)'
    replacement7 = r'\1loop = asyncio.get_event_loop()\n\1\2 = await loop.run_in_executor(\n\1    None,\n\1    lambda: db.\3.count_documents(\4)\n\1)'
    
    content = re.sub(pattern1, replacement1, content)
    content = re.sub(pattern2, replacement2, content)
    content = re.sub(pattern3, replacement3, content)
    content = re.sub(pattern4, replacement4, content)
    content = re.sub(pattern5, replacement5, content)
    content = re.sub(pattern6, replacement6, content)
    content = re.sub(pattern7, replacement7, content)
    
    return content

# Note: This is a helper script - manual conversion is safer
print("Use this as reference for manual conversion")


