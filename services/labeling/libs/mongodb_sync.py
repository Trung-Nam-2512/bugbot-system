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
        logger.info(f"✅ MongoDB connected: {db_name}")
        return True
    except Exception as e:
        logger.error(f"❌ Failed to connect to MongoDB: {e}")
        is_connected = False
        return False

async def init_mongodb_async():
    """Initialize MongoDB connection (async wrapper for compatibility)"""
    return init_mongodb()

def get_database():
    """Get database instance"""
    if not is_connected:
        raise ValueError("MongoDB not connected")
    return database

def get_client():
    """Get MongoDB client instance"""
    if not is_connected:
        raise ValueError("MongoDB not connected")
    return client

def close_mongodb():
    """Close MongoDB connection"""
    global client, database, is_connected
    try:
        if client:
            client.close()
        client = None
        database = None
        is_connected = False
        logger.info("✅ MongoDB connection closed")
    except Exception as e:
        logger.error(f"Error closing MongoDB: {e}")


