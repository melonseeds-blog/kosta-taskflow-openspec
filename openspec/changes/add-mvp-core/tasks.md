## 1. 프로젝트 초기 설정

- [ ] 1.1 디렉토리 구조 생성: `backend/`, `frontend/public/`, `frontend/static/`
- [ ] 1.2 `backend/requirements.txt` 작성: fastapi, uvicorn, sqlalchemy, alembic, python-jose[cryptography], bcrypt, python-dotenv, psycopg2-binary
- [ ] 1.3 `backend/.env.example` 작성: DATABASE_URL, SECRET_KEY, CORS_ORIGINS
- [ ] 1.4 FastAPI 앱 기본 뼈대 생성: `backend/main.py` (StaticFiles 마운트, 라우터 등록)
- [ ] 1.5 `vercel.json` 작성: FastAPI Serverless Functions 라우팅 + 정적 파일 서빙

## 2. DB 모델 및 마이그레이션

- [ ] 2.1 SQLAlchemy Base + DATABASE_URL 설정 (`backend/database.py`)
- [ ] 2.2 `users` 모델 정의: id, email(UNIQUE), password_hash, team_id(FK→teams, NULL), created_at
- [ ] 2.3 `teams` 모델 정의: id, name, invite_code(UNIQUE), owner_id(FK→users), created_at
- [ ] 2.4 `tasks` 모델 정의: id, team_id(FK), title, status(TODO/DOING/DONE), creator_id(FK), assignee_id(FK, NULL), created_at
- [ ] 2.5 `messages` 모델 정의: id, team_id(FK), user_id(FK), content, created_at
- [ ] 2.6 인덱스 추가: tasks(team_id, created_at), messages(team_id, created_at), teams(invite_code), users(team_id)
- [ ] 2.7 Alembic 초기화 + 첫 마이그레이션 생성 및 적용

## 3. 공통 미들웨어 및 유틸

- [ ] 3.1 JWT 발급/검증 유틸 작성: `create_token(user_id)`, `decode_token(token)` (24h 만료)
- [ ] 3.2 bcrypt 비밀번호 해시/검증 유틸 작성
- [ ] 3.3 FastAPI Dependency: `get_current_user` — Authorization 헤더 검증 → 401
- [ ] 3.4 FastAPI Dependency: `require_team_member(team_id)` — user.team_id 일치 검증 → 403
- [ ] 3.5 에러 응답 헬퍼: `error_response(code, message, status_code, **meta)` → `{ error: { code, message } }`
- [ ] 3.6 CORS 미들웨어 설정: 환경변수 CORS_ORIGINS 기반 동적 허용

## 4. Auth API

- [ ] 4.1 `POST /api/auth/signup`: 이메일 형식 + 8자 이상 검증, 중복 체크(409), bcrypt 해시, users INSERT, JWT 반환(201)
- [ ] 4.2 `POST /api/auth/login`: 이메일 조회, bcrypt 검증, 실패 시 동일 메시지(401), JWT 반환(200) + team_id 포함
- [ ] 4.3 `POST /api/auth/logout`: 200 + `{}` 반환 (stateless)
- [ ] 4.4 `GET /api/auth/me`: 현재 사용자 id, email, team_id 반환

## 5. Team API

- [ ] 5.1 `POST /api/teams`: 이름 1–30자 검증, 이미 팀 소속 시 409, invite_code 자동 생성(`[A-Z]{4}-[0-9]{4}`), teams INSERT + users.team_id UPDATE
- [ ] 5.2 `POST /api/teams/join`: 초대코드 형식 검증(400), 존재 확인(404), 이미 소속 시 409, users.team_id UPDATE
- [ ] 5.3 `GET /api/teams/{id}`: require_team_member 적용, 팀 정보 반환
- [ ] 5.4 `GET /api/teams/{id}/members`: require_team_member 적용, 멤버 목록(id, email, is_owner, joined_at) 반환

## 6. Task API

