from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import dispose_database, get_session, initialize_database
from app.schemas import StatusResponse

settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    await initialize_database()
    try:
        yield
    finally:
        await dispose_database()


app = FastAPI(title="Connection Test API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/healthz")
async def healthcheck() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/status", response_model=StatusResponse)
async def get_status(session: AsyncSession = Depends(get_session)) -> StatusResponse:
    result = await session.execute(
        text(
            """
            SELECT message
            FROM system_status
            ORDER BY id
            LIMIT 1;
            """
        )
    )
    message = result.scalar_one_or_none()

    if message is None:
        raise HTTPException(status_code=503, detail="Database has not been seeded yet.")

    return StatusResponse(message=message)
