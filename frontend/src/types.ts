export type Role = "admin" | "analyst" | "user";

export interface User {
  id: string;
  email: string;
  role: Role;
}

export interface AuthState {
  token: string;
  user: User;
}

export interface Article {
  id: string;
  title: string;
  summary?: string | null;
  author?: string | null;
  source?: string | null;
  url: string;
  image_url?: string | null;
  published_at?: string | null;
  sentiment?: number | null;
  created_at: string;
}

export interface ArticleDetail extends Article {
  content: string;
  entities: Entity[];
}

export interface Entity {
  id: string;
  name: string;
  type: string;
  description?: string | null;
  mentions: number;
}

export interface EntityDetail extends Entity {
  relationships: RelationshipRow[];
  timeline: TimelinePoint[];
  articles: Article[];
}

export interface RelationshipRow {
  id: string;
  source_entity: string;
  target_entity: string;
  source_name?: string;
  target_name?: string;
  relation_type: string;
  confidence: number;
  weight: number;
  observed_at: string;
}

export interface TimelinePoint {
  date: string;
  article_id: string;
  title: string;
}

export interface GraphNode {
  id: string;
  label: string;
  type: string;
  mentions: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  confidence: number;
  weight: number;
}

export interface GraphResponse {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface SearchHit {
  kind: "article" | "entity";
  id: string;
  title: string;
  snippet?: string | null;
  score: number;
}

export interface AskResponse {
  answer: string;
  sources: Article[];
  entities: Entity[];
}

export interface Source {
  id: string;
  name: string;
  kind: "rss" | "sitemap" | "url";
  url: string;
  enabled: boolean;
  last_run_at?: string | null;
}

export interface Watchlist {
  id: string;
  entity_id: string;
  entity_name?: string;
  created_at: string;
}

export interface Alert {
  id: string;
  entity_id: string;
  entity_name?: string;
  article_id: string;
  article_title?: string;
  reason: string;
  created_at: string;
  seen: boolean;
}

export interface PathStep {
  relationship_id: string;
  source_entity_id: string;
  source_entity_name?: string;
  target_entity_id: string;
  target_entity_name?: string;
  relation_type: string;
  confidence: number;
  weight: number;
  article_id?: string | null;
}

export interface PathInfo {
  from_id: string;
  from_name?: string;
  to_id: string;
  to_name?: string;
  length: number;
  chain_names: string[];
  steps: PathStep[];
}

export interface PairAnalysis {
  from_id: string;
  from_name?: string;
  to_id: string;
  to_name?: string;
  paths: PathInfo[];
  direct: boolean;
  indirect: boolean;
}

export interface HypothesisResponse {
  statement: string;
  pairs: PairAnalysis[];
  supporting_articles: Article[];
  ai_generated: boolean;
}

export type EntityType = "Person" | "Company" | "Organization" | "Country" | "Event" | "Product" | "Technology" | "Narrative" | "Concept";
