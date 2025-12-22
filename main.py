from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from routers import (
    signup_router,
    login_router,
    chat_router,
    sharing_router,
    dashboard_router,
    change_password_router,
    ai_router,
    table_query_router,
)
from db import get_db
from sqlalchemy.orm import Session
import uvicorn
from models.user import User
from utils.jwt import get_current_user
from fastapi.security import HTTPAuthorizationCredentials
import os
from starlette.staticfiles import StaticFiles
from starlette.responses import FileResponse

app = FastAPI()


# Add Bearer token security scheme to OpenAPI docs
def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    openapi_schema = get_openapi(
        title="VIZORA-JP API",
        version="1.0.0",
        description="API documentation for VIZORA-JP",
        routes=app.routes,
    )
    openapi_schema["components"]["securitySchemes"] = {
        "BearerAuth": {"type": "http", "scheme": "bearer", "bearerFormat": "JWT"}
    }
    for path in openapi_schema["paths"].values():
        for method in path.values():
            method.setdefault("security", []).append({"BearerAuth": []})
    app.openapi_schema = openapi_schema
    return app.openapi_schema


app.openapi = custom_openapi

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(signup_router.router)
app.include_router(login_router.router)
app.include_router(change_password_router.router)
app.include_router(chat_router.router)
app.include_router(ai_router.router)
app.include_router(table_query_router.router)
app.include_router(dashboard_router.router)
app.include_router(sharing_router.router)
# Uncomment to create tables (use alembic instead for production)
# Base.metadata.create_all(bind=engine)

static_dir = os.path.join(os.path.dirname(__file__), "static")
os.makedirs(static_dir, exist_ok=True)

app.mount(
    "/static",
    StaticFiles(directory=static_dir),
    name="static",
)
