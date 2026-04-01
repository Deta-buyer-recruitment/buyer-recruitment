"""
고객용 API 라우터
"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from typing import Optional
import os
import hashlib
from datetime import datetime

from services.supabase_client import get_supabase

router = APIRouter()
STORAGE_BUCKET = "project-files"


# ── 고객 로그인 (아이디/비번 검증) ──────────────────────────

class ClientLoginPayload(BaseModel):
    slug: str
    access_id: str
    access_password: str

@router.post("/login")
async def client_login(payload: ClientLoginPayload):
    """고객 대시보드 로그인 — slug + 아이디/비번 검증"""
    sb = get_supabase()
    result = sb.table("customers").select(
        "id, name, slug, access_id, access_password"
    ).eq("slug", payload.slug).execute()

    if not result.data or len(result.data) == 0:
        raise HTTPException(status_code=404, detail="Client not found")

    c = result.data[0]

    # 아이디/비번 미설정 시 접근 차단
    if not c.get("access_id") or not c.get("access_password"):
        raise HTTPException(status_code=403, detail="Access not configured. Contact your project manager.")

    if c["access_id"] != payload.access_id:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # 비번 비교: Python hashlib.sha256 == pgcrypto encode(digest(),'hex')
    stored_pw    = c["access_password"]
    input_pw     = payload.access_password
    hashed_input = hashlib.sha256(input_pw.encode()).hexdigest()

    if stored_pw != input_pw and stored_pw != hashed_input:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    return {"success": True, "customer_id": c["id"], "customer_name": c["name"]}


# ── 타임라인 ─────────────────────────────────────────────────

@router.get("/timeline/{customer_id}")
async def get_timeline(customer_id: str):
    sb = get_supabase()
    result = sb.table("timelines").select("*").eq(
        "customer_id", customer_id
    ).order("step_no").execute()
    if not result.data:
        sb.rpc("init_timeline", {"p_customer_id": customer_id}).execute()
        result = sb.table("timelines").select("*").eq(
            "customer_id", customer_id
        ).order("step_no").execute()
    return result.data


class TimelineUpdate(BaseModel):
    step_no: int
    status: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    memo: Optional[str] = None


@router.patch("/timeline/{customer_id}")
async def update_timeline(customer_id: str, payload: TimelineUpdate):
    sb = get_supabase()
    data = {k: v for k, v in payload.dict().items() if v is not None and k != "step_no"}
    data["updated_at"] = datetime.now().isoformat()
    result = sb.table("timelines").update(data).eq(
        "customer_id", customer_id
    ).eq("step_no", payload.step_no).execute()
    return result.data[0]


class TimelineStepAdd(BaseModel):
    step_name: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None


@router.post("/timeline/{customer_id}/add-step")
async def add_timeline_step(customer_id: str, payload: TimelineStepAdd):
    sb = get_supabase()
    existing = sb.table("timelines").select("step_no").eq(
        "customer_id", customer_id
    ).order("step_no", desc=True).limit(1).execute().data
    next_step = (existing[0]["step_no"] + 1) if existing else 7
    result = sb.table("timelines").insert({
        "customer_id": customer_id,
        "step_no":     next_step,
        "step_name":   payload.step_name,
        "start_date":  payload.start_date,
        "end_date":    payload.end_date,
        "status":      "pending",
    }).execute()
    return result.data[0]


@router.delete("/timeline/{customer_id}/step/{step_no}")
async def delete_timeline_step(customer_id: str, step_no: int):
    if step_no <= 6:
        raise HTTPException(status_code=400, detail="Default 6 steps cannot be deleted")
    sb = get_supabase()
    sb.table("timelines").delete().eq("customer_id", customer_id).eq("step_no", step_no).execute()
    return {"deleted": True}


# ── 파일 ─────────────────────────────────────────────────────

@router.get("/files/{customer_id}")
async def list_files(customer_id: str):
    sb = get_supabase()
    result = sb.table("project_files").select("*").eq(
        "customer_id", customer_id
    ).order("created_at", desc=True).execute()
    return result.data


@router.post("/files/{customer_id}/upload")
async def upload_file(
    customer_id: str,
    category: str = Form("report"),
    uploader_id: str = Form(...),
    file: UploadFile = File(...)
):
    sb = get_supabase()
    contents = await file.read()
    storage_path = f"{customer_id}/{datetime.now().strftime('%Y%m%d_%H%M%S')}_{file.filename}"
    sb.storage.from_(STORAGE_BUCKET).upload(
        storage_path, contents,
        {"content-type": file.content_type or "application/octet-stream"}
    )
    result = sb.table("project_files").insert({
        "customer_id": customer_id,
        "name": file.filename,
        "category": category,
        "storage_path": storage_path,
        "size_bytes": len(contents),
        "uploaded_by": uploader_id,
    }).execute()
    return result.data[0]


@router.get("/files/{customer_id}/download/{file_id}")
async def download_file(customer_id: str, file_id: str):
    sb = get_supabase()
    f = sb.table("project_files").select("storage_path, name").eq(
        "id", file_id
    ).eq("customer_id", customer_id).single().execute().data
    if not f:
        raise HTTPException(status_code=404, detail="File not found")
    signed = sb.storage.from_(STORAGE_BUCKET).create_signed_url(f["storage_path"], 3600)
    return {"signed_url": signed["signedURL"], "filename": f["name"]}


@router.delete("/files/{customer_id}/{file_id}")
async def delete_file(customer_id: str, file_id: str):
    sb = get_supabase()
    f = sb.table("project_files").select("storage_path").eq("id", file_id).single().execute().data
    if not f:
        raise HTTPException(status_code=404, detail="File not found")
    sb.storage.from_(STORAGE_BUCKET).remove([f["storage_path"]])
    sb.table("project_files").delete().eq("id", file_id).execute()
    return {"deleted": True}


# ── 미팅 ─────────────────────────────────────────────────────

@router.get("/meetings/{customer_id}")
async def list_meetings(customer_id: str):
    sb = get_supabase()
    result = sb.table("meetings").select("*, buyers(company, country)").eq(
        "customer_id", customer_id
    ).order("meeting_date").execute()
    return result.data


@router.get("/meetings/{customer_id}/count")
async def count_meetings(customer_id: str):
    sb = get_supabase()
    result = sb.table("meetings").select("id", count="exact").eq(
        "customer_id", customer_id
    ).eq("status", "scheduled").execute()
    return {"count": result.count or 0}


class MeetingCreate(BaseModel):
    buyer_id: Optional[str] = None
    title: str
    meeting_date: Optional[str] = None
    location: Optional[str] = None
    notes: Optional[str] = None


@router.post("/meetings/{customer_id}")
async def create_meeting(customer_id: str, payload: MeetingCreate):
    sb = get_supabase()
    result = sb.table("meetings").insert({
        "customer_id": customer_id,
        **payload.dict(exclude_none=True)
    }).execute()
    return result.data[0]


@router.patch("/meetings/{meeting_id}")
async def update_meeting(meeting_id: str, payload: dict):
    sb = get_supabase()
    result = sb.table("meetings").update(payload).eq("id", meeting_id).execute()
    return result.data[0]


# ── 문의 ─────────────────────────────────────────────────────

@router.get("/inquiries/{customer_id}")
async def list_inquiries(customer_id: str):
    sb = get_supabase()
    result = sb.table("inquiries").select("*").eq(
        "customer_id", customer_id
    ).order("created_at", desc=True).execute()
    return result.data


class InquiryCreate(BaseModel):
    author_name: Optional[str] = None
    title: str
    content: str


@router.post("/inquiries/{customer_id}")
async def create_inquiry(customer_id: str, payload: InquiryCreate):
    sb = get_supabase()
    result = sb.table("inquiries").insert({
        "customer_id": customer_id,
        **payload.dict(exclude_none=True)
    }).execute()
    return result.data[0]


class InquiryAnswer(BaseModel):
    answer: str


@router.patch("/inquiries/{inquiry_id}/answer")
async def answer_inquiry(inquiry_id: str, payload: InquiryAnswer):
    sb = get_supabase()
    result = sb.table("inquiries").update({
        "answer": payload.answer,
        "status": "answered",
        "answered_at": datetime.now().isoformat()
    }).eq("id", inquiry_id).execute()
    return result.data[0]


# ── 대시보드 통합 API ─────────────────────────────────────────

async def _build_dashboard(customer_id: str) -> dict:
    from datetime import datetime, timedelta
    sb = get_supabase()
    customer  = sb.table("customers").select("id,name,slug").eq("id", customer_id).single().execute().data
    timeline  = sb.table("timelines").select("*").eq("customer_id", customer_id).order("step_no").execute().data or []
    buyers    = sb.table("buyers").select("id,company,country,status").eq("customer_id", customer_id).execute().data or []
    files     = sb.table("project_files").select("*").eq("customer_id", customer_id).order("created_at", desc=True).execute().data or []
    meetings  = sb.table("meetings").select("*,buyers(company,country)").eq("customer_id", customer_id).order("meeting_date").execute().data or []
    inquiries = sb.table("inquiries").select("*").eq("customer_id", customer_id).order("created_at", desc=True).execute().data or []

    # contact_logs 전체 조회 (weekly 집계용)
    buyer_ids = [b["id"] for b in buyers]
    all_logs = []
    if buyer_ids:
        logs_result = sb.table("contact_logs").select(
            "buyer_id, attempt_no, contact_date, replied"
        ).in_("buyer_id", buyer_ids).execute().data or []
        all_logs = logs_result

    if not timeline:
        sb.rpc("init_timeline", {"p_customer_id": customer_id}).execute()
        timeline = sb.table("timelines").select("*").eq("customer_id", customer_id).order("step_no").execute().data or []

    total_steps = max(len(timeline), 1)
    done    = len([t for t in timeline if t["status"] == "done"])
    in_prog = len([t for t in timeline if t["status"] == "in_progress"])
    progress = round((done + in_prog * 0.5) / total_steps * 100)

    # contact_logs 기반 통계
    contacted_ids = set(log["buyer_id"] for log in all_logs if log.get("attempt_no") == 1)
    replied_ids   = set(log["buyer_id"] for log in all_logs if log.get("replied") is True)
    total_contacted = len(contacted_ids)
    total_replied   = len(replied_ids)

    # Weekly 집계 — contact_date 기반 주별 누적
    weekly_data = _build_weekly_stats(all_logs)

    return {
        "customer": customer,
        "buyers":   [{"company": b["company"], "country": b["country"], "status": b["status"]} for b in buyers],
        "timeline": timeline,
        "progress": progress,
        "stats": {
            "total_buyers": len(buyers),
            "contacted": total_contacted or len([b for b in buyers if b["status"] != "pending"]),
            "replied":   total_replied   or len([b for b in buyers if b["status"] in ("replied","meeting","closed")]),
            "meetings":  len([m for m in meetings if m["status"] == "scheduled"]),
        },
        "weekly_data": weekly_data,
        "files":     files,
        "meetings":  meetings,
        "inquiries": inquiries,
    }


def _build_weekly_stats(logs: list) -> list:
    """contact_logs의 contact_date 기반 주별 누적 통계"""
    from collections import defaultdict
    import re

    if not logs:
        return []

    # 날짜 파싱 (2026.02.09 - 2026.02.23, 2026-02-09 등 다양한 형식 지원)
    weekly = defaultdict(lambda: {"contacted": 0, "replied": 0})

    for log in logs:
        date_str = log.get("contact_date", "")
        if not date_str:
            continue
        # 날짜 범위면 시작 날짜 사용
        date_str = str(date_str).split("-")[0].split("~")[0].strip()
        # 숫자만 추출해서 날짜 파싱
        nums = re.findall(r'\d+', date_str)
        if len(nums) >= 3:
            try:
                year, month, day = int(nums[0]), int(nums[1]), int(nums[2])
                from datetime import date
                d = date(year, month, day)
                # ISO 주 번호로 그룹화
                week_key = d.strftime("%Y W%V")
                # 사람이 읽기 좋은 형태로 변환
                month_names = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
                week_num = int(d.strftime("%V"))
                week_label = f"{month_names[d.month-1]}. week {((d.day-1)//7)+1}"

                if log.get("attempt_no") == 1:
                    weekly[week_key]["label"] = week_label
                    weekly[week_key]["contacted"] += 1
                if log.get("replied") is True:
                    weekly[week_key]["label"] = week_label
                    weekly[week_key]["replied"] += 1
            except Exception:
                continue

    if not weekly:
        return []

    # 시간순 정렬
    sorted_weeks = sorted(weekly.items())
    result = []
    cum_contacted = 0
    cum_replied   = 0
    for week_key, data in sorted_weeks:
        cum_contacted += data.get("contacted", 0)
        cum_replied   += data.get("replied",   0)
        result.append({
            "week":      data.get("label", week_key),
            "contacted": cum_contacted,
            "replied":   cum_replied,
            "meetings":  0,
        })
    return result


@router.get("/dashboard/slug/{slug}")
async def dashboard_by_slug(slug: str):
    """slug 기반 — 반드시 /dashboard/{customer_id} 보다 먼저 선언해야 함"""
    sb = get_supabase()
    result = sb.table("customers").select("id").eq("slug", slug).execute()
    if not result.data or len(result.data) == 0:
        raise HTTPException(status_code=404, detail=f"'{slug}' not found")
    return await _build_dashboard(result.data[0]["id"])


@router.get("/dashboard/{customer_id}")
async def customer_dashboard(customer_id: str):
    return await _build_dashboard(customer_id)


# ── 고객사 생성/조회 ──────────────────────────────────────────

class CustomerCreate(BaseModel):
    name: str
    slug: str
    access_id: Optional[str] = None
    access_password: Optional[str] = None


@router.post("/customers")
async def create_customer(payload: CustomerCreate):
    sb = get_supabase()
    data = {"name": payload.name, "slug": payload.slug}
    if payload.access_id:
        data["access_id"] = payload.access_id
    if payload.access_password:
        # 비번 해시 저장
        data["access_password"] = hashlib.sha256(payload.access_password.encode()).hexdigest()
    result = sb.table("customers").insert(data).execute()
    customer_id = result.data[0]["id"]
    sb.rpc("init_timeline", {"p_customer_id": customer_id}).execute()
    return result.data[0]


@router.get("/customers")
async def list_customers():
    sb = get_supabase()
    # 비번은 노출 안 함
    return sb.table("customers").select("id,name,slug,access_id,created_at").order("name").execute().data


class CustomerAccessUpdate(BaseModel):
    access_id: str
    access_password: str


@router.patch("/customers/{customer_id}/access")
async def update_customer_access(customer_id: str, payload: CustomerAccessUpdate):
    """고객사 아이디/비번 설정 또는 변경"""
    sb = get_supabase()
    hashed = hashlib.sha256(payload.access_password.encode()).hexdigest()
    result = sb.table("customers").update({
        "access_id": payload.access_id,
        "access_password": hashed,
    }).eq("id", customer_id).execute()
    return {"success": True, "access_id": payload.access_id}


# ── 프로필 / 권한 ─────────────────────────────────────────────

@router.get("/profiles")
async def list_profiles():
    sb = get_supabase()
    return sb.table("profiles").select("*, customers(name)").execute().data


class ProfileUpdate(BaseModel):
    role: str   # editor / manager / viewer / customer
    customer_id: Optional[str] = None
    full_name: Optional[str] = None


@router.patch("/profiles/{user_id}")
async def update_profile(user_id: str, payload: ProfileUpdate):
    sb = get_supabase()
    result = sb.table("profiles").update(payload.dict(exclude_none=True)).eq(
        "id", user_id
    ).execute()
    return result.data[0]


# ── 팀원 초대 ─────────────────────────────────────────────────

class InvitePayload(BaseModel):
    email: str
    role: str = "viewer"
    customer_id: Optional[str] = None


@router.post("/invite")
async def invite_user(payload: InvitePayload):
    import httpx
    supabase_url = os.getenv("SUPABASE_URL", "")
    service_key  = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    try:
        resp = httpx.post(
            f"{supabase_url}/auth/v1/invite",
            headers={
                "apikey": service_key,
                "Authorization": f"Bearer {service_key}",
                "Content-Type": "application/json",
            },
            json={"email": payload.email},
            timeout=15,
        )
        data = resp.json()
        if resp.status_code == 200 and data.get("id"):
            user_id = data["id"]
            sb = get_supabase()
            sb.table("profiles").upsert({
                "id": user_id,
                "email": payload.email,
                "role": payload.role,
                "customer_id": payload.customer_id or None,
            }).execute()
            return {"success": True, "message": f"Invitation sent to {payload.email}"}
        else:
            return {"success": False, "error": data.get("msg", "Invite failed")}
    except Exception as e:
        return {"success": False, "error": str(e)}
