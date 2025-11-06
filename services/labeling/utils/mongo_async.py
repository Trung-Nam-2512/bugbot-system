"""
Utility to run sync pymongo operations in async context
"""

import asyncio
from functools import wraps

def run_sync(func):
    """
    Decorator to run sync function in async context using thread pool
    """
    @wraps(func)
    async def wrapper(*args, **kwargs):
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, lambda: func(*args, **kwargs))
    return wrapper

def async_mongo_operation(sync_func):
    """
    Helper to run sync MongoDB operations in async context
    Usage: result = await async_mongo_operation(lambda: db.collection.find_one({...}))
    """
    loop = asyncio.get_event_loop()
    return loop.run_in_executor(None, sync_func)


