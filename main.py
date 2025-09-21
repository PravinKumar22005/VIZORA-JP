from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers.signup_router import router
from routers.login_router import router as login_router
from routers.change_password_router import router as change_password_router
from routers.chat_router import router as chat_router
from routers.sharing_router import router as sharing_router

from models.user import Base
from db import engine

from routers.ai_router import router as ai_router
from routers.table_query_router import router as table_query_router
from routers.dashboard_router import router as dashboard_router


from fastapi.openapi.utils import get_openapi
from fastapi.security import HTTPBearer

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

app.include_router(router)
app.include_router(login_router)
app.include_router(change_password_router)
app.include_router(chat_router)
app.include_router(ai_router)
app.include_router(table_query_router)
app.include_router(dashboard_router)
app.include_router(sharing_router)
# Uncomment to create tables (use alembic instead for production)
# Base.metadata.create_all(bind=engine)
