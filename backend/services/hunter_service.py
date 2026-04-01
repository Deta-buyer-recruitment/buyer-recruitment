"""
Hunter.io Domain Search — 최대 3개 컨택 추출
"""
import os
import time
from urllib.parse import urlparse
import httpx

HUNTER_API_KEY = os.getenv("HUNTER_API_KEY", "")
HUNTER_BASE_URL = "https://api.hunter.io/v2"

DECISION_MAKER_KEYWORDS = [
    "purchasing", "procurement", "import", "sourcing",
    "buying", "supply chain", "category manager",
]
FALLBACK_TITLE_KEYWORDS = [
    "sales", "managing director", "general manager",
    "ceo", "founder", "owner",
]


def extract_domain(url: str) -> str:
    if not url:
        return ""
    url = url.strip()
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    try:
        parsed = urlparse(url)
        domain = parsed.netloc or parsed.path
        return domain.replace("www.", "").strip("/")
    except Exception:
        return url.replace("https://", "").replace("http://", "").replace("www.", "").split("/")[0]


def score_contact(email_data: dict) -> int:
    title = (email_data.get("position") or "").lower()
    score = 0
    for i, kw in enumerate(DECISION_MAKER_KEYWORDS):
        if kw in title:
            score = 100 - i * 10
            break
    if score == 0:
        for i, kw in enumerate(FALLBACK_TITLE_KEYWORDS):
            if kw in title:
                score = 20 - i * 2
                break
    confidence = email_data.get("confidence", 0) or 0
    score += confidence // 10
    return score


def hunter_domain_search_top3(domain: str) -> list[dict]:
    """Hunter.io Domain Search — 상위 3명 추출"""
    if not HUNTER_API_KEY:
        return []
    try:
        resp = httpx.get(
            f"{HUNTER_BASE_URL}/domain-search",
            params={"domain": domain, "api_key": HUNTER_API_KEY, "limit": 10},
            timeout=15,
        )
        if resp.status_code == 200:
            data = resp.json().get("data", {})
            emails = data.get("emails", [])
            if not emails:
                return []
            # 점수 기준 정렬 후 상위 3개
            sorted_emails = sorted(emails, key=score_contact, reverse=True)[:3]
            results = []
            for best in sorted_emails:
                first = (best.get("first_name") or "").strip()
                last  = (best.get("last_name")  or "").strip()
                results.append({
                    "success":        True,
                    "contact_name":   f"{first} {last}".strip(),
                    "contact_email":  best.get("value", ""),
                    "contact_title":  best.get("position", ""),
                    "contact_source": "hunter.io",
                })
            return results
        elif resp.status_code == 429:
            time.sleep(5)
            return hunter_domain_search_top3(domain)
        else:
            return []
    except Exception:
        return []


def enrich_buyer_contacts(website: str, existing_email: str = "") -> dict:
    """
    바이어 1개 도메인에서 최대 3개 컨택 추출
    반환값: {
        contact1: {name, email, title},
        contact2: {name, email, title} or None,
        contact3: {name, email, title} or None,
        source: "hunter.io" | "generic" | "no_website"
    }
    """
    if not website:
        return {"contact1": None, "contact2": None, "contact3": None, "source": "no_website"}

    domain = extract_domain(website)
    contacts = hunter_domain_search_top3(domain)

    if contacts:
        return {
            "contact1": contacts[0] if len(contacts) > 0 else None,
            "contact2": contacts[1] if len(contacts) > 1 else None,
            "contact3": contacts[2] if len(contacts) > 2 else None,
            "source": "hunter.io",
        }

    # Generic fallback — 이메일만 1개
    generic_email = f"info@{domain}"
    if existing_email:
        return {"contact1": None, "contact2": None, "contact3": None, "source": "existing"}

    return {
        "contact1": {
            "contact_name":  "",
            "contact_email": generic_email,
            "contact_title": "",
            "contact_source": "generic",
        },
        "contact2": None,
        "contact3": None,
        "source": "generic",
    }


# 기존 호환성 유지
def enrich_buyer_contact(website: str, existing_email: str = "") -> dict:
    """단일 컨택 추출 (하위 호환용)"""
    if existing_email:
        return {"skip": True, "reason": "이미 이메일 있음"}
    result = enrich_buyer_contacts(website, existing_email)
    c1 = result.get("contact1")
    if c1:
        return {"success": True, **c1}
    if result["source"] == "no_website":
        return {"success": False, "error": "웹사이트 없음", "contact_source": "no_website"}
    return {"success": False, "error": "컨택 없음"}
