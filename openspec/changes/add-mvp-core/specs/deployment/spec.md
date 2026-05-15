## ADDED Requirements

### Requirement: 로컬 개발 환경 (일체형)
로컬에서 FastAPI가 백엔드 API와 정적 프론트엔드 파일을 단일 포트로 서빙한다. DB는 SQLite 파일을 사용한다.

#### Scenario: 로컬 서버 실행
- **WHEN** `uvicorn main:app --reload` 명령 실행
- **THEN** localhost:8000에서 API와 정적 파일 모두 접근 가능. SQLite taskflow.db 파일 자동 생성

#### Scenario: 환경변수 전환
- **WHEN** DATABASE_URL 환경변수를 Neon 연결 문자열로 설정
- **THEN** 동일 코드가 PostgreSQL에 연결됨. 코드 변경 불필요

---

### Requirement: Vercel 운영 배포
main 브랜치 push 시 Vercel이 자동으로 프론트엔드와 백엔드를 배포한다.

#### Scenario: 자동 배포
- **WHEN** git push origin main 실행
- **THEN** Vercel이 빌드 트리거. 5분 이내에 배포 완료. taskflow.vercel.app 접근 가능

#### Scenario: Vercel 프로젝트 구성
- **WHEN** Vercel 프로젝트 초기 설정
- **THEN** vercel.json에 FastAPI Serverless 함수 라우팅 설정. 정적 파일은 public/ 디렉토리에서 서빙

---

### Requirement: Neon PostgreSQL 연동
Vercel Marketplace에서 Neon을 프로비저닝하면 DATABASE_URL이 환경변수로 자동 주입된다.

#### Scenario: Neon 연동
- **WHEN** Vercel 대시보드에서 Neon Marketplace 통합 설정
- **THEN** DATABASE_URL이 Vercel 환경변수에 자동 등록. 운영 배포 시 PostgreSQL 사용

#### Scenario: DB 마이그레이션
- **WHEN** 배포 전 Alembic 마이그레이션 실행
- **THEN** Neon DB에 4테이블(users, teams, tasks, messages)과 인덱스 생성 완료

---

### Requirement: CORS 설정
운영 환경에서 허용 origin을 명시적으로 설정한다.

#### Scenario: 운영 CORS 허용
- **WHEN** taskflow.vercel.app에서 API 요청
- **THEN** CORS 허용. 다른 origin은 차단

#### Scenario: 로컬 CORS 허용
- **WHEN** localhost:8000에서 요청 (일체형이므로 same-origin)
- **THEN** CORS 검사 없음 (same-origin request)

---

### Requirement: 에러 응답 표준
모든 4xx/5xx 응답은 `{ error: { code, message } }` 형태를 따른다. code는 SCREAMING_SNAKE, message는 한국어.

#### Scenario: 에러 응답 형식 일관성
- **WHEN** 서버가 4xx 또는 5xx 응답 반환
- **THEN** 응답 본문이 `{ "error": { "code": "<MACHINE_READABLE>", "message": "<한국어>" } }` 형식

#### Scenario: 민감정보 노출 방지
- **WHEN** 로그인 실패 응답
- **THEN** 이메일 존재 여부를 코드나 메시지에서 구분할 수 없음
