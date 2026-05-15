from fastapi import HTTPException
from fastapi.responses import JSONResponse


def error_response(status_code: int, code: str, message: str) -> HTTPException:
    return HTTPException(
        status_code=status_code,
        detail={"error": {"code": code, "message": message}},
    )


# 자주 사용되는 에러 팩토리

def err_unauthorized():
    return error_response(401, "UNAUTHORIZED", "인증이 필요합니다.")


def err_forbidden():
    return error_response(403, "FORBIDDEN", "접근 권한이 없습니다.")


def err_not_found(resource: str = "리소스"):
    return error_response(404, "NOT_FOUND", f"{resource}를 찾을 수 없습니다.")


def err_validation(message: str = "입력값이 올바르지 않습니다."):
    return error_response(400, "VALIDATION_ERROR", message)
