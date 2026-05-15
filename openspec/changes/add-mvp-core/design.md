## Context

TaskFlow MVP는 신규 프로젝트로, 기존 코드베이스가 없다. 소규모 팀(3–5인)이 칸반 + 채팅을 한 화면에서 사용하는 것이 목표다. 스택 선택은 학습 목적(Vanilla JS)과 실전 배포(Vercel + Neon) 두 가지를 동시에 만족해야 한다.

**현재 상태**: 빈 디렉토리. 프로그램정의 + 스토리보드 PDF가 유일한 스펙 근거.

**제약**:
- DB 4테이블 이내 (users, teams, tasks, messages)
- API 17개 이내 (Auth 4 + Team 4 + Task 6 + Chat 3)
- Vercel 무료 티어 한도 내
- 범위 외: WebSocket, 파일 첨부, 검색, 테스트 자동화, 다국어

## Goals / Non-Goals

**Goals:**
- FastAPI + Vanilla JS + Tailwind CDN으로 전체 스택 구현
- 로컬 SQLite / 운영 Neon 이중 환경 DATABASE_URL 하나로 전환
- MPA 4개 화면(login, team, app, error)으로 UI 구성
- Vercel 자동 배포 + Neon 연동 파이프라인

**Non-Goals:**
- WebSocket 실시간 (5초 폴링으로 대체)
- JWT 갱신 토큰 (24h 만료 후 재로그인)
- 팀 탈퇴 UI (`DELETE /teams/{id}/leave` API 포함하지 않음)
- 자동화 테스트 (수동 동작 확인만)
- 이메일 인증

## Decisions

### D1. 프론트엔드 구조: MPA (4개 HTML 파일)

**결정**: SPA 라우터 없이 HTML 파일 4개로 구성.

```
login.html   → 로그인 + 회원가입
team.html    → 팀 선택/생성/합류
app.html     → 칸반 + 채팅 + 멤버 (탭 전환)
error.html   → 403/401 에러 표시
```

**이유**: Vanilla JS로 SPA 라우터를 직접 구현하면 복잡도 증가. 탭 전환(칸반↔채팅↔멤버)은 같은 페이지 내 DOM 조작으로 충분. **대안**: SPA + history API — 불필요한 추가 구현.

### D2. Tailwind CSS: CDN v3 (Play CDN)

**결정**: 빌드 없이 Tailwind Play CDN 스크립트 태그 한 줄.

**이유**: 빌드 툴(npm, postcss) 없이 즉시 사용 가능. MVP 규모에서 번들 크기 최적화 불필요. **대안**: npm + tailwindcss CLI — 설정 파일, 빌드 스크립트 추가 필요로 범위 외.

### D3. 로컬 개발: FastAPI 일체형 (StaticFiles)

**결정**: FastAPI가 정적 파일(HTML/JS/CSS)도 서빙. 포트 하나(`localhost:8000`)로 모두 접근.

```
localhost:8000/              → login.html (기본)
localhost:8000/team          → team.html
localhost:8000/app           → app.html
localhost:8000/api/auth/     → FastAPI 라우터
```

**이유**: 개발 시 CORS 설정 불필요. 로컬과 운영 API 경로 동일 유지. **대안**: 프론트/백 포트 분리 — CORS 설정 추가, live-server 별도 실행.

### D4. ORM: SQLAlchemy (sync) + Alembic

**결정**: SQLAlchemy Core/ORM으로 모델 정의, Alembic으로 마이그레이션.

**이유**: SQLite ↔ PostgreSQL 전환이 DATABASE_URL 변경만으로 가능. **대안**: Tortoise ORM — async 지원이 좋지만 학습 진입장벽 높음.

### D5. 인증: JWT (python-jose) + bcrypt

**결정**: `Authorization: Bearer {token}` 헤더, localStorage 저장, 24h 만료, 갱신 토큰 없음.

**이유**: stateless → 서버 세션 불필요. 갱신 토큰은 Day 2 범위 외로 명시됨. 로그아웃은 클라이언트 토큰 삭제만(서버 블랙리스트 없음).

### D6. API 권한 미들웨어 전략

```
모든 요청 → JWT 검증 → 401 (만료/없음)
/teams/{id}/* → team_id 멤버십 검증 → 403 (비멤버)
DELETE /tasks/{id} → creator_id OR owner_id → 403
DELETE /messages/{id} → user_id 본인만 → 403
```

FastAPI Dependency로 재사용 가능한 `get_current_user`, `require_team_member` 구현.

### D7. 채팅 폴링: since= 증분 방식

```
최초 진입: GET /teams/{id}/messages            → 최근 50개
5초 후:    GET /teams/{id}/messages?since=<ts> → 새 메시지만
```

`messages.created_at` 인덱스로 O(log n) 조회. 네트워크 끊김 시 exponential backoff(5s → 60s 상한).

## Risks / Trade-offs

- **SQLite 동시성** → 로컬 개발 전용, 운영은 Neon PostgreSQL. 로컬에서 다중 탭 동시 쓰기 시 락 발생 가능하나 MVP 범위 내 허용.
- **JWT localStorage 저장** → XSS 취약. MVP 스코프에서 httpOnly 쿠키 대신 localStorage로 단순화. 운영 서비스 전환 시 쿠키로 전환 필요.
- **5초 폴링 부하** → 동시 사용자 50명 × 5초 폴링 = 초당 10req. Vercel Serverless 무료 티어(100GB-hr) 내 수용 가능.
- **Vercel Serverless + FastAPI 콜드 스타트** → 첫 요청 지연 가능(~1–2초). 이후 warm 상태에서 100ms 이내 목표.
- **MPA 화면 전환** → 페이지 이동 시 깜빡임. 탭 전환(칸반↔채팅)은 DOM 조작이므로 문제 없음. 로그인→팀선택→앱 전환에서 순간 흰 화면 허용.
