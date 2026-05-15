## ADDED Requirements

### Requirement: 태스크 목록 조회 및 필터
팀 멤버는 칸반 보드에서 태스크를 조회할 수 있다. 전체/내 태스크(@me)/미할당 3가지 필터를 지원한다. 기본 정렬은 최근 생성순(created_at DESC)이다.

#### Scenario: 전체 태스크 조회
- **WHEN** 팀 멤버가 GET /teams/{id}/tasks 요청
- **THEN** 200 + 태스크 배열 반환. 각 항목: `{ id, title, status, creator_id, assignee_id, created_at }`

#### Scenario: 내 태스크 필터
- **WHEN** GET /teams/{id}/tasks?filter=me 요청
- **THEN** assignee_id = current_user_id 인 태스크만 반환

#### Scenario: 미할당 필터
- **WHEN** GET /teams/{id}/tasks?filter=unassigned 요청
- **THEN** assignee_id IS NULL 인 태스크만 반환

---

### Requirement: 태스크 생성
팀 멤버는 TODO 컬럼에 새 태스크를 생성할 수 있다. assignee는 nullable이며 생성 시 선택한다.

#### Scenario: 정상 생성
- **WHEN** 팀 멤버가 유효한 제목(1–100자)으로 POST /teams/{id}/tasks 요청
- **THEN** 201 + `{ id, title, status: "TODO", creator_id, assignee_id, created_at }` 반환

#### Scenario: 제목 빈 값
- **WHEN** 빈 제목으로 POST /teams/{id}/tasks 요청
- **THEN** 400 + `{ error: { code: "VALIDATION_ERROR" } }` 반환

#### Scenario: 제목 100자 초과
- **WHEN** 101자 이상 제목으로 POST /teams/{id}/tasks 요청
- **THEN** 400 반환

---

### Requirement: 태스크 상태 변경 (드래그)
팀 멤버는 태스크를 TODO/DOING/DONE 컬럼 사이에서 드래그하여 상태를 변경할 수 있다.

#### Scenario: 정상 상태 변경
- **WHEN** 태스크 카드를 다른 컬럼에 drop하여 PATCH /tasks/{id}/status `{ status: "DOING" }` 요청
- **THEN** 200 + 업데이트된 태스크 반환

#### Scenario: 유효하지 않은 상태값
- **WHEN** TODO/DOING/DONE 이외의 status 값으로 PATCH /tasks/{id}/status 요청
- **THEN** 400 반환

---

### Requirement: 태스크 수정
태스크의 제목과 assignee를 수정할 수 있다.

#### Scenario: 제목 수정
- **WHEN** 팀 멤버가 PUT /tasks/{id} `{ title: "새 제목" }` 요청
- **THEN** 200 + 업데이트된 태스크 반환

#### Scenario: Assignee 변경
- **WHEN** 팀 멤버가 PUT /tasks/{id} `{ assignee_id: 5 }` 또는 `{ assignee_id: null }` 요청
- **THEN** 200 + 업데이트된 태스크 반환

---

### Requirement: 태스크 삭제
태스크 삭제는 creator 또는 team owner만 가능하다.

#### Scenario: Creator가 자신의 태스크 삭제
- **WHEN** tasks.creator_id = current_user_id 인 사용자가 DELETE /tasks/{id} 요청
- **THEN** 204 No Content 반환

#### Scenario: Owner가 타인 태스크 삭제
- **WHEN** teams.owner_id = current_user_id 인 사용자가 타인 태스크에 DELETE /tasks/{id} 요청
- **THEN** 204 No Content 반환

#### Scenario: 권한 없는 삭제 시도
- **WHEN** creator도 owner도 아닌 사용자가 DELETE /tasks/{id} 요청
- **THEN** 403 + `{ error: { code: "FORBIDDEN", message: "권한이 없습니다" } }` 반환

---

### Requirement: 단일 태스크 조회
태스크 ID로 단일 태스크의 상세 정보를 조회한다.

#### Scenario: 정상 조회
- **WHEN** 팀 멤버가 GET /tasks/{id} 요청
- **THEN** 200 + `{ id, title, status, creator_id, assignee_id, created_at }` 반환

#### Scenario: 존재하지 않는 태스크
- **WHEN** 없는 id로 GET /tasks/{id} 요청
- **THEN** 404 반환

---

### Requirement: 빈 칸반 상태
태스크가 없을 때 각 컬럼에 empty state를 표시한다. TODO 컬럼에만 CTA 버튼을 강조 표시한다.

#### Scenario: 태스크 0개 상태
- **WHEN** 팀의 태스크가 0건일 때 칸반 화면 진입
- **THEN** 각 컬럼에 "카드 없음" 표시. TODO 컬럼에만 "+ 첫 태스크 만들기" CTA 표시

---

### Requirement: 모바일 칸반 (스와이프)
768px 미만 화면에서는 3컬럼 대신 1컬럼씩 좌우 스와이프로 전환한다.

#### Scenario: 모바일 컬럼 전환
- **WHEN** 768px 미만 화면에서 TODO 컬럼 우측으로 스와이프
- **THEN** DOING 컬럼이 표시됨. 상단 인디케이터 업데이트

#### Scenario: 모바일 상태 변경
- **WHEN** 모바일에서 태스크 카드를 길게 누름
- **THEN** 상태 변경 메뉴(TODO/DOING/DONE) 표시. 선택 시 PATCH /tasks/{id}/status 호출
