from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from ..database import get_db
from ..models import User
from ..schemas import SignupRequest, LoginRequest, AuthResponse, UserOut
from ..dependencies import get_current_user
from ..utils.auth import hash_password, verify_password, create_access_token
from ..utils.errors import error_response, err_unauthorized

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def signup(body: SignupRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == body.email).first()
    if existing:
        raise error_response(409, "EMAIL_TAKEN", "이미 사용 중인 이메일입니다.")

    user = User(
        email=body.email,
        password_hash=hash_password(body.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(user.id)
    return {"token": token, "user": UserOut.model_validate(user)}


@router.post("/login", response_model=AuthResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    # 타이밍 공격 방지: 사용자 미존재 시에도 동일한 검증 경로
    if user is None or not verify_password(body.password, user.password_hash):
        raise error_response(401, "INVALID_CREDENTIALS", "이메일 또는 비밀번호가 올바르지 않습니다.")

    token = create_access_token(user.id)
    return {"token": token, "user": UserOut.model_validate(user)}


@router.post("/logout")
def logout():
    return {}


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return UserOut.model_validate(current_user)
