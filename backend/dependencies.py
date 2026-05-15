from fastapi import Depends, Header
from sqlalchemy.orm import Session
from .database import get_db
from .models import User
from .utils.auth import decode_access_token
from .utils.errors import err_unauthorized


def get_current_user(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise err_unauthorized()

    token = authorization.removeprefix("Bearer ").strip()
    user_id = decode_access_token(token)
    if user_id is None:
        raise err_unauthorized()

    user = db.get(User, user_id)
    if user is None:
        raise err_unauthorized()

    return user
