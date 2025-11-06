"""
MongoDB client for Labeling Service - SYNC VERSION
Using sync pymongo instead of Motor to avoid truth value testing issues
"""

from pymongo import MongoClient
from utils.logger import setup_logger
import os

logger = setup_logger(__name__)

# Global client instance
client: MongoClient = None
database = None
is_connected = False

def init_mongodb():
    """Initialize MongoDB connection (sync version)"""
    global client, database, is_connected
    
    try:
        mongo_uri = os.getenv("MONGO_URI", "mongodb://root:mongodb123@localhost:27017")
        db_name = os.getenv("MONGO_DATABASE", "iot")
        
        client = MongoClient(mongo_uri)
        database = client[db_name]
        
        # Test connection
        client.admin.command('ping')
        
        is_connected = True
        logger.info(f"MongoDB connected: {db_name}")
        return True
    except Exception as e:
        logger.error(f"❌ Failed to connect to MongoDB: {e}")
        is_connected = False
        return False

async def init_mongodb_async():
    """Initialize MongoDB connection (async wrapper for compatibility)"""
    return init_mongodb()

def get_database():
    """Get database instance - safe version that avoids truth value testing"""
    # Check connection flag only (don't check database object)
    if not is_connected:
        raise ValueError("MongoDB not connected")
    
    # Return database directly - don't check if it's None
    # PyMongo database objects don't support truth value testing
    # IMPORTANT: Don't check "if database is None" - use "is None" comparison safely
    # The check "database is None" is safe (doesn't trigger bool()), but we avoid it anyway
    # Just return database - if is_connected is True, database should be initialized
    return database

def get_client():
    """Get MongoDB client instance"""
    if not is_connected:
        raise ValueError("MongoDB not connected")
    return client

def close_mongodb():
    """Close MongoDB connection - safe version"""
    global client, database, is_connected
    try:
        # Only close if connected flag is True
        # Don't check client object to avoid truth value testing
        if is_connected:
            try:
                client.close()
            except Exception:
                pass
        client = None
        database = None
        is_connected = False
        logger.info("MongoDB connection closed")
    except Exception as e:
        logger.error(f"Error closing MongoDB: {e}")

