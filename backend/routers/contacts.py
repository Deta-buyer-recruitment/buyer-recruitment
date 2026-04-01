from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from services.supabase_client import get_supabase

router = APIRouter()


class ContactLogUpsert(BaseModel):
    buyer_id: str
    attempt_no: int          # 1~10
    contact_date: Optional[str] = None
    contact_method: Optional[str] = None   # Email / Call / Email & Call / WhatsApp
    replied: Optional[bool] = None
    result: Optional[str] = None


@router.post("/")
async def upsert_contact_log(payload: ContactLogUpsert):
    """연락 기록 저장/수정 (attempt_no 기준 upsert)"""
    if not 1 <= payload.attempt_no <= 10:
        raise HTTPException(status_code=400, detail="attempt_no는 1~10이어야 합니다")

    sb = get_supabase()
    data = {k: v for k, v in payload.dict().items() if v is not None}

    result = sb.table("contact_logs").upsert(
        data, on_conflict="buyer_id,attempt_no"
    ).execute()

    # 회신 여부에 따라 바이어 상태 업데이트
    if payload.replied is True:
        sb.table("buyers").update({"status": "replied"}).eq("id", payload.buyer_id).execute()
    elif payload.replied is False:
        # 미회신이라도 contacted 유지
        pass

    return result.data[0]


@router.get("/buyer/{buyer_id}")
async def get_buyer_logs(buyer_id: str):
    """바이어별 전체 컨택 로그 조회"""
    sb = get_supabase()
    result = sb.table("contact_logs").select("*").eq(
        "buyer_id", buyer_id
    ).order("attempt_no").execute()
    return result.data


@router.get("/classify/{campaign_id}")
async def classify_by_reply(campaign_id: str, round_num: int = 2):
    """
    R2/R3 발송을 위해 회신/미회신 바이어 분류
    round_num=2 → 1차(attempt_no=1) 회신여부 기준
    round_num=3 → 2차(attempt_no=2) 회신여부 기준
    """
    sb = get_supabase()

    camp = sb.table("campaigns").select("customer_id, email_templates").eq(
        "id", campaign_id
    ).single().execute().data
    if not camp:
        raise HTTPException(status_code=404, detail="캠페인 없음")

    buyers = sb.table("buyers").select("id, company, email, contact_logs(*)").eq(
        "customer_id", camp["customer_id"]
    ).execute().data or []

    prev_attempt = round_num - 1
    replied = []
    no_reply = []
    pending = []   # 아직 회신여부 미입력

    templates = {t["consignee_name"]: t for t in (camp.get("email_templates") or [])}

    for buyer in buyers:
        logs = {l["attempt_no"]: l for l in (buyer.get("contact_logs") or [])}
        log = logs.get(prev_attempt, {})
        tmpl = templates.get(buyer["company"], {})

        item = {
            "buyer_id": buyer["id"],
            "company": buyer["company"],
            "email": buyer.get("email", ""),
            "replied": log.get("replied"),
            "consignee_name": buyer["company"],
            "contact_email": buyer.get("email", ""),
            **{k: v for k, v in tmpl.items() if k.startswith("r")},
        }

        if log.get("replied") is True:
            replied.append(item)
        elif log.get("replied") is False:
            no_reply.append(item)
        else:
            pending.append(item)

    return {
        "round": round_num,
        "replied": replied,
        "no_reply": no_reply,
        "pending": pending,
        "has_pending": len(pending) > 0,
    }
