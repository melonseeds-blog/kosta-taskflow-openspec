from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User, Team, Task
from ..schemas import TaskCreateRequest, TaskUpdateRequest, TaskStatusRequest, TaskOut
from ..dependencies import get_current_user
from ..utils.errors import error_response, err_forbidden, err_not_found

router = APIRouter(prefix="/api", tags=["tasks"])


def _require_team_member(team_id: int, current_user: User):
    if current_user.team_id != team_id:
        raise err_forbidden()


def _get_task_or_404(task_id: int, db: Session) -> Task:
    task = db.get(Task, task_id)
    if task is None:
        raise err_not_found("태스크")
    return task


@router.get("/teams/{team_id}/tasks", response_model=list[TaskOut])
def list_tasks(
    team_id: int,
    filter: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_team_member(team_id, current_user)

    q = db.query(Task).filter(Task.team_id == team_id)

    if filter == "me":
        q = q.filter(Task.assignee_id == current_user.id)
    elif filter == "unassigned":
        q = q.filter(Task.assignee_id.is_(None))

    tasks = q.order_by(Task.created_at.desc()).all()
    return [TaskOut.model_validate(t) for t in tasks]


@router.post("/teams/{team_id}/tasks", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
def create_task(
    team_id: int,
    body: TaskCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_team_member(team_id, current_user)

    # assignee가 같은 팀 소속인지 검증
    if body.assignee_id is not None:
        assignee = db.get(User, body.assignee_id)
        if assignee is None or assignee.team_id != team_id:
            raise error_response(400, "VALIDATION_ERROR", "유효하지 않은 담당자입니다.")

    task = Task(
        team_id=team_id,
        title=body.title,
        creator_id=current_user.id,
        assignee_id=body.assignee_id,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return TaskOut.model_validate(task)


@router.get("/tasks/{task_id}", response_model=TaskOut)
def get_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = _get_task_or_404(task_id, db)
    _require_team_member(task.team_id, current_user)
    return TaskOut.model_validate(task)


@router.patch("/tasks/{task_id}/status", response_model=TaskOut)
def update_task_status(
    task_id: int,
    body: TaskStatusRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = _get_task_or_404(task_id, db)
    _require_team_member(task.team_id, current_user)

    task.status = body.status
    db.commit()
    db.refresh(task)
    return TaskOut.model_validate(task)


@router.put("/tasks/{task_id}", response_model=TaskOut)
def update_task(
    task_id: int,
    body: TaskUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = _get_task_or_404(task_id, db)
    _require_team_member(task.team_id, current_user)

    if body.title is not None:
        task.title = body.title

    if "assignee_id" in body.model_fields_set:
        if body.assignee_id is not None:
            assignee = db.get(User, body.assignee_id)
            if assignee is None or assignee.team_id != task.team_id:
                raise error_response(400, "VALIDATION_ERROR", "유효하지 않은 담당자입니다.")
        task.assignee_id = body.assignee_id

    db.commit()
    db.refresh(task)
    return TaskOut.model_validate(task)


@router.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = _get_task_or_404(task_id, db)
    _require_team_member(task.team_id, current_user)

    team = db.get(Team, task.team_id)
    is_creator = task.creator_id == current_user.id
    is_owner = team is not None and team.owner_id == current_user.id

    if not (is_creator or is_owner):
        raise error_response(403, "FORBIDDEN", "태스크를 삭제할 권한이 없습니다.")

    db.delete(task)
    db.commit()
