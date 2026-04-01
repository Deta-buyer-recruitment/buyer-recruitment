"""
Gmail API 발송 서비스 — 기존 gmail_client.py 로직 이식
개인 Gmail OAuth (credentials.json / token.json) 재사용
"""
import os
import base64
import time
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from pathlib import Path
from datetime import datetime

GMAIL_SENDER_EMAIL = os.getenv("GMAIL_SENDER_EMAIL", "")
GMAIL_CREDENTIALS_PATH = os.getenv("GMAIL_CREDENTIALS_PATH", "./credentials.json")
GMAIL_TOKEN_PATH = os.getenv("GMAIL_TOKEN_PATH", "./token.json")
SCOPES = ["https://www.googleapis.com/auth/gmail.send"]


def get_gmail_service():
    """Gmail API 서비스 — 기존 token.json 재사용"""
    from google.oauth2.credentials import Credentials
    from google_auth_oauthlib.flow import InstalledAppFlow
    from google.auth.transport.requests import Request
    from googleapiclient.discovery import build

    creds = None
    token_path = Path(GMAIL_TOKEN_PATH)

    if token_path.exists():
        creds = Credentials.from_authorized_user_file(str(token_path), SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not Path(GMAIL_CREDENTIALS_PATH).exists():
                raise FileNotFoundError(
                    f"credentials.json 없음: {GMAIL_CREDENTIALS_PATH}\n"
                    "백엔드 서버 디렉토리에 credentials.json을 복사해주세요."
                )
            flow = InstalledAppFlow.from_client_secrets_file(GMAIL_CREDENTIALS_PATH, SCOPES)
            creds = flow.run_local_server(port=0)

        with open(token_path, "w") as f:
            f.write(creds.to_json())

    return build("gmail", "v1", credentials=creds)


def send_single_email(
    service, sender_display: str, to_email: str, subject: str, body: str
) -> dict:
    """단건 발송 (지수 백오프 재시도 포함)"""
    msg = MIMEMultipart("alternative")
    msg["From"] = f"{sender_display} <{GMAIL_SENDER_EMAIL}>"
    msg["To"] = to_email
    msg["Subject"] = subject

    # HTML 감지
    if body.strip().startswith("<"):
        msg.attach(MIMEText(body, "html", "utf-8"))
    else:
        msg.attach(MIMEText(body, "plain", "utf-8"))

    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()

    for attempt in range(3):
        try:
            result = service.users().messages().send(
                userId="me", body={"raw": raw}
            ).execute()
            return {"success": True, "message_id": result.get("id")}
        except Exception as e:
            err_str = str(e)
            if "429" in err_str:
                wait = 2 ** attempt
                time.sleep(wait)
                continue
            elif "403" in err_str:
                return {
                    "success": False,
                    "error": "403 Forbidden",
                    "escalation_required": True,
                    "message": f"Gmail 일일 한도 초과 또는 계정 잠금. {GMAIL_SENDER_EMAIL} 확인 필요",
                }
            else:
                return {"success": False, "error": str(e)}

    return {"success": False, "error": "최대 재시도 횟수 초과"}


def send_campaign_round(
    templates: list[dict],
    round_key: str,
    sender_display: str,
) -> dict:
    """
    캠페인 라운드 일괄 발송
    templates: step6_email_templates 구조의 바이어 리스트
    round_key: r1_initial | r2_replied | r2_no_reply | r3_replied | r3_no_reply
    """
    try:
        service = get_gmail_service()
    except FileNotFoundError as e:
        return {"success": False, "error": str(e)}
    except Exception as e:
        return {"success": False, "error": f"Gmail 인증 실패: {e}"}

    sent = []
    success_count = 0
    fail_count = 0

    for tmpl in templates:
        name = tmpl.get("consignee_name", "")
        email = tmpl.get("contact_email", "")

        if not email:
            continue

        round_tmpl = tmpl.get(round_key, {})
        if not round_tmpl:
            continue

        subject = round_tmpl.get("subject", "")
        body = round_tmpl.get("body", "")

        # 미치환 placeholder 감지
        if "{{cta_link" in body or "{{calendar_link" in body:
            return {
                "success": False,
                "error": "미치환 CTA 링크가 있습니다. 링크를 먼저 입력해주세요.",
                "escalation_required": True,
                "buyer": name,
            }

        result = send_single_email(service, sender_display, email, subject, body)

        if result.get("escalation_required"):
            return {
                "success": False,
                "error": result.get("message", ""),
                "escalation_required": True,
                "sent_so_far": sent,
            }

        status = "success" if result["success"] else "failed"
        sent.append({
            "consignee_name": name,
            "contact_email": email,
            "send_status": status,
            "error": result.get("error") if not result["success"] else None,
            "sent_at": datetime.now().isoformat(),
        })

        if result["success"]:
            success_count += 1
        else:
            fail_count += 1

    return {
        "success": True,
        "sent": sent,
        "success_count": success_count,
        "fail_count": fail_count,
        "send_datetime": datetime.now().strftime("%Y-%m-%d %H:%M"),
    }


def check_gmail_auth() -> dict:
    """Gmail 인증 상태 확인"""
    try:
        service = get_gmail_service()
        profile = service.users().getProfile(userId="me").execute()
        return {
            "authenticated": True,
            "email": profile.get("emailAddress", ""),
        }
    except FileNotFoundError:
        return {"authenticated": False, "error": "credentials.json 없음"}
    except Exception as e:
        return {"authenticated": False, "error": str(e)}
