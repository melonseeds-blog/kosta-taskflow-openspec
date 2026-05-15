## ADDED Requirements

### Requirement: 채팅 메시지 조회 (폴링)
팀 멤버는 팀 채팅 이력을 조회할 수 있다. 5초마다 since= 파라미터로 증분 폴링하여 새 메시지만 가져온다.

#### Scenario: 최초 진입 조회
- **WHEN** 팀 멤버가 GET /teams/{id}/messages 요청 (since 없음)
- **THEN** 200 + 최근 메시지 최대 50개 배열 반환. 각 항목: `{ id, user_id, user_email, content, created_at }`

#### Scenario: 증분 폴링
- **WHEN** GET /teams/{id}/messages?since=2026-05-13T14:27:00Z 요청
- **THEN** created_at > since 인 메시지만 반환. 새 메시지 없으면 빈 배열 반환

#### Scenario: 빈 채팅 상태
- **WHEN** 팀의 메시지가 0건일 때 채팅 화면 진입
- **THEN** "아직 대화가 없습니다" empty state 표시. 입력창은 활성화됨

---

### Requirement: 메시지 전송
팀 멤버는 1000자 이내의 텍스트 메시지를 전송할 수 있다. 클라이언트와 서버 양쪽에서 길이를 검증한다.

#### Scenario: 정상 전송
- **WHEN** 1000자 이내 메시지로 POST /teams/{id}/messages 요청
- **THEN** 201 + `{ id, user_id, user_email, content, created_at }` 반환

#### Scenario: 1000자 초과
- **WHEN** 1001자 이상 메시지로 POST /teams/{id}/messages 요청
- **THEN** 400 + `{ error: { code: "TOO_LONG", message: "메시지는 1000자 이내", limit: 1000, actual: <실제 길이> } }` 반환

#### Scenario: 클라이언트 측 글자수 카운터
- **WHEN** 사용자가 채팅 입력창에 1001자 입력
- **THEN** 카운터가 적색으로 변경. 전송 버튼 비활성화

#### Scenario: 빈 메시지
- **WHEN** 빈 문자열로 POST /teams/{id}/messages 요청
- **THEN** 400 반환

---

### Requirement: 메시지 삭제
본인이 작성한 메시지만 삭제할 수 있다. owner라도 타인 메시지는 삭제 불가.

#### Scenario: 본인 메시지 삭제
- **WHEN** messages.user_id = current_user_id 인 메시지에 DELETE /messages/{id} 요청
- **THEN** 204 No Content 반환. 화면에서 즉시 제거

#### Scenario: 타인 메시지 삭제 시도
- **WHEN** 타인의 메시지에 DELETE /messages/{id} 요청
- **THEN** 403 + `{ error: { code: "NOT_OWNER", message: "본인 메시지만 삭제 가능" } }` 반환

#### Scenario: 호버 메뉴
- **WHEN** 본인 메시지에 마우스 호버
- **THEN** 삭제 아이콘(🗑) 표시. 타인 메시지에는 아이콘 없음

---

### Requirement: 폴링 실패 복구
네트워크 오류 시 exponential backoff로 재시도하고 사용자에게 연결 상태를 표시한다.

#### Scenario: 연결 끊김 감지
- **WHEN** 폴링 요청이 실패
- **THEN** 헤더에 "연결 끊김 · 재시도 중" 표시. Exponential backoff 시작(5s → 10s → 20s → 40s → 60s 상한)

#### Scenario: 재연결 성공
- **WHEN** 폴링 재시도가 성공
- **THEN** since= 파라미터로 누락 메시지 일괄 수신. "연결되었습니다" 토스트 표시

---

### Requirement: 메시지 누락 없음 보장
POST 성공(201)한 메시지는 이후 모든 GET 응답에 포함되어야 한다. DELETE된 메시지는 누락이 아니다.

#### Scenario: 누락 없음 검증
- **WHEN** POST /teams/{id}/messages가 201을 반환한 메시지
- **THEN** 이후 GET /teams/{id}/messages 응답에 항상 포함됨 (삭제 전까지)

---

### Requirement: 모바일 채팅 UX
모바일에서 키보드가 올라올 때 메시지 영역이 자동으로 축소되고, 입력 포커스 시 폴링 간격이 5초에서 2초로 단축된다.

#### Scenario: 키보드 활성화
- **WHEN** 모바일에서 메시지 입력창에 포커스
- **THEN** 메시지 영역이 키보드 위 공간으로 자동 축소. 폴링 간격 2초로 단축

#### Scenario: 모바일 메시지 삭제
- **WHEN** 모바일에서 본인 메시지를 길게 누름
- **THEN** 삭제 메뉴 팝업 표시
