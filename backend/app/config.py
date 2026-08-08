from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    supabase_url: str
    supabase_jwt_secret: str
    supabase_service_role_key: str
    cors_origins: str = "http://localhost:3000"
    finnhub_api_key: str = ""

    model_config = SettingsConfigDict(env_file=".env")


settings = Settings()
