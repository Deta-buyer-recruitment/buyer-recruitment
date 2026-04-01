from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from typing import Optional
import pandas as pd
import io
import json
from datetime import datetime

from services.supabase_client import get_supabase

router = APIRouter()


class CampaignCreate(BaseModel):
    customer_id: str
    company_name: str
    target_country: str
    product_description: str
    hs_code: str
    company_website: str
    usp: str
    signature_name: str
    signature_title: str
    signature_phone: str
    followup_interval_days: int = 7


@router.post("/")
async def create_campaign(payload: CampaignCreate):
    sb = get_supabase()
    data = {
        "customer_id": payload.customer_id,
        "status": "draft",
        "campaign_info": {
            "company_name": payload.company_name,
            "target_country": payload.target_country,
            "product_description": payload.product_description,
            "hs_code": payload.hs_code,
            "company_website": payload.company_website,
            "usp": payload.usp,
            "signature_name": payload.signature_name,
            "signature_title": payload.signature_title,
            "signature_phone": payload.signature_phone,
            "followup_interval_days": payload.followup_interval_days,
        },
        "created_at": datetime.now().isoformat(),
    }
    result = sb.table("campaigns").insert(data).execute()
    return result.data[0]


@router.get("/")
async def list_campaigns(customer_id: Optional[str] = None):
    sb = get_supabase()
    q = sb.table("campaigns").select("*, customers(name)").order("created_at", desc=True)
    if customer_id:
        q = q.eq("customer_id", customer_id)
    result = q.execute()
    return result.data


@router.get("/{campaign_id}")
async def get_campaign(campaign_id: str):
    sb = get_supabase()
    result = sb.table("campaigns").select("*, customers(*)").eq("id", campaign_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="캠페인을 찾을 수 없습니다")
    return result.data


@router.post("/{campaign_id}/upload-buyers")
async def upload_buyers(
    campaign_id: str,
    customer_id: str = Form(...),
    file: UploadFile = File(...)
):
    """
    CSV 파일 업로드 → Supabase buyers 테이블에 저장
    기존 엑셀 Contact Log 양식 및 buyer_list_for_assistant.csv 양식 모두 지원
    """
    sb = get_supabase()

    contents = await file.read()

    try:
        if file.filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(contents), encoding="utf-8-sig")
        else:
            df = pd.read_excel(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"파일 파싱 오류: {str(e)}")

    # 컬럼명 정규화 (한/영 양식 모두 지원)
    col_map = {
        "바이어사명 (Company)": "company",
        "company": "company",
        "국가 (Country)": "country",
        "country": "country",
        "웹사이트 (Website)": "website",
        "website": "website",
        "담당자명 (Contact Name)": "contact_name",
        "name": "contact_name",
        "contact_name": "contact_name",
        "직함 (Position)": "position",
        "position": "position",
        "이메일": "email",
        "email": "email",
        "전화번호 (Phone)": "phone",
        "phone": "phone",
        "No.": "no",
        "no": "no",
        "주요 내용 (Summary)": "summary",
        "summary": "summary",
        "비고 (Notes)": "notes",
        "notes": "notes",
    }
    df.rename(columns={c: col_map[c] for c in df.columns if c in col_map}, inplace=True)

    if "company" not in df.columns:
        raise HTTPException(status_code=400, detail="'company' 또는 '바이어사명' 컬럼이 필요합니다")

    # 고객사명 컬럼이 있으면 필터링
    if "고객사명" in df.columns:
        customer_result = sb.table("customers").select("name").eq("id", customer_id).single().execute()
        if customer_result.data:
            customer_name = customer_result.data["name"]
            df = df[df["고객사명"] == customer_name]

    buyers = []
    for _, row in df.iterrows():
        company = str(row.get("company", "")).strip()
        if not company or company.lower() in ("nan", "none", ""):
            continue
        buyers.append({
            "customer_id": customer_id,
            "no": int(row["no"]) if "no" in row and str(row["no"]) not in ("nan", "") else None,
            "company": company,
            "country": str(row.get("country", "")).strip() or "Unknown",
            "website": str(row["website"]).strip() if "website" in row and str(row.get("website")) not in ("nan", "", "None") else None,
            "contact_name": str(row["contact_name"]).strip() if "contact_name" in row and str(row.get("contact_name")) not in ("nan", "", "None") else None,
            "position": str(row["position"]).strip() if "position" in row and str(row.get("position")) not in ("nan", "", "None") else None,
            "email": str(row["email"]).strip() if "email" in row and str(row.get("email")) not in ("nan", "", "None") else None,
            "phone": str(row["phone"]).strip() if "phone" in row and str(row.get("phone")) not in ("nan", "", "None") else None,
            "summary": str(row["summary"]).strip() if "summary" in row and str(row.get("summary")) not in ("nan", "", "None") else None,
            "notes": str(row["notes"]).strip() if "notes" in row and str(row.get("notes")) not in ("nan", "", "None") else None,
            "status": "pending",
        })

    if not buyers:
        raise HTTPException(status_code=400, detail="유효한 바이어 데이터가 없습니다")

    # 기존 바이어 삭제 후 재삽입 (upsert 방식)
    sb.table("buyers").delete().eq("customer_id", customer_id).execute()
    result = sb.table("buyers").insert(buyers).execute()

    return {"inserted": len(result.data), "buyers": result.data}


class CampaignInfoUpdate(BaseModel):
    campaign_info: dict


@router.patch("/{campaign_id}/info")
async def update_campaign_info(campaign_id: str, payload: CampaignInfoUpdate):
    """Project Info 수정"""
    sb = get_supabase()
    result = sb.table("campaigns").update({
        "campaign_info": payload.campaign_info
    }).eq("id", campaign_id).execute()
    return result.data[0]


class TemplatesUpdate(BaseModel):
    email_templates: list


@router.patch("/{campaign_id}/templates")
async def update_templates(campaign_id: str, payload: TemplatesUpdate):
    """Claude 채팅으로 수정된 템플릿 저장"""
    sb = get_supabase()
    result = sb.table("campaigns").update({
        "email_templates": payload.email_templates
    }).eq("id", campaign_id).execute()
    return result.data[0]
