"""
Agent 오케스트레이터 — Hunter.io 3개 컨택 + weekly 자동 집계
"""
import asyncio
import json
import os
import re
from datetime import datetime, timedelta
from typing import AsyncGenerator

import anthropic

from services.hunter_service import enrich_buyer_contacts
from services.supabase_client import get_supabase

anthropic_client = anthropic.AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY", ""))


def make_log(message: str, level: str = "info", data: dict = None) -> str:
    payload = {"message": message, "level": level, "timestamp": datetime.now().isoformat()}
    if data:
        payload["data"] = data
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


async def run_full_pipeline(campaign_id: str, should_stop=None) -> AsyncGenerator[str, None]:
    sb = get_supabase()
    try:
        camp = sb.table("campaigns").select("*, customers(*)").eq("id", campaign_id).single().execute()
        campaign = camp.data
        if not campaign:
            yield make_log("캠페인을 찾을 수 없습니다", "error")
            return

        campaign_info = campaign.get("campaign_info", {})
        customer_id = campaign["customer_id"]

        yield make_log(f"🚀 캠페인 시작: {campaign_info.get('company_name', '')}", "start")
        sb.table("campaigns").update({"status": "running"}).eq("id", campaign_id).execute()

        # STEP 1
        yield make_log("📋 STEP 1: 바이어 목록 조회", "step")
        buyers = sb.table("buyers").select("*").eq("customer_id", customer_id).execute().data or []
        yield make_log(f"✅ {len(buyers)}개 바이어 확인", "success")
        if not buyers:
            yield make_log("⚠️ 바이어가 없습니다. CSV를 먼저 업로드해주세요.", "warn")
            return

        # STEP 2: 웹사이트 탐색
        no_website = [b for b in buyers if not b.get("website")]
        yield make_log(f"🔍 STEP 2: 웹사이트 탐색 ({len(no_website)}개 대상)", "step")
        found_websites = 0
        EXCLUDE_DOMAINS = ["linkedin.com", "bloomberg.com", "crunchbase.com", "facebook.com",
                           "twitter.com", "instagram.com", "wikipedia.org", "yellowpages.com",
                           "dnb.com", "kompass.com", "zoominfo.com", "google.com", "anthropic.com"]
        for buyer in no_website:
            if should_stop and should_stop():
                yield make_log("⏹ Agent 중지됨", "warn")
                return
            company = buyer["company"]
            country = buyer.get("country") or ""
            yield make_log(f"  검색 중: {company}", "info")
            try:
                query = f'"{company}" "{country}" official website' if country and country != "Unknown" else f'"{company}" official website'
                response = await anthropic_client.messages.create(
                    model="claude-sonnet-4-20250514", max_tokens=500,
                    tools=[{"type": "web_search_20250305", "name": "web_search"}],
                    messages=[{"role": "user", "content":
                        f'Find the official homepage of the company "{company}" from {country}. '
                        f'Search query: {query}. '
                        f'Return ONLY the official homepage URL (e.g. https://www.example.com). '
                        f'Do NOT return LinkedIn, Bloomberg, Wikipedia or directory sites. '
                        f'If not found, return NOT_FOUND.'}]
                )
                website = None
                for block in response.content:
                    if hasattr(block, "text") and "NOT_FOUND" not in block.text:
                        urls = re.findall(r'https?://[^\s,\)\"\'<>\]]+', block.text)
                        for url in urls:
                            url = url.rstrip(".,)/")
                            domain = url.split("/")[2] if len(url.split("/")) > 2 else ""
                            if not any(ex in domain for ex in EXCLUDE_DOMAINS) and len(url) > 10:
                                website = url
                                break
                if website:
                    sb.table("buyers").update({"website": website}).eq("id", buyer["id"]).execute()
                    buyer["website"] = website
                    found_websites += 1
                    yield make_log(f"  ✓ {company} → {website}", "success")
                else:
                    yield make_log(f"  ✗ {company}: 미탐색", "warn")
            except Exception as e:
                yield make_log(f"  ✗ {company}: {str(e)}", "error")
            await asyncio.sleep(0.5)
        yield make_log(f"✅ STEP 2 완료: {found_websites}/{len(no_website)}개", "success")

        buyers = sb.table("buyers").select("*").eq("customer_id", customer_id).execute().data or []

        # STEP 3: Hunter.io 최대 3개 컨택 추출
        no_email = [b for b in buyers if not b.get("email")]
        yield make_log(f"📧 STEP 3: 연락처 추출 ({len(no_email)}개 대상, 최대 3명/바이어)", "step")
        found_emails = 0
        for buyer in no_email:
            yield make_log(f"  Hunter.io: {buyer['company']}", "info")
            result = enrich_buyer_contacts(buyer.get("website", ""), buyer.get("email", ""))

            update_data = {}
            c1 = result.get("contact1")
            c2 = result.get("contact2")
            c3 = result.get("contact3")

            if c1:
                if c1.get("contact_name"):  update_data["contact_name"]  = c1["contact_name"]
                if c1.get("contact_email"): update_data["email"]          = c1["contact_email"]
                if c1.get("contact_title"): update_data["position"]       = c1["contact_title"]
            if c2:
                if c2.get("contact_name"):  update_data["contact_name2"] = c2["contact_name"]
                if c2.get("contact_email"): update_data["email2"]        = c2["contact_email"]
                if c2.get("contact_title"): update_data["position2"]     = c2["contact_title"]
            if c3:
                if c3.get("contact_name"):  update_data["contact_name3"] = c3["contact_name"]
                if c3.get("contact_email"): update_data["email3"]        = c3["contact_email"]
                if c3.get("contact_title"): update_data["position3"]     = c3["contact_title"]

            if update_data:
                sb.table("buyers").update(update_data).eq("id", buyer["id"]).execute()
                found_emails += 1
                emails_found = [e for e in [
                    update_data.get("email"),
                    update_data.get("email2"),
                    update_data.get("email3")
                ] if e]
                yield make_log(f"  ✓ {buyer['company']} → {len(emails_found)}개 컨택", "success")
            else:
                yield make_log(f"  ✗ {buyer['company']}: 컨택 없음", "warn")
            await asyncio.sleep(0.3)
        yield make_log(f"✅ STEP 3 완료: {found_emails}/{len(no_email)}개", "success")

        buyers = sb.table("buyers").select("*").eq("customer_id", customer_id).execute().data or []

        # STEP 5: ABM 분석
        yield make_log(f"🧠 STEP 5: ABM 분석 ({len(buyers)}개)", "step")
        abm_analysis = []
        try:
            buyer_list = [{"id": b["id"], "company": b["company"], "country": b["country"],
                          "website": b.get("website"), "contact_email": b.get("email")} for b in buyers]
            prompt = f"""B2B ABM 분석가로서 아래 바이어들을 분석하세요.

고객사: {campaign_info.get('company_name')} | USP: {campaign_info.get('usp')}
제품: {campaign_info.get('product_description')} | 진출국: {campaign_info.get('target_country')}

바이어 목록:
{json.dumps(buyer_list, ensure_ascii=False)}

JSON 배열만 반환:
[{{"id":"buyer_id","priority":1,"matching_points":["포인트1"],"key_message_direction":"방향"}}]"""
            response = await anthropic_client.messages.create(
                model="claude-sonnet-4-20250514", max_tokens=4000,
                messages=[{"role": "user", "content": prompt}]
            )
            text = response.content[0].text.strip()
            m = re.search(r'\[.*\]', text, re.DOTALL)
            abm_analysis = json.loads(m.group() if m else text)
            sb.table("campaigns").update({"abm_analysis": abm_analysis, "status": "abm_done"}).eq("id", campaign_id).execute()
            yield make_log(f"✅ STEP 5 완료: {len(abm_analysis)}개 분석", "success")
        except Exception as e:
            yield make_log(f"⚠️ ABM 분석 오류: {str(e)}", "warn")
            abm_analysis = [{"id": b["id"], "priority": 2, "matching_points": [], "key_message_direction": ""} for b in buyers]

        # STEP 6: 이메일 템플릿 (contact1/2/3 각각 생성)
        yield make_log("✉️ STEP 6: 이메일 템플릿 생성 중...", "step")
        abm_map = {a["id"]: a for a in abm_analysis}
        templates = []
        for buyer in buyers:
            # 이메일 있는 컨택만 처리 (최대 3개)
            contacts_to_process = []
            if buyer.get("email"):
                contacts_to_process.append({"name": buyer.get("contact_name",""), "email": buyer["email"], "title": buyer.get("position","")})
            if buyer.get("email2"):
                contacts_to_process.append({"name": buyer.get("contact_name2",""), "email": buyer["email2"], "title": buyer.get("position2","")})
            if buyer.get("email3"):
                contacts_to_process.append({"name": buyer.get("contact_name3",""), "email": buyer["email3"], "title": buyer.get("position3","")})

            if not contacts_to_process:
                continue

            abm = abm_map.get(buyer["id"], {})

            for contact in contacts_to_process:
                salutation = f"Dear {contact['name']}," if contact['name'] else f"Dear {buyer['company']} Team,"
                prompt = f"""Generate B2B email templates. Return ONLY valid JSON.

Seller: {campaign_info.get('company_name')} | USP: {campaign_info.get('usp')}
Signature: {campaign_info.get('signature_name')} / {campaign_info.get('signature_title')} / {campaign_info.get('signature_phone')}
Buyer: {buyer['company']} ({buyer['country']}) | {salutation}
Priority: {abm.get('priority',2)} | Message: {abm.get('key_message_direction','')}

Return JSON:
{{"consignee_name":"{buyer['company']}","contact_email":"{contact['email']}","contact_name":"{contact['name']}","priority":{abm.get('priority',2)},
"r1_initial":{{"subject":"...","body":"<html>..."}},"r2_replied":{{"subject":"...","body":"<html>..."}},"r2_no_reply":{{"subject":"...","body":"<html>..."}},"r3_replied":{{"subject":"...","body":"<html>..."}},"r3_no_reply":{{"subject":"...","body":"<html>..."}}}}"""
                try:
                    response = await anthropic_client.messages.create(
                        model="claude-sonnet-4-20250514", max_tokens=4000,
                        messages=[{"role": "user", "content": prompt}]
                    )
                    text = response.content[0].text.strip()
                    m = re.search(r'\{.*\}', text, re.DOTALL)
                    if m:
                        templates.append(json.loads(m.group()))
                        yield make_log(f"  ✓ {buyer['company']} ({contact['email']}) 템플릿 생성", "success")
                except Exception as e:
                    yield make_log(f"  ✗ {buyer['company']}: {str(e)}", "error")
                await asyncio.sleep(1)

        sb.table("campaigns").update({"email_templates": templates, "status": "review_pending"}).eq("id", campaign_id).execute()
        yield make_log(f"✅ STEP 6 완료: {len(templates)}개 템플릿", "success")
        yield make_log("🎉 Agent 완료! 이메일 템플릿을 검토 후 발송해주세요.", "done")

    except Exception as e:
        yield make_log(f"❌ 오류: {str(e)}", "error")
        try:
            sb.table("campaigns").update({"status": "error"}).eq("id", campaign_id).execute()
        except Exception:
            pass


