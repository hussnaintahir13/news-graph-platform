from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, Field


# ---------- Auth ----------
class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    role: Literal["admin", "analyst", "user"] = "user"


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    email: EmailStr
    role: str

    class Config:
        from_attributes = True


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ---------- Sources / ingest ----------
class SourceCreate(BaseModel):
    name: str
    kind: Literal["rss", "sitemap", "url"]
    url: str
    enabled: bool = True


class SourceOut(BaseModel):
    id: str
    name: str
    kind: str
    url: str
    enabled: bool
    last_run_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ---------- Articles ----------
class ArticleOut(BaseModel):
    id: str
    title: str
    summary: Optional[str]
    author: Optional[str]
    source: Optional[str]
    url: str
    image_url: Optional[str]
    published_at: Optional[datetime]
    sentiment: Optional[float]
    created_at: datetime

    class Config:
        from_attributes = True


class ArticleDetail(ArticleOut):
    content: str
    entities: list["EntityOut"] = []


# ---------- Entities ----------
class EntityOut(BaseModel):
    id: str
    name: str
    type: str
    description: Optional[str] = None
    mentions: int = 0

    class Config:
        from_attributes = True


class EntityCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    type: Literal["Person", "Company", "Organization", "Country", "Event", "Product", "Technology", "Narrative", "Concept"] = "Concept"
    description: Optional[str] = None


class EntityDetail(EntityOut):
    relationships: list["RelationshipOut"] = []
    timeline: list["TimelinePoint"] = []
    articles: list[ArticleOut] = []


# ---------- Relationships ----------
class RelationshipOut(BaseModel):
    id: str
    source_entity: str
    target_entity: str
    source_name: Optional[str] = None
    target_name: Optional[str] = None
    relation_type: str
    confidence: float
    weight: float
    observed_at: datetime

    class Config:
        from_attributes = True


# ---------- Graph ----------
class GraphNode(BaseModel):
    id: str
    label: str
    type: str
    mentions: int = 0


class GraphEdge(BaseModel):
    id: str
    source: str
    target: str
    type: str
    confidence: float
    weight: float


class GraphResponse(BaseModel):
    nodes: list[GraphNode]
    edges: list[GraphEdge]


class TimelinePoint(BaseModel):
    date: datetime
    article_id: str
    title: str


# ---------- Multi-entity / paths / hypothesis ----------
class MultiGraphRequest(BaseModel):
    entity_ids: list[str]
    depth: int = 1
    limit: int = 120


class PathStep(BaseModel):
    relationship_id: str
    source_entity_id: str
    source_entity_name: Optional[str] = None
    target_entity_id: str
    target_entity_name: Optional[str] = None
    relation_type: str
    confidence: float
    weight: float
    article_id: Optional[str] = None


class PathInfo(BaseModel):
    from_id: str
    from_name: Optional[str] = None
    to_id: str
    to_name: Optional[str] = None
    length: int
    chain_names: list[str] = []  # ordered chain of entity names along the path
    steps: list[PathStep] = []


class PairAnalysis(BaseModel):
    from_id: str
    from_name: Optional[str] = None
    to_id: str
    to_name: Optional[str] = None
    paths: list[PathInfo] = []
    direct: bool = False
    indirect: bool = False


class HypothesisRequest(BaseModel):
    entity_ids: list[str]
    max_hops: int = 3
    max_paths_per_pair: int = 3


class HypothesisResponse(BaseModel):
    statement: str
    pairs: list[PairAnalysis] = []
    supporting_articles: list[ArticleOut] = []
    ai_generated: bool = False


# ---------- Argument construction (chained-evidence reasoning) ----------
class ArgumentRequest(BaseModel):
    subject_id: str
    outcome_id: str
    theme_id: Optional[str] = None
    max_hops: int = 4
    min_confidence: float = 0.5


class ArgumentPremise(BaseModel):
    n: int
    source_name: str
    target_name: str
    relation_type: str
    relation_verb: str
    confidence: float
    article_id: Optional[str] = None
    article_title: Optional[str] = None
    article_quote: Optional[str] = None


class ArgumentResponse(BaseModel):
    can_construct: bool
    decline_reason: Optional[str] = None
    subject_name: Optional[str] = None
    outcome_name: Optional[str] = None
    theme_name: Optional[str] = None
    chain_names: list[str] = []
    premises: list[ArgumentPremise] = []
    conclusion: str = ""
    conclusion_template: str = ""
    confidence_band: Literal["very-low", "low", "moderate", "high"] = "very-low"
    supporting_articles: list[ArticleOut] = []


# ---------- Search ----------
class SearchRequest(BaseModel):
    q: str
    mode: Literal["keyword", "semantic", "entity"] = "keyword"
    limit: int = 20


class SearchHit(BaseModel):
    kind: Literal["article", "entity"]
    id: str
    title: str
    snippet: Optional[str] = None
    score: float = 0.0


# ---------- AI ----------
class AskRequest(BaseModel):
    question: str


class AskResponse(BaseModel):
    answer: str
    sources: list[ArticleOut] = []
    entities: list[EntityOut] = []


# ---------- Watchlists / alerts ----------
class WatchlistCreate(BaseModel):
    entity_id: str


class WatchlistOut(BaseModel):
    id: str
    entity_id: str
    entity_name: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class InterestCreate(BaseModel):
    keyword: str = Field(min_length=2, max_length=255)
    priority: int = 5


class InterestOut(BaseModel):
    id: str
    keyword: str
    priority: int
    created_at: datetime

    class Config:
        from_attributes = True


class AlertOut(BaseModel):
    id: str
    entity_id: str
    entity_name: Optional[str] = None
    article_id: str
    article_title: Optional[str] = None
    reason: str
    created_at: datetime
    seen: bool

    class Config:
        from_attributes = True


# Forward refs
ArticleDetail.model_rebuild()
EntityDetail.model_rebuild()
