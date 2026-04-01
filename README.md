# BuyerOS — 시작 가이드

## 전체 구조

```
buyeros/
├── backend/          ← FastAPI 서버 (Python)
├── frontend/         ← Next.js 웹앱
└── supabase_schema.sql  ← DB 스키마
```

---

## 1단계: Supabase 새 회사 계정 설정

1. [supabase.com](https://supabase.com)에서 새 조직 + 새 프로젝트 생성
2. `Settings > API`에서 URL과 키 복사
3. `SQL Editor`에서 `supabase_schema.sql` 전체 붙여넣고 실행
4. `Authentication > Providers > Email` 활성화
5. 팀원 초대: `Authentication > Users > Invite User`

---

## 2단계: 백엔드 실행

```bash
cd backend

# .env 파일 생성
cp .env.example .env
# → .env 파일 열어서 모든 키 입력

# 기존 credentials.json, token.json 복사
cp /기존경로/credentials.json .
cp /기존경로/token.json .

# 패키지 설치
pip install -r requirements.txt

# 서버 실행
uvicorn main:app --reload --port 8000
```

서버 확인: http://localhost:8000

---

## 3단계: 프론트엔드 실행

```bash
cd frontend

# .env.local 파일 생성
cp .env.example .env.local
# → Supabase URL/Key, API URL 입력

# 패키지 설치
npm install

# 개발 서버 실행
npm run dev
```

브라우저에서 http://localhost:3000 열기

---

## 4단계: 팀원 사용 방법

### 워크플로우
```
1. Volza에서 CSV 다운로드 (기존대로)
2. BuyerOS 접속 → "새 캠페인 시작"
3. 고객사 정보 입력 + CSV 업로드
4. "바이어 분석 시작" 버튼 클릭
   → 실시간으로 진행상황 확인
   → 웹사이트 탐색 → Hunter.io 이메일 추출 → ABM 분석 → 이메일 템플릿 생성
5. CTA 링크 입력 (샘플/캘린더/카탈로그)
6. 이메일 템플릿 검토 후 "1차 발송" 클릭
7. 컨택 로그 페이지에서 회신 여부 Y/N 입력
8. 2차/3차 발송 진행
9. 엑셀 다운로드로 기존 양식 Export
```

---

## 5단계: 배포 (팀 전체 사용)

### 백엔드 — 회사 PC 또는 서버에 상시 실행
```bash
# PM2로 백그라운드 실행 (Node.js 설치 필요)
npm install -g pm2
pm2 start "uvicorn main:app --port 8000" --name buyeros-api
pm2 save
```

### 프론트엔드 — Vercel 배포
```bash
cd frontend
npm install -g vercel
vercel
# → 환경변수 설정:
#   NEXT_PUBLIC_SUPABASE_URL
#   NEXT_PUBLIC_SUPABASE_ANON_KEY
#   NEXT_PUBLIC_API_URL (백엔드 IP:8000)
```

---

## API Key 정리

| 서비스 | 용도 | 위치 |
|--------|------|------|
| Supabase URL/Key | DB | .env |
| Anthropic API Key | 웹검색 + ABM 분석 + 이메일 생성 | .env |
| Hunter.io API Key | 이메일 추출 | .env |
| Gmail credentials.json | Gmail 발송 OAuth | backend/ 폴더에 파일로 |
| Gmail token.json | Gmail 발송 토큰 | backend/ 폴더에 파일로 |
