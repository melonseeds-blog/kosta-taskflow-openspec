from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User, Message
from ..schemas import MessageCreateRequest, MessageOut
from ..dependencies import get_current_user
from ..utils.errors import error_response, err_forbidden, err_not_found

router = APIRouter(prefix="/api", tags=["messages"])


def _require_team_member(team_id: int, current_user: User):
    if current_user.team_id != team_id:
        raise err_forbidden()


@router.get("/teams/{team_id}/messages", response_model=list[MessageOut])
def list_messages(
    team_id: int,
    since: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_team_member(team_id, current_user)

    q = db.query(Message).filter(Message.team_id == team_id)

    if since:
        try:
            since_dt = datetime.fromisoformat(since.replace("Z", "+00:00"))
        except ValueError:
            raise error_response(400, "VALIDATION_ERROR", "since 파라미터가 올바른 ISO 8601 형식이 아닙니다.")
        q = q.filter(Message.created_at > since_dt)

    messages = q.order_by(Message.created_at.desc()).limit(50).all()

    return [
        MessageOut(
            id=m.id,
            user_id=m.user_id,
            user_email=m.user.email,
            content=m.content,
            created_at=m.created_at,
        )
        for m in messages
    ]


@router.post("/teams/{team_id}/messages", response_model=MessageOut, status_code=status.HTTP_201_CREATED)
def create_message(
    team_id: int,
    body: MessageCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_team_member(team_id, current_user)

    if len(body.content) > 1000:
        raise error_response(400, "TOO_LONG", "메시지는 1000자를 초과할 수 없습니다.")

    msg = Message(
        team_id=team_id,
        user_id=current_user.id,
        content=body.content,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)

    return MessageOut(
        id=msg.id,
        user_id=msg.user_id,
        user_email=current_user.email,
        content=msg.content,
        created_at=msg.created_at,
    )


@router.delete("/messages/{message_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_message(
    message_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    msg = db.get(Message, message_id)
    if msg is None:
        raise err_not_found("메시지")

    _require_team_member(msg.team_id, current_user)

    if msg.user_id != current_user.id:
        raise error_response(403, "NOT_OWNER", "본인이 작성한 메시지만 삭제할 수 있습니다.")

    db.delete(msg)
    db.commit()
