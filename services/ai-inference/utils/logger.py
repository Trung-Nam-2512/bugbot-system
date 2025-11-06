"""
Logger Utility
Setup structured logging cho AI service
"""

import logging
import sys
from pythonjsonlogger import jsonlogger

def setup_logger(name: str, level: str = "INFO") -> logging.Logger:
    """Setup JSON logger"""
    logger = logging.getLogger(name)
    logger.setLevel(getattr(logging, level.upper()))
    
    # Remove existing handlers
    logger.handlers = []
    
    # Create JSON formatter
    formatter = jsonlogger.JsonFormatter(
        '%(timestamp)s %(level)s %(name)s %(message)s'
    )
    
    # Console handler
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)
    logger.addHandler(handler)
    
    return logger