- [ ] 6.1 `GET /api/teams/{id}/tasks`: require_team_member 적용, filter 쿼리파라미터(me/unassigned) 처리, created_at DESC 정렬
- [ ] 6.2 `POST /api/teams/{id}/tasks`: 제목 1–100자 검증, tasks INSERT (status=TODO, creator_id=me)
- [ ] 6.3 `GET /api/tasks/{id}`: 해당 팀 멤버인지 검증 후 태스크 반환
- [ ] 6.4 `PATCH /api/tasks/{id}/status`: status 값 검증(TODO/DOING/DONE), tasks UPDATE
- [ ] 6.5 `PUT /api/tasks/{id}`: title, assignee_id 수정 (부분 업데이트 허용)
- [ ] 6.6 `DELETE /api/tasks/{id}`: creator_id = me OR team owner 검증 → 아니면 403, tasks DELETE

## 7. Chat API

- [ ] 7.1 `GET /api/teams/{id}/messages`: require_team_member 적용, since= 쿼리파라미터 처리, 최대 50건 반환
- [ ] 7.2 `POST /api/teams/{id}/messages`: 1–1000자 검증, messages INSERT, 201 반환
- [ ] 7.3 `DELETE /api/messages/{id}`: messages.user_id = me 검증 → 아니면 403(NOT_OWNER), messages DELETE

## 8. 프론트엔드 기반 설정

- [ ] 8.1 `frontend/public/login.html` 기본 구조 생성 (Tailwind CDN 스크립트 포함)
- [ ] 8.2 `frontend/public/team.html` 기본 구조 생성
- [ ] 8.3 `frontend/public/app.html` 기본 구조 생성 (칸반/채팅/멤버 탭 포함)
- [ ] 8.4 `frontend/public/error.html` 기본 구조 생성 (403/401 에러 표시)
- [ ] 8.5 `frontend/static/api.js` 작성: fetch 래퍼, JWT 헤더 자동 첨부, 401 캐치 → localStorage 삭제 + /login redirect
- [ ] 8.6 `frontend/static/auth.js` 작성: localStorage token 저장/읽기/삭제, team_id 확인 + 라우팅 가드

## 9. 로그인 / 회원가입 화면

- [ ] 9.1 login.html: 로그인 폼 UI (이메일, 비밀번호, 로그인 버튼, 회원가입 링크)
- [ ] 9.2 login.html: 회원가입 폼 UI (이메일, 비밀번호, 가입하기 버튼, 로그인 링크)
- [ ] 9.3 login.html: 탭 전환 로직 (로그인 ↔ 회원가입)
- [ ] 9.4 login.html: 클라이언트 validation (이메일 형식, 8자 이상)
- [ ] 9.5 login.html: POST /auth/signup 호출 → 201 시 team_id 분기 (null→team, else→app)
- [ ] 9.6 login.html: POST /auth/login 호출 → 200 시 team_id 분기
- [ ] 9.7 login.html: 에러 메시지 인라인 표시 (각 필드 하단 + 서버 에러 배너)
- [ ] 9.8 login.html: 처리 중 상태 (버튼 비활성화 + "처리 중..." 텍스트)

## 10. 팀 선택 화면

- [ ] 10.1 team.html: "팀 만들기" 폼 UI (팀 이름 입력, 만들기 버튼)
- [ ] 10.2 team.html: "초대코드 합류" 폼 UI (코드 입력, 합류 버튼, 형식 안내)
- [ ] 10.3 team.html: POST /teams 호출 → 201 시 초대코드 표시 + 복사 버튼 + "칸반 시작하기" 버튼
- [ ] 10.4 team.html: POST /teams/join 호출 → 200 시 팀 미리보기 표시 + "이 팀에 합류" 버튼
- [ ] 10.5 team.html: 각 에러 케이스 인라인 표시 (400 형식오류, 404 미존재, 409 중복)
- [ ] 10.6 team.html: 진입 시 team_id 검사 — 이미 팀 있으면 /app으로 redirect

## 11. 칸반 화면

- [ ] 11.1 app.html: 헤더 (팀명, 칸반/채팅/멤버 탭, 로그아웃)
- [ ] 11.2 app.html: 3컬럼 칸반 레이아웃 (TODO/DOING/DONE, 색상 구분)
- [ ] 11.3 app.html: GET /teams/{id}/tasks 호출 → 카드 렌더링 (제목, #id, @assignee)
- [ ] 11.4 app.html: 필터 버튼 (전체/@me/미할당) → API 호출 + 재렌더링
- [ ] 11.5 app.html: 컬럼 + 버튼 클릭 → 인라인 입력 폼 (제목, 담당자 드롭다운, Enter 저장, Esc 취소)
- [ ] 11.6 app.html: POST /teams/{id}/tasks 호출 → 201 시 카드 즉시 추가
- [ ] 11.7 app.html: HTML5 Drag API — dragstart, dragover, drop 이벤트 처리
- [ ] 11.8 app.html: drop 시 PATCH /tasks/{id}/status 호출 → 성공 시 카드 이동 확정
- [ ] 11.9 app.html: 카드 클릭 → 상세/수정 모달 (상태 버튼, 담당자 변경, 저장, 삭제)
- [ ] 11.10 app.html: PUT /tasks/{id} 호출 (제목/assignee 수정)
- [ ] 11.11 app.html: 삭제 확인 다이얼로그 → DELETE /tasks/{id} 호출
- [ ] 11.12 app.html: 권한에 따른 삭제 버튼 표시/숨김 (creator 또는 owner만)
- [ ] 11.13 app.html: empty state (태스크 0건 시 각 컬럼 안내 메시지, TODO만 CTA 강조)

## 12. 채팅 화면

- [ ] 12.1 app.html: 채팅 탭 레이아웃 (메시지 목록, 입력창, 전송 버튼)
- [ ] 12.2 app.html: GET /teams/{id}/messages 최초 조회 → 말풍선 렌더링 (좌/우 구분)
- [ ] 12.3 app.html: setInterval 5초 폴링 — since= 파라미터로 증분 조회
- [ ] 12.4 app.html: POST /teams/{id}/messages 전송 → 201 시 즉시 하단에 추가
- [ ] 12.5 app.html: 글자수 카운터 (실시간, 1000자 초과 시 적색 + 전송 비활성화)
- [ ] 12.6 app.html: 본인 메시지 호버 시 삭제 아이콘 표시 → DELETE /messages/{id}
- [ ] 12.7 app.html: 폴링 실패 시 헤더 상태 표시 + exponential backoff 재시도 로직
- [ ] 12.8 app.html: empty state (메시지 0건 시 "아직 대화가 없습니다" 표시)

## 13. 멤버 목록 패널

- [ ] 13.1 app.html: 멤버 탭 → GET /teams/{id}/members 호출 → 멤버 목록 렌더링 (이메일, owner 표시)

## 14. 모바일 반응형

- [ ] 14.1 app.html: Tailwind breakpoint — md(768px) 이하에서 칸반 1컬럼 스와이프 모드
- [ ] 14.2 app.html: 상단 TODO/DOING/DONE 인디케이터 탭 + 좌우 스와이프 이벤트
- [ ] 14.3 app.html: 모바일 카드 길게 누르기(longpress) → 상태 변경 메뉴 팝업
- [ ] 14.4 app.html: 햄버거 메뉴 구현 (md 이하에서 헤더 탭 숨김 + 슬라이드 사이드 패널)
- [ ] 14.5 app.html: 채팅 키보드 활성화 시 visualViewport API로 메시지 영역 자동 축소

## 15. 에러 화면 및 공통 처리

- [ ] 15.1 error.html: 403 에러 화면 ("이 팀에 접근할 권한이 없습니다" + "내 팀으로 돌아가기" 버튼)
- [ ] 15.2 api.js: 401 TOKEN_EXPIRED 전역 처리 → 토스트 표시 + localStorage 삭제 + /login redirect
- [ ] 15.3 모든 화면: 진입 시 localStorage token 검사 — 없으면 /login redirect

## 16. 배포 설정

- [ ] 16.1 Vercel 프로젝트 생성 + GitHub 저장소 연결
- [ ] 16.2 Neon Marketplace 연동 → DATABASE_URL Vercel 환경변수 자동 등록 확인
- [ ] 16.3 Vercel 환경변수 수동 추가: SECRET_KEY, CORS_ORIGINS
- [ ] 16.4 `vercel.json` 최종 검증: API 라우트 → Serverless Function, 정적 파일 → public/
- [ ] 16.5 Alembic 마이그레이션 Neon DB에 적용 (배포 전 1회)
- [ ] 16.6 main push → Vercel 자동 배포 확인. taskflow.vercel.app 전체 기능 수동 점검
