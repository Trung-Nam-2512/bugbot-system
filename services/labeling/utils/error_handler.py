"""
Error handling utilities for Labeling Service
Safe exception message extraction for Motor/Pydantic exceptions
"""

def safe_error_message(exception):
    """
    Safely extract error message from exception
    Avoids truth value testing issues with Motor database objects
    """
    try:
        # Try to get message from args first (safest)
        if hasattr(exception, 'args') and exception.args:
            # Only use first arg if it's a string
            # Don't try to convert non-strings to avoid truth value testing errors
            msg = exception.args[0]
            if isinstance(msg, str):
                return msg
            # If not a string, skip it to avoid issues
        
        # Try to get message attribute
        if hasattr(exception, 'message') and isinstance(exception.message, str):
            return exception.message
        
        # Try __str__ method but catch ALL exceptions including truth value errors
        try:
            msg = str(exception)
            # If message contains truth value testing error, extract just the error type
            if "truth value testing" in msg.lower() or "database is not None" in msg:
                return f"Database connection error: {type(exception).__name__}"
            return msg
        except Exception:
            # If str() fails (including truth value testing errors), use type name
            pass
        
        # Fallback: use exception type name
        try:
            return f"Error: {type(exception).__name__}"
        except Exception:
            return "Internal server error"
        
    except Exception:
        # If anything goes wrong, return generic message
        return "Internal server error"

