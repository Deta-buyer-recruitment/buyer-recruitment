from fastapi import APIRouter
from services.gmail_service import check_gmail_auth

router = APIRouter()

@router.get("/status")
async def gmail_status():
    """Gmail OAuth 인증 상태 확인"""
    return check_gmail_auth()
