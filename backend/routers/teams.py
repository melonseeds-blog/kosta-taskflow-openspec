import random
import string
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User, Team
from ..schemas import (
    TeamCreateRequest,
    TeamJoinRequest,
    TeamOut,
    TeamJoinResponse,
    TeamJoinTeamInfo,
    MemberOut,
)
from ..dependencies import get_current_user
from ..utils.errors import error_response, err_forbidden, err_not_found

router = APIRouter(prefix="/api", tags=["teams"])


def _generate_invite_code(db: Session) -> str:
    while True:
        letters = "".join(random.choices(string.ascii_uppercase, k=4))
        digits = "".join(random.choices(string.digits, k=4))
        code = f"{letters}-{digits}"
        if not db.query(Team).filter(Team.invite_code == code).first():
            return code


def _require_team_member(team_id: int, current_user: User):
    if current_user.team_id != team_id:
        raise err_forbidden()


@router.post("/teams", response_model=TeamOut, status_code=status.HTTP_201_CREATED)
def create_team(
    body: TeamCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.team_id is not None:
        raise error_response(409, "ALREADY_IN_TEAM", "이미 팀에 소속되어 있습니다.")

    invite_code = _generate_invite_code(db)
    team = Team(
        name=body.name,
        invite_code=invite_code,
        owner_id=current_user.id,
    )
    db.add(team)
    db.flush()  # team.id 확보

    current_user.team_id = team.id
    db.commit()
    db.refresh(team)

    return TeamOut.model_validate(team)


@router.post("/teams/join", response_model=TeamJoinResponse)
def join_team(
    body: TeamJoinRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.team_id is not None:
        raise error_response(409, "ALREADY_IN_TEAM", "이미 팀에 소속되어 있습니다.")

    team = db.query(Team).filter(Team.invite_code == body.invite_code).first()
    if team is None:
        raise err_not_found("팀")

    current_user.team_id = team.id
    db.commit()
    db.refresh(team)

    member_count = db.query(User).filter(User.team_id == team.id).count()
    team_info = TeamJoinTeamInfo(id=team.id, name=team.name, member_count=member_count)
    return TeamJoinResponse(team=team_info, redirect="/app")


@router.get("/teams/{team_id}", response_model=TeamOut)
def get_team(
    team_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_team_member(team_id, current_user)

    team = db.get(Team, team_id)
    if team is None:
        raise err_not_found("팀")

    return TeamOut.model_validate(team)


@router.get("/teams/{team_id}/members", response_model=list[MemberOut])
def get_members(
    team_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_team_member(team_id, current_user)

    team = db.get(Team, team_id)
    if team is None:
        raise err_not_found("팀")

    members = db.query(User).filter(User.team_id == team_id).all()
    return [
        MemberOut(
            id=m.id,
            email=m.email,
            is_owner=(m.id == team.owner_id),
            joined_at=m.created_at,
        )
        for m in members
    ]
