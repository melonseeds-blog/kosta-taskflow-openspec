## ADDED Requirements

### Requirement: 회원가입
신규 사용자는 이메일과 비밀번호로 계정을 생성할 수 있다. 시스템은 이메일 중복을 거부하고 비밀번호를 bcrypt로 해시하여 저장한 후 JWT를 즉시 발급한다.

#### Scenario: 정상 가입
- **WHEN** 유효한 이메일과 8자 이상 비밀번호로 POST /auth/signup 요청
- **THEN** 201 Created + `{ token, user: { id, email, team_id: null } }` 반환

#### Scenario: 이메일 중복
- **WHEN** 이미 등록된 이메일로 POST /auth/signup 요청
- **THEN** 409 + `{ error: { code: "EMAIL_TAKEN", message: "이미 가입된 이메일입니다" } }` 반환

#### Scenario: 이메일 형식 오류
- **WHEN** 이메일 형식이 아닌 값으로 POST /auth/signup 요청
- **THEN** 400 + `{ error: { code: "VALIDATION_ERROR", message: "올바른 이메일 형식이 아닙니다" } }` 반환

#### Scenario: 비밀번호 8자 미만
- **WHEN** 7자 이하 비밀번호로 POST /auth/signup 요청
- **THEN** 400 + `{ error: { code: "VALIDATION_ERROR", message: "8자 이상 입력해주세요" } }` 반환

---

### Requirement: 로그인
등록된 사용자는 이메일/비밀번호로 로그인하여 24시간 유효한 JWT를 받는다. 인증 실패 시 이메일 존재 여부를 노출하지 않는다.

#### Scenario: 정상 로그인
- **WHEN** 올바른 이메일/비밀번호로 POST /auth/login 요청
- **THEN** 200 + `{ token, user: { id, email, team_id } }` 반환. team_id가 null이면 팀 선택 화면으로 분기

#### Scenario: 자격 증명 오류
- **WHEN** 틀린 비밀번호 또는 존재하지 않는 이메일로 POST /auth/login 요청
- **THEN** 401 + `{ error: { code: "INVALID_CREDENTIALS", message: "이메일 또는 비밀번호가 일치하지 않습니다" } }` 반환. 이메일 존재 여부는 노출하지 않음

---

### Requirement: JWT 인증
모든 보호된 API는 Authorization 헤더의 Bearer 토큰을 검증한다.

#### Scenario: 유효한 토큰
- **WHEN** 만료되지 않은 JWT로 보호된 API 요청
- **THEN** 요청이 정상 처리됨

#### Scenario: 토큰 만료
- **WHEN** 24시간이 지난 JWT로 API 요청
- **THEN** 401 + `{ error: { code: "TOKEN_EXPIRED", message: "인증이 만료되었습니다" } }` 반환. 클라이언트는 localStorage 토큰 삭제 후 /login으로 redirect

#### Scenario: 토큰 없음
- **WHEN** Authorization 헤더 없이 보호된 API 요청
- **THEN** 401 반환

---

### Requirement: 로그아웃
로그아웃은 클라이언트 토큰 삭제로 처리한다. 서버는 JWT 블랙리스트를 유지하지 않는다.

#### Scenario: 정상 로그아웃
- **WHEN** 유효한 JWT로 POST /auth/logout 요청
- **THEN** 200 + `{}` 반환. 클라이언트는 localStorage에서 token 삭제 후 /login으로 이동

#### Scenario: 현재 사용자 조회
- **WHEN** 유효한 JWT로 GET /auth/me 요청
- **THEN** 200 + `{ id, email, team_id }` 반환
