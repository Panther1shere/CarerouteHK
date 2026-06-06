from collections.abc import AsyncGenerator

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import get_settings

settings = get_settings()

engine = create_async_engine(settings.database_url, pool_pre_ping=True)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session


async def initialize_database() -> None:
    async with engine.begin() as connection:
        await connection.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS system_status (
                    id SERIAL PRIMARY KEY,
                    message TEXT NOT NULL
                );
                """
            )
        )
        await connection.execute(
            text(
                """
                INSERT INTO system_status (message)
                SELECT 'Hello from the PostgreSQL Database!'
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM system_status
                );
                """
            )
        )


async def dispose_database() -> None:
    await engine.dispose()
