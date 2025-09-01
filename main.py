from fastapi import FastAPI
from routers.signup_router import router
from routers.login_router import router as login_router
from models.user import Base
from db import engine

app = FastAPI()
app.include_router(router)
app.include_router(login_router)


# Create tables
Base.metadata.create_all(bind=engine)