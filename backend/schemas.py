from datetime import datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict, EmailStr, field_validator


# --- Auth ---

class SignupRequest(BaseModel):
    email: EmailStr
    password: str

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("비밀번호는 8자 이상이어야 합니다.")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    team_id: int | None


class AuthResponse(BaseModel):
    token: str
    user: UserOut


# --- Team ---

class TeamCreateRequest(BaseModel):
    name: str

    @field_validator("name")
    @classmethod
    def name_length(cls, v: str) -> str:
        v = v.strip()
        if not (1 <= len(v) <= 30):
            raise ValueError("팀 이름은 1자 이상 30자 이하여야 합니다.")
        return v


class TeamJoinRequest(BaseModel):
    invite_code: str

    @field_validator("invite_code")
    @classmethod
    def invite_code_format(cls, v: str) -> str:
        import re
        if not re.match(r"^[A-Z]{4}-[0-9]{4}$", v):
            raise ValueError("초대 코드 형식이 올바르지 않습니다. (예: ABCD-1234)")
        return v


class TeamOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    invite_code: str
    owner_id: int
    created_at: datetime


class TeamJoinTeamInfo(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    member_count: int


class TeamJoinResponse(BaseModel):
    team: TeamJoinTeamInfo
    redirect: str


class MemberOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    is_owner: bool
    joined_at: datetime


# --- Task ---

class TaskCreateRequest(BaseModel):
    title: str
    assignee_id: int | None = None

    @field_validator("title")
    @classmethod
    def title_length(cls, v: str) -> str:
        v = v.strip()
        if not (1 <= len(v) <= 100):
            raise ValueError("제목은 1자 이상 100자 이하여야 합니다.")
        return v


class TaskUpdateRequest(BaseModel):
    title: str | None = None
    assignee_id: int | None = None

    @field_validator("title")
    @classmethod
    def title_length(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip()
        if not (1 <= len(v) <= 100):
            raise ValueError("제목은 1자 이상 100자 이하여야 합니다.")
        return v


class TaskStatusRequest(BaseModel):
    status: Literal["TODO", "DOING", "DONE"]


class TaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    team_id: int
    title: str
    status: str
    creator_id: int
    assignee_id: int | None
    created_at: datetime


# --- Message ---

class MessageCreateRequest(BaseModel):
    content: str

    @field_validator("content")
    @classmethod
    def content_length(cls, v: str) -> str:
        if len(v) < 1:
            raise ValueError("메시지 내용을 입력해주세요.")
        if len(v) > 1000:
            raise ValueError("메시지는 1000자를 초과할 수 없습니다.")
        return v


class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    user_email: str
    content: str
    created_at: datetime
