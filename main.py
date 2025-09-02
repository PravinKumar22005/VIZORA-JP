from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers.signup_router import router
from routers.login_router import router as login_router
from routers.change_password_router import router as change_password_router
from models.user import Base
from db import engine

app = FastAPI()

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

# Uncomment to create tables (use alembic instead for production)
#Base.metadata.create_all(bind=engine)