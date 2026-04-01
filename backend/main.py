"""
BuyerOS — FastAPI 백엔드 메인
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

load_dotenv()

from routers import campaigns, buyers, contacts, agent, gmail_auth, client

app = FastAPI(title="BuyerOS API", version="1.0.0")

# CORS — 모든 origin 허용 (개발 단계)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(campaigns.router,  prefix="/api/campaigns",  tags=["campaigns"])
app.include_router(buyers.router,     prefix="/api/buyers",     tags=["buyers"])
app.include_router(contacts.router,   prefix="/api/contacts",   tags=["contacts"])
app.include_router(agent.router,      prefix="/api/agent",      tags=["agent"])
app.include_router(gmail_auth.router, prefix="/api/gmail",      tags=["gmail"])
app.include_router(client.router,     prefix="/api/client",     tags=["client"])

@app.get("/")
def root():
    return {"status": "ok", "service": "BuyerOS API"}

@app.get("/health")
def health():
    return {"status": "healthy"}
