from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "sqlite:///./newrosense.db"
    jwt_secret: str = "dev-secret-change-me"
    jwt_alg: str = "HS256"
    jwt_expiry_minutes: int = 720
    cors_origins: str = "http://localhost:5000,http://127.0.0.1:5000"
    openai_api_key: str | None = None
    openai_model: str = "gpt-4o-mini"
    scheduler_enabled: bool = True
    scheduler_interval_minutes: int = 180
    # Embedding: primary is bge-small-en-v1.5 (better MTEB retrieval). If it cannot be
    # loaded (no network, model registry unavailable, etc.) the service falls back to
    # the historical MiniLM-L6 default. Both are 384-dim so cosines stay comparable.
    embedding_model: str = "BAAI/bge-small-en-v1.5"
    embedding_fallback_model: str = "sentence-transformers/all-MiniLM-L6-v2"
    # When true the embedding service ALWAYS uses the fallback (useful for offline
    # development, CI, or when bge weights aren't permitted in your environment).
    embedding_force_fallback: bool = False
    spacy_model: str = "en_core_web_sm"
    rate_limit: str = "60/minute"
    # Entity canonicalization: when true, surface forms are looked up against Wikidata's
    # wbsearchentities API on first sight (cached locally afterwards). Off by default
    # to keep the platform fully offline; turn on for richer alias coverage.
    wikidata_lookup: bool = False

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
