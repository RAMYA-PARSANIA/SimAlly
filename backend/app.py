from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import requests
import os
import uuid
from datetime import datetime
from typing import Optional, Dict
import uvicorn
import dotenv

# Load environment variables from .env file
dotenv.load_dotenv()
app = FastAPI(title="SimAlly Game Backend", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Store active conversations per user session
active_conversations: Dict[str, Dict] = {}

# Tavus API configuration
TAVUS_API_KEY = os.getenv("TAVUS_API_KEY")
PERSONA_ID = os.getenv("PERSONA_ID")
REPLICA_ID = os.getenv("REPLICA_ID")

# Pydantic models
class CreateConversationRequest(BaseModel):
    user_id: Optional[str] = None

class EndConversationRequest(BaseModel):
    user_id: str

class ConversationResponse(BaseModel):
    success: bool
    conversation_id: Optional[str] = None
    conversation_url: Optional[str] = None
    user_id: Optional[str] = None
    error: Optional[str] = None
    details: Optional[str] = None

class EndConversationResponse(BaseModel):
    success: bool
    message: Optional[str] = None
    error: Optional[str] = None

@app.post("/api/create-riddle-conversation", response_model=ConversationResponse)
async def create_riddle_conversation(request: CreateConversationRequest):
    try:
        # Get user ID from request or create session ID
        user_id = request.user_id or str(uuid.uuid4())
        
        url = "https://tavusapi.com/v2/conversations"
        
        payload = {
            "replica_id": REPLICA_ID,
            "persona_id": PERSONA_ID,
            "callback_url": "https://yourwebsite.com/webhook",
            "conversation_name": "Game Buddy",
            "conversational_context": "You are a playful and clever riddle master. Your job is to challenge the user with creative and tricky riddles. Encourage the user to guess, ask for hints, or skip if they're stuck. React in a fun and engaging way to each guess, making the experience lighthearted and enjoyable.",
            "custom_greeting": "Welcome, challenger! Ready to test your wits with some riddles? Let's see if you can outsmart me!",
            "properties": {
                "max_call_duration": 3600,
                "participant_left_timeout": 60,
                "participant_absent_timeout": 300,
                "enable_recording": True,
                "enable_closed_captions": True,
                "apply_greenscreen": True,
                "language": "english",
                "recording_s3_bucket_name": "conversation-recordings",
                "recording_s3_bucket_region": "us-east-1",
                "aws_assume_role_arn": ""
            }
        }
        
        headers = {
            "x-api-key": TAVUS_API_KEY,
            "Content-Type": "application/json"
        }
        
        response = requests.post(url, json=payload, headers=headers)
        print("Tavus API response:", response.status_code, response.text)  # Add this line
        print(TAVUS_API_KEY)
        if response.status_code == 200:
            conversation_data = response.json()
            conversation_id = conversation_data.get("conversation_id")
            conversation_url = conversation_data.get("conversation_url")
            
            # Store conversation ID for this user
            active_conversations[user_id] = {
                "conversation_id": conversation_id,
                "created_at": datetime.now().isoformat()
            }
            
            return ConversationResponse(
                success=True,
                conversation_id=conversation_id,
                conversation_url=conversation_url,
                user_id=user_id
            )
        else:
            raise HTTPException(
                status_code=500,
                detail={
                    "success": False,
                    "error": "Failed to create conversation",
                    "details": response.text
                }
            )
            
    except requests.RequestException as e:
        raise HTTPException(
            status_code=500,
            detail={
                "success": False,
                "error": f"Request failed: {str(e)}"
            }
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "success": False,
                "error": str(e)
            }
        )

@app.post("/api/end-conversation", response_model=EndConversationResponse)
async def end_conversation(request: EndConversationRequest):
    try:
        user_id = request.user_id
        
        if not user_id or user_id not in active_conversations:
            raise HTTPException(
                status_code=404,
                detail={
                    "success": False,
                    "error": "No active conversation found for user"
                }
            )
        
        conversation_id = active_conversations[user_id]["conversation_id"]
        
        headers = {
            "x-api-key": TAVUS_API_KEY,
            "Content-Type": "application/json"
        }
        
        # End the conversation
        end_url = f"https://tavusapi.com/v2/conversations/{conversation_id}/end"
        end_response = requests.post(end_url, headers=headers)
        
        # Delete the conversation
        delete_url = f"https://tavusapi.com/v2/conversations/{conversation_id}"
        delete_response = requests.delete(delete_url, headers=headers)
        
        # Remove from active conversations
        del active_conversations[user_id]
        
        return EndConversationResponse(
            success=True,
            message="Conversation ended and deleted successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "success": False,
                "error": str(e)
            }
        )

@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy", 
        "active_conversations": len(active_conversations),
        "framework": "FastAPI"
    }

@app.get("/")
async def root():
    return {"message": "SimAlly Game Backend API", "framework": "FastAPI"}

if __name__ == "__main__":
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )