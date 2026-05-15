## Why

소규모 팀(3–5인)이 칸반과 채팅을 한 화면에서 함께 사용할 수 있는 MVP가 없다. 팀 리더는 진행 상황을 한눈에 파악하고, 팀원은 드래그로 태스크를 이동하며, 신규 합류자는 1분 안에 컨텍스트를 파악해야 한다.

## What Changes

- 신규 프로젝트 전체 구축 (기존 코드 없음)
- FastAPI 백엔드 + Vanilla JS / Tailwind CDN 프론트엔드 구성
- DB 4테이블(users, teams, tasks, messages) + REST API 17개 구현
- 로컬 SQLite / 운영 Neon(Vercel) 이중 환경 지원
- Vercel 자동 배포 파이프라인 구성

## Capabilities

### New Capabilities

- `user-auth`: 회원가입, 로그인, JWT 발급(24h), 비밀번호 bcrypt 해시, 로그아웃(stateless)
- `team-management`: 팀 생성(초대코드 자동 발급), 초대코드 합류, 팀 정보 조회, 멤버 목록 조회
- `kanban-tasks`: 태스크 CRUD, TODO/DOING/DONE 3컬럼 드래그, assignee 지정(nullable), 상태별/담당자별 필터
- `team-chat`: 팀 단위 메시지 송수신, 5초 폴링(since= 증분), 1000자 제한, 본인 메시지 삭제
- `deployment`: 로컬 FastAPI 일체형(StaticFiles), Vercel + Neon 운영 배포, 환경변수 분리

### Modified Capabilities

## Impact

- **백엔드**: FastAPI, SQLAlchemy, python-jose, bcrypt, uvicorn. 신규 생성.
- **프론트엔드**: Vanilla JS ES6+, Tailwind CDN v3, HTML5 Drag API. MPA 4개 파일(login.html, team.html, app.html, error.html).
- **DB**: 4테이블, 로컬 SQLite / 운영 PostgreSQL(Neon). DATABASE_URL 환경변수로 전환.
- **API**: Auth 4 + Team 4 + Task 6 + Chat 3 = 17개 엔드포인트.
- **배포**: Vercel 프로젝트 생성, Neon Marketplace 연동, `vercel.json` 설정.
