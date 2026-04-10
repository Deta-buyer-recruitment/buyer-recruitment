from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
import json
from datetime import datetime

from services.agent_service import run_full_pipeline
from services.gmail_service import send_campaign_round, check_gmail_auth
from services.supabase_client import get_supabase

router = APIRouter()

# 실행 중인 Agent 중지 플래그
_stop_flags: dict[str, bool] = {}


def is_stopped(campaign_id: str) -> bool:
    return _stop_flags.get(campaign_id, False)


def clear_stop(campaign_id: str):
    _stop_flags.pop(campaign_id, None)


@router.post("/stop/{campaign_id}")
async def stop_agent(campaign_id: str):
    """Agent 실행 중지"""
    _stop_flags[campaign_id] = True
    sb = get_supabase()
    sb.table("campaigns").update({"status": "draft"}).eq("id", campaign_id).execute()
    return {"success": True, "message": "Agent 중지 요청됨"}


@router.get("/run/{campaign_id}")
async def run_agent(campaign_id: str):
    """
    Agent 파이프라인 실행 — SSE 스트리밍
    팀원이 버튼 클릭 → 실시간 진행상황을 화면에서 확인
    """
    clear_stop(campaign_id)
    async def generate():
        async for event in run_full_pipeline(campaign_id, lambda: is_stopped(campaign_id)):
            yield event
        clear_stop(campaign_id)
        yield "data: {\"type\": \"done\"}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        }
    )


@router.get("/status/{campaign_id}")
async def get_agent_status(campaign_id: str):
    """현재 캠페인 Agent 진행 상태 조회"""
    sb = get_supabase()
    result = sb.table("campaigns").select("status, abm_analysis, email_templates").eq("id", campaign_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="캠페인 없음")
    return result.data


class SendRoundPayload(BaseModel):
    campaign_id: str
    round_key: str   # r1_initial | r2_replied | r2_no_reply | r3_replied | r3_no_reply
    buyer_ids: Optional[list[str]] = None   # None이면 전체


@router.post("/send")
async def send_round(payload: SendRoundPayload):
    """
    이메일 라운드 발송
    사용자 검토 승인 후 호출
    """
    sb = get_supabase()

    # 캠페인 정보 조회
    camp = sb.table("campaigns").select("*").eq("id", payload.campaign_id).single().execute().data
    if not camp:
        raise HTTPException(status_code=404, detail="캠페인 없음")

    if camp["status"] not in ("review_pending", "sending", "r1_sent", "r2_sent"):
        raise HTTPException(
            status_code=400,
            detail=f"현재 상태({camp['status']})에서는 발송할 수 없습니다"
        )

    templates = camp.get("email_templates", [])
    if not templates:
        raise HTTPException(status_code=400, detail="이메일 템플릿이 없습니다. Agent를 먼저 실행하세요.")

    # 특정 바이어만 필터
    if payload.buyer_ids:
        # buyer_id 기반 필터링을 위해 buyers 테이블 조회
        buyers_q = sb.table("buyers").select("company, email").in_("id", payload.buyer_ids).execute()
        target_companies = {b["company"] for b in buyers_q.data}
        templates = [t for t in templates if t["consignee_name"] in target_companies]

    campaign_info = camp.get("campaign_info", {})
    sender_display = campaign_info.get("company_name", "")

    result = send_campaign_round(templates, payload.round_key, sender_display)

    if not result["success"]:
        raise HTTPException(status_code=500, detail=result.get("error", "발송 실패"))

    # Contact Log 자동 기록
    round_num = {"r1_initial": 1, "r2_replied": 2, "r2_no_reply": 2,
                 "r3_replied": 3, "r3_no_reply": 3}.get(payload.round_key, 1)

    for sent_item in result.get("sent", []):
        if not sent_item["success"]:
            continue
        # 바이어 ID 조회
        buyer_q = sb.table("buyers").select("id").eq(
            "customer_id", camp["customer_id"]
        ).eq("company", sent_item["consignee_name"]).single().execute()

        if buyer_q.data:
            buyer_id = buyer_q.data["id"]
            contact_method = "Email"
            sb.table("contact_logs").upsert({
                "buyer_id": buyer_id,
                "attempt_no": round_num,
                "contact_date": datetime.now().strftime("%Y-%m-%d"),
                "contact_method": contact_method,
                "replied": None,
                "result": f"{payload.round_key} 발송완료",
            }).execute()

            # 바이어 상태 업데이트
            sb.table("buyers").update({"status": "contacted"}).eq("id", buyer_id).execute()

    # 캠페인 상태 업데이트
    next_status = {1: "r1_sent", 2: "r2_sent", 3: "r3_sent"}.get(round_num, "r1_sent")
    sb.table("campaigns").update({"status": next_status}).eq("id", payload.campaign_id).execute()

    return {
        "success": True,
        "round": payload.round_key,
        "success_count": result["success_count"],
        "fail_count": result["fail_count"],
        "send_datetime": result["send_datetime"],
    }


@router.get("/gmail/status")
async def gmail_status():
    """Gmail OAuth 인증 상태 확인"""
    return check_gmail_auth()


class UpdateCTAPayload(BaseModel):
    campaign_id: str
    cta_sample_link: str
    cta_calendar_link: str
    cta_catalogue_link: Optional[str] = None


@router.post("/update-cta")
async def update_cta_links(payload: UpdateCTAPayload):
    """
    이메일 템플릿의 CTA placeholder를 실제 URL로 치환
    발송 전 반드시 호출
    """
    sb = get_supabase()
    camp = sb.table("campaigns").select("email_templates").eq("id", payload.campaign_id).single().execute().data
    if not camp:
        raise HTTPException(status_code=404, detail="캠페인 없음")

    templates = camp.get("email_templates", [])
    replacements = {
        "{{cta_link_1}}": payload.cta_sample_link,
        "{{cta_link_2}}": payload.cta_calendar_link,
        "{{calendar_link}}": payload.cta_calendar_link,
        "{{cta_link_3}}": payload.cta_catalogue_link or payload.cta_sample_link,
    }

    updated = []
    for tmpl in templates:
        tmpl_str = json.dumps(tmpl, ensure_ascii=False)
        for placeholder, url in replacements.items():
            tmpl_str = tmpl_str.replace(placeholder, url)
        updated.append(json.loads(tmpl_str))

    sb.table("campaigns").update({"email_templates": updated}).eq("id", payload.campaign_id).execute()
    return {"success": True, "updated_count": len(updated)}


@router.get("/run-step/{campaign_id}")
async def run_step(campaign_id: str, step: str):
    """
    단계별 Agent 실행
    step: website | hunter | abm | templates
    """
    from services.agent_service import run_step_pipeline
    from fastapi.responses import StreamingResponse
    clear_stop(campaign_id)
    return StreamingResponse(
        run_step_pipeline(campaign_id, step, lambda: is_stopped(campaign_id)),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        }
    )
