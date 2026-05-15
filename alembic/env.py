"""Alembic environment configuration.

DATABASE_URL 환경변수를 읽어서 마이그레이션을 실행합니다.
SQLite / PostgreSQL 양쪽 호환.
"""
import os
import sys
from logging.config import fileConfig
from pathlib import Path

from sqlalchemy import engine_from_config, pool

from alembic import context

# ── 프로젝트 루트를 sys.path에 추가 ──────────────────────────────────────
# env.py 위치: <project_root>/alembic/env.py
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

# .env 파일 자동 로드 (python-dotenv 설치 시)
try:
    from dotenv import load_dotenv
    _env_file = PROJECT_ROOT / "backend" / ".env"
    if not _env_file.exists():
        _env_file = PROJECT_ROOT / ".env"
    if _env_file.exists():
        load_dotenv(_env_file)
except ImportError:
    pass  # python-dotenv 없어도 환경변수가 이미 설정돼 있으면 동작

# ── Alembic Config 객체 ───────────────────────────────────────────────────
config = context.config

# logging.ini 섹션이 있으면 적용
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# ── 타겟 메타데이터 ───────────────────────────────────────────────────────
# 모델 Base를 여기서 import하면 autogenerate가 동작합니다.
# 현재는 순수 op.* 기반 마이그레이션이므로 None으로 둡니다.
target_metadata = None

# ── DATABASE_URL 결정 ────────────────────────────────────────────────────
def get_url() -> str:
    """
    우선순위:
    1. 환경변수 DATABASE_URL
    2. alembic.ini 의 sqlalchemy.url
    """
    url = os.getenv("DATABASE_URL")
    if url:
        return url
    return config.get_main_option("sqlalchemy.url")


def _make_engine_config() -> dict:
    """sqlalchemy 섹션을 dict로 반환하고 url을 동적으로 주입."""
    section = config.get_section(config.config_ini_section, {})
    section["sqlalchemy.url"] = get_url()
    return section


# ── 오프라인 마이그레이션 (--sql 플래그) ──────────────────────────────────
def run_migrations_offline() -> None:
    """SQL 스크립트를 stdout으로 출력합니다."""
    url = get_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


# ── 온라인 마이그레이션 (실제 DB 연결) ───────────────────────────────────
def run_migrations_online() -> None:
    """실제 DB에 연결해 마이그레이션을 실행합니다."""
    url = get_url()

    # SQLite: 동시성 이슈 방지를 위해 NullPool 사용
    poolclass = pool.NullPool if url.startswith("sqlite") else pool.NullPool

    connectable = engine_from_config(
        _make_engine_config(),
        prefix="sqlalchemy.",
        poolclass=poolclass,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
