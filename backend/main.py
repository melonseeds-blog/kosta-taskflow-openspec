import os
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware

from .database import engine, Base
from .routers import auth, teams, tasks, messages

# 모든 테이블 생성 (최초 실행 시)
Base.metadata.create_all(bind=engine)

app = FastAPI(title="TaskFlow API", version="1.0.0")

_cors_origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:8000").split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(teams.router)
app.include_router(tasks.router)
app.include_router(messages.router)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    # Pydantic 유효성 검사 실패를 통일된 에러 형식으로 변환
    first_error = exc.errors()[0] if exc.errors() else {}
    message = first_error.get("msg", "입력값이 올바르지 않습니다.")
    # pydantic v2 에러 메시지에서 "Value error, " 접두사 제거
    message = message.removeprefix("Value error, ")
    return JSONResponse(
        status_code=400,
        content={"error": {"code": "VALIDATION_ERROR", "message": message}},
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    # detail이 딕셔너리(에러 응답 구조체)인 경우 그대로 반환
    if isinstance(exc.detail, dict):
        return JSONResponse(status_code=exc.status_code, content=exc.detail)
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": "ERROR", "message": str(exc.detail)}},
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"error": {"code": "INTERNAL_ERROR", "message": "서버 내부 오류가 발생했습니다."}},
    )


# 로컬 환경(VERCEL 환경변수 없음)에서 프론트엔드 정적 파일 서빙
if not os.getenv("VERCEL"):
    import pathlib
    from fastapi.staticfiles import StaticFiles

    frontend_public = pathlib.Path(__file__).parent.parent / "frontend" / "public"
    frontend_static = pathlib.Path(__file__).parent.parent / "frontend" / "static"
    if frontend_static.exists():
        app.mount("/static", StaticFiles(directory=str(frontend_static)), name="static")
    if frontend_public.exists():
        app.mount("/", StaticFiles(directory=str(frontend_public), html=True), name="public")
