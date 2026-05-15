"""Initial schema - users, teams, tasks, messages

4개 테이블을 생성합니다.
순환 참조 처리 순서:
  1. users (team_id 컬럼 제외)
  2. teams  (owner_id FK → users.id)
  3. users에 team_id 컬럼 추가 (FK → teams.id)
  4. tasks
  5. messages
  6. 인덱스

Revision ID: 0001
Revises: None
Create Date: 2026-05-15 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── 1. users 테이블 (team_id 없이 먼저 생성) ─────────────────────────
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )

    # ── 2. teams 테이블 (owner_id FK → users.id) ─────────────────────────
    op.create_table(
        "teams",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("invite_code", sa.String(9), nullable=False),
        sa.Column("owner_id", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("invite_code"),
    )

    # ── 3. users에 team_id 컬럼 추가 (FK → teams.id) ─────────────────────
    op.add_column(
        "users",
        sa.Column("team_id", sa.Integer(), nullable=True),
    )
    # SQLite는 ADD COLUMN + FK를 동시에 지원하지 않으므로
    # create_foreign_key는 배치 모드(batch_alter_table)로 처리합니다.
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.create_foreign_key(
            "fk_users_team_id",
            "teams",
            ["team_id"],
            ["id"],
        )
        batch_op.create_index("ix_users_team_id", ["team_id"])

    # ── 4. tasks 테이블 ───────────────────────────────────────────────────
    op.create_table(
        "tasks",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("team_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(100), nullable=False),
        sa.Column(
            "status",
            sa.String(10),
            nullable=False,
            server_default="TODO",
        ),
        sa.Column("creator_id", sa.Integer(), nullable=False),
        sa.Column("assignee_id", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(["assignee_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["creator_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["team_id"], ["teams.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_tasks_team_id_created_at",
        "tasks",
        ["team_id", "created_at"],
    )

    # ── 5. messages 테이블 ────────────────────────────────────────────────
    op.create_table(
        "messages",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("team_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(["team_id"], ["teams.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_messages_team_id_created_at",
        "messages",
        ["team_id", "created_at"],
    )


def downgrade() -> None:
    # upgrade() 역순으로 제거
    op.drop_index("ix_messages_team_id_created_at", table_name="messages")
    op.drop_table("messages")

    op.drop_index("ix_tasks_team_id_created_at", table_name="tasks")
    op.drop_table("tasks")

    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.drop_index("ix_users_team_id")
        batch_op.drop_constraint("fk_users_team_id", type_="foreignkey")
        batch_op.drop_column("team_id")

    op.drop_table("teams")
    op.drop_table("users")
