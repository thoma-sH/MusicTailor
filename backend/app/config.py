from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    environment: str = Field(default="dev")
    log_level: str = Field(default="INFO")

    database_url: str = Field(
        default="postgresql+asyncpg://musictailor:musictailor@localhost:5432/musictailor"
    )
    redis_url: str = Field(default="redis://localhost:6379/0")

    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:5173"])

    spotify_client_id: str = Field(default="")
    spotify_client_secret: str = Field(default="")
    spotify_redirect_uri: str = Field(default="http://localhost:8000/auth/spotify/callback")
    spotify_scopes: list[str] = Field(
        default_factory=lambda: [
            "user-read-private",
            "user-read-email",
            "user-top-read",
            "user-library-read",
            "user-read-recently-played",
            "playlist-modify-public",
            "playlist-modify-private",
            "streaming",
        ]
    )

    lastfm_api_key: str = Field(default="")
    genius_access_token: str = Field(default="")

    session_secret: str = Field(default="dev-only-change-me")
    frontend_url: str = Field(default="http://localhost:5173")


settings = Settings()
