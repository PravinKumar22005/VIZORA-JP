from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers.signup_router import router
from routers.login_router import router as login_router
from routers.change_password_router import router as change_password_router
from routers.chat_router import router as chat_router

from models.user import Base
from db import engine
from routers.ai_router import router as ai_router
from routers.table_query_router import router as table_query_router

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
app.include_router(chat_router)
app.include_router(ai_router)
app.include_router(table_query_router)
# Uncomment to create tables (use alembic instead for production)
#Base.metadata.create_all(bind=engine)