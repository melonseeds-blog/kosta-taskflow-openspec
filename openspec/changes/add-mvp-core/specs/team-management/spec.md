## ADDED Requirements

### Requirement: 팀 생성
인증된 사용자는 팀을 만들 수 있다. 생성자는 자동으로 owner가 되고, 서버가 `^[A-Z]{4}-[0-9]{4}$` 형식의 초대코드를 자동 생성한다. 1인 1팀 원칙에 따라 생성 시 users.team_id가 업데이트된다.

#### Scenario: 정상 팀 생성
- **WHEN** 인증된 사용자가 유효한 팀 이름(1–30자)으로 POST /teams 요청
- **THEN** 201 + `{ id, name, invite_code, owner_id, created_at }` 반환. users.team_id가 생성된 teams.id로 업데이트됨

#### Scenario: 팀 이름 빈 값
- **WHEN** 빈 문자열이나 공백만으로 POST /teams 요청
- **THEN** 400 + `{ error: { code: "VALIDATION_ERROR" } }` 반환

#### Scenario: 이미 팀 소속인 사용자
- **WHEN** users.team_id가 NULL이 아닌 사용자가 POST /teams 요청
- **THEN** 409 + `{ error: { code: "ALREADY_IN_TEAM" } }` 반환

---

### Requirement: 초대코드로 팀 합류
사용자는 초대코드를 입력하여 팀에 합류한다. 합류 성공 시 users.team_id가 해당 팀으로 업데이트된다.

#### Scenario: 정상 합류
- **WHEN** 유효한 초대코드(형식 + 존재)로 POST /teams/join 요청
- **THEN** 200 + `{ team: { id, name, member_count }, redirect: "/teams/{id}" }` 반환. users.team_id 업데이트됨

#### Scenario: 형식 오류
- **WHEN** `^[A-Z]{4}-[0-9]{4}$` 패턴에 맞지 않는 코드로 POST /teams/join 요청
- **THEN** 400 + `{ error: { code: "VALIDATION_ERROR", message: "형식이 올바르지 않습니다" } }` 반환

#### Scenario: 존재하지 않는 코드
- **WHEN** 형식은 맞지만 DB에 없는 코드로 POST /teams/join 요청
- **THEN** 404 + `{ error: { code: "NOT_FOUND", message: "해당 초대코드를 찾을 수 없습니다" } }` 반환

#### Scenario: 이미 다른 팀 소속
- **WHEN** users.team_id가 NULL이 아닌 사용자가 POST /teams/join 요청
- **THEN** 409 + `{ error: { code: "ALREADY_IN_TEAM", message: "이미 다른 팀에 소속되어 있습니다" } }` 반환

---

### Requirement: 팀 정보 조회
팀 멤버는 자신이 속한 팀의 정보를 조회할 수 있다. 비멤버는 접근이 차단된다.

#### Scenario: 정상 조회
- **WHEN** 팀 멤버가 GET /teams/{id} 요청
- **THEN** 200 + `{ id, name, invite_code, owner_id, created_at }` 반환

#### Scenario: 비멤버 접근
- **WHEN** user.team_id ≠ {id} 인 사용자가 GET /teams/{id} 요청
- **THEN** 403 + `{ error: { code: "FORBIDDEN", message: "이 팀의 멤버가 아닙니다" } }` 반환

---

### Requirement: 멤버 목록 조회
팀 멤버는 팀의 모든 멤버 목록을 조회할 수 있다. owner는 ★로 표시된다.

#### Scenario: 정상 조회
- **WHEN** 팀 멤버가 GET /teams/{id}/members 요청
- **THEN** 200 + 멤버 배열 반환. 각 항목: `{ id, email, is_owner, joined_at }`

#### Scenario: 비멤버 접근
- **WHEN** 비멤버가 GET /teams/{id}/members 요청
- **THEN** 403 반환

---

### Requirement: 팀 미가입 사용자 강제 분기
users.team_id가 NULL인 로그인 사용자는 칸반/채팅 화면에 접근할 수 없다. 팀 선택 화면으로 강제 이동된다.

#### Scenario: 팀 미가입 상태에서 칸반 접근 시도
- **WHEN** team_id가 NULL인 사용자가 /app 화면에 접근
- **THEN** 클라이언트가 /team 화면으로 redirect

#### Scenario: URL 직접 입력으로 타 팀 접근
- **WHEN** 사용자가 자신이 속하지 않은 /teams/{other_id}/* URL을 직접 입력
- **THEN** 403 반환, 클라이언트가 에러 화면 표시