async def run_step_pipeline(campaign_id: str, step: str, should_stop=None):
    """단계별 실행 — website | hunter | abm | templates"""
    sb = get_supabase()
    try:
        camp = sb.table("campaigns").select("*, customers(*)").eq("id", campaign_id).single().execute()
        campaign = camp.data
        if not campaign:
            yield make_log("캠페인을 찾을 수 없습니다", "error")
            return

        campaign_info = campaign.get("campaign_info", {})
        customer_id = campaign["customer_id"]
        buyers = sb.table("buyers").select("*").eq("customer_id", customer_id).execute().data or []

        if not buyers:
            yield make_log("⚠️ 바이어가 없습니다. 먼저 바이어 리스트를 업로드해주세요.", "warn")
            return

        if step == "website":
            yield make_log(f"🔍 웹사이트 탐색 시작 ({len(buyers)}개 바이어)", "step")
            no_website = [b for b in buyers if not b.get("website")]
            found = 0
            EXCLUDE_DOMAINS = ["linkedin.com", "bloomberg.com", "crunchbase.com", "facebook.com",
                               "twitter.com", "instagram.com", "wikipedia.org", "yellowpages.com",
                               "dnb.com", "kompass.com", "zoominfo.com", "google.com", "anthropic.com"]
            for buyer in no_website:
                if should_stop and should_stop():
                    yield make_log("⏹ Agent 중지됨", "warn")
                    return
                company = buyer["company"]
                country = buyer.get("country") or ""
                yield make_log(f"  검색 중: {company}", "info")
                try:
                    query = f'"{company}" "{country}" official website' if country and country != "Unknown" else f'"{company}" official website'
                    response = await anthropic_client.messages.create(
                        model="claude-sonnet-4-20250514", max_tokens=500,
                        tools=[{"type": "web_search_20250305", "name": "web_search"}],
                        messages=[{"role": "user", "content":
                            f'Find the official homepage of the company "{company}" from {country}. '
                            f'Search query: {query}. '
                            f'Return ONLY the official homepage URL (e.g. https://www.example.com). '
                            f'Do NOT return LinkedIn, Bloomberg, Wikipedia or directory sites. '
                            f'If not found, return NOT_FOUND.'}]
                    )
                    website = None
                    for block in response.content:
                        if hasattr(block, "text") and "NOT_FOUND" not in block.text:
                            urls = re.findall(r'https?://[^\s,\)\"\'<>\]]+', block.text)
                            for url in urls:
                                url = url.rstrip(".,)/")
                                domain = url.split("/")[2] if len(url.split("/")) > 2 else ""
                                if not any(ex in domain for ex in EXCLUDE_DOMAINS) and len(url) > 10:
                                    website = url
                                    break
                    if website:
                        sb.table("buyers").update({"website": website}).eq("id", buyer["id"]).execute()
                        found += 1
                        yield make_log(f"  ✓ {company} → {website}", "success")
                    else:
                        yield make_log(f"  ✗ {company}: 미탐색", "warn")
                except Exception as e:
                    yield make_log(f"  ✗ {company}: {str(e)}", "error")
                await asyncio.sleep(0.5)
            yield make_log(f"✅ 웹사이트 탐색 완료: {found}/{len(no_website)}개", "done")

        elif step == "hunter":
            from services.hunter_service import enrich_buyer_contacts
            yield make_log(f"📧 연락처 추출 시작 ({len(buyers)}개 바이어)", "step")
            no_email = [b for b in buyers if not b.get("email")]
            found = 0
            for buyer in no_email:
                if should_stop and should_stop():
                    yield make_log("⏹ Agent 중지됨", "warn")
                    return
                yield make_log(f"  Hunter.io: {buyer['company']}", "info")
                result = enrich_buyer_contacts(buyer.get("website", ""), buyer.get("email", ""))
                update_data = {}
                for idx, key in enumerate(["contact1", "contact2", "contact3"], 1):
                    c = result.get(key)
                    if c:
                        suffix = "" if idx == 1 else str(idx)
                        if c.get("contact_name"):  update_data[f"contact_name{suffix}"] = c["contact_name"]
                        if c.get("contact_email"): update_data[f"email{suffix}" if suffix else "email"] = c["contact_email"]
                        if c.get("contact_title"): update_data[f"position{suffix}"] = c["contact_title"]
                if update_data:
                    sb.table("buyers").update(update_data).eq("id", buyer["id"]).execute()
                    found += 1
                    yield make_log(f"  ✓ {buyer['company']}: {len([k for k in update_data if 'email' in k])}개 컨택", "success")
                else:
                    yield make_log(f"  ✗ {buyer['company']}: 컨택 없음", "warn")
                await asyncio.sleep(0.3)
            yield make_log(f"✅ 연락처 추출 완료: {found}/{len(no_email)}개", "done")

        elif step == "abm":
            yield make_log(f"🧠 ABM 분석 시작 ({len(buyers)}개 바이어)", "step")
            buyer_list = [{"id": b["id"], "company": b["company"], "country": b["country"],
                          "website": b.get("website"), "contact_email": b.get("email")} for b in buyers]
            prompt = f"""B2B ABM 분석가로서 분석해주세요.
고객사: {campaign_info.get('company_name')} | USP: {campaign_info.get('usp')}
제품: {campaign_info.get('product_description')} | 진출국: {campaign_info.get('target_country')}
바이어: {json.dumps(buyer_list, ensure_ascii=False)}
JSON 배열만 반환: [{{"id":"...","priority":1,"matching_points":["..."],"key_message_direction":"..."}}]"""
            try:
                response = await anthropic_client.messages.create(
                    model="claude-sonnet-4-20250514", max_tokens=4000,
                    messages=[{"role": "user", "content": prompt}]
                )
                text = response.content[0].text.strip()
                m = re.search(r'\[.*\]', text, re.DOTALL)
                abm = json.loads(m.group() if m else text)
                sb.table("campaigns").update({"abm_analysis": abm, "status": "abm_done"}).eq("id", campaign_id).execute()
                yield make_log(f"✅ ABM 분석 완료: {len(abm)}개", "done")
            except Exception as e:
                yield make_log(f"❌ ABM 오류: {str(e)}", "error")

        elif step == "templates":
            abm_analysis = campaign.get("abm_analysis") or []
            abm_map = {a["id"]: a for a in abm_analysis}
            templates = []
            yield make_log(f"✉️ 이메일 템플릿 생성 시작", "step")
            for buyer in buyers:
                if should_stop and should_stop():
                    yield make_log("⏹ Agent 중지됨", "warn")
                    sb.table("campaigns").update({"email_templates": templates, "status": "review_pending"}).eq("id", campaign_id).execute()
                    return
                contacts = []
                if buyer.get("email"):   contacts.append({"name": buyer.get("contact_name",""), "email": buyer["email"]})
                if buyer.get("email2"):  contacts.append({"name": buyer.get("contact_name2",""), "email": buyer["email2"]})
                if buyer.get("email3"):  contacts.append({"name": buyer.get("contact_name3",""), "email": buyer["email3"]})
                if not contacts: continue
                abm = abm_map.get(buyer["id"], {})
                for contact in contacts:
                    salutation = f"Dear {contact['name']}," if contact['name'] else f"Dear {buyer['company']} Team,"
                    prompt = f"""Generate B2B email templates. Return ONLY valid JSON.
Seller: {campaign_info.get('company_name')} | USP: {campaign_info.get('usp')}
Signature: {campaign_info.get('signature_name')} / {campaign_info.get('signature_title')} / {campaign_info.get('signature_phone')}
Buyer: {buyer['company']} ({buyer['country']}) | {salutation} | Priority: {abm.get('priority',2)}
JSON: {{"consignee_name":"{buyer['company']}","contact_email":"{contact['email']}","priority":{abm.get('priority',2)},"r1_initial":{{"subject":"...","body":"<html>..."}},"r2_replied":{{"subject":"...","body":"<html>..."}},"r2_no_reply":{{"subject":"...","body":"<html>..."}},"r3_replied":{{"subject":"...","body":"<html>..."}},"r3_no_reply":{{"subject":"...","body":"<html>..."}}}}"""
                    try:
                        response = await anthropic_client.messages.create(
                            model="claude-sonnet-4-20250514", max_tokens=4000,
                            messages=[{"role": "user", "content": prompt}]
                        )
                        text = response.content[0].text.strip()
                        m = re.search(r'\{.*\}', text, re.DOTALL)
                        if m:
                            templates.append(json.loads(m.group()))
                            yield make_log(f"  ✓ {buyer['company']} ({contact['email']})", "success")
                    except Exception as e:
                        yield make_log(f"  ✗ {buyer['company']}: {str(e)}", "error")
                    await asyncio.sleep(1)
            sb.table("campaigns").update({"email_templates": templates, "status": "review_pending"}).eq("id", campaign_id).execute()
            yield make_log(f"✅ 템플릿 생성 완료: {len(templates)}개", "done")
        else:
            yield make_log(f"알 수 없는 단계: {step}", "error")

    except Exception as e:
        yield make_log(f"❌ 오류: {str(e)}", "error")
