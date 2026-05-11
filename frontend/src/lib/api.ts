import type {
  Alert, Article, ArticleDetail, ArgumentResponse, AskResponse, AuthState, Entity, EntityDetail, EntityType,
  GraphResponse, HypothesisResponse, Interest, PathInfo, SearchHit, Source, Watchlist,
} from "@/types";

const BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";
const STORAGE_KEY = "newsgraph_auth";

export function getAuth(): AuthState | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as AuthState; } catch { return null; }
}

export function setAuth(state: AuthState | null): void {
  if (typeof window === "undefined") return;
  if (state) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  else window.localStorage.removeItem(STORAGE_KEY);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const auth = getAuth();
  const headers: Record<string, string> = { "Content-Type": "application/json", ...(init?.headers as object || {}) };
  if (auth) headers["Authorization"] = `Bearer ${auth.token}`;
  const res = await fetch(`${BASE}${path}`, { ...init, headers, cache: "no-store" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  async login(email: string, password: string): Promise<AuthState> {
    const body = new URLSearchParams({ username: email, password });
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body,
    });
    if (!res.ok) throw new Error("Login failed — check credentials.");
    const data = await res.json();
    const state: AuthState = { token: data.access_token, user: data.user };
    setAuth(state);
    return state;
  },
  async register(email: string, password: string, role: "user" | "analyst" = "user") {
    return request<unknown>("/api/auth/register", {
      method: "POST", body: JSON.stringify({ email, password, role }),
    });
  },
  logout() { setAuth(null); },

  articles: (offset = 0, limit = 20) => request<Article[]>(`/api/articles?offset=${offset}&limit=${limit}`),
  article: (id: string) => request<ArticleDetail>(`/api/articles/${id}`),

  entities: (q = "", type = "", limit = 30) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (type) params.set("type", type);
    params.set("limit", String(limit));
    return request<Entity[]>(`/api/entities?${params.toString()}`);
  },
  entity: (id: string) => request<EntityDetail>(`/api/entities/${id}`),

  graph: (entityId: string, depth = 1, limit = 80) =>
    request<GraphResponse>(`/api/graph/${entityId}?depth=${depth}&limit=${limit}`),
  centrality: (top = 25) => request<{ entity_id: string; name: string; type: string; degree: number }[]>(
    `/api/graph/top/centrality?top=${top}`
  ),
  multiGraph: (entity_ids: string[], depth = 1, limit = 120) =>
    request<GraphResponse>("/api/graph/multi", { method: "POST", body: JSON.stringify({ entity_ids, depth, limit }) }),
  paths: (src: string, dst: string, max_hops = 3, max_paths = 5) =>
    request<PathInfo[]>(`/api/graph/path/${src}/${dst}?max_hops=${max_hops}&max_paths=${max_paths}`),
  hypothesis: (entity_ids: string[], max_hops = 3, max_paths_per_pair = 3) =>
    request<HypothesisResponse>("/api/hypothesis", { method: "POST", body: JSON.stringify({ entity_ids, max_hops, max_paths_per_pair }) }),
  createEntity: (name: string, type: EntityType = "Concept", description?: string) =>
    request<Entity>("/api/entities", { method: "POST", body: JSON.stringify({ name, type, description }) }),

  interests: () => request<Interest[]>("/api/interests"),
  addInterest: (keyword: string, priority = 5) =>
    request<Interest>("/api/interests", { method: "POST", body: JSON.stringify({ keyword, priority }) }),
  removeInterest: (id: string) =>
    request<{ ok: true }>(`/api/interests/${id}`, { method: "DELETE" }),

  buildArgument: (subject_id: string, outcome_id: string, theme_id?: string, min_confidence = 0.5, max_hops = 4) =>
    request<ArgumentResponse>("/api/argument", {
      method: "POST",
      body: JSON.stringify({ subject_id, outcome_id, theme_id, min_confidence, max_hops }),
    }),

  search: (q: string, mode: "keyword" | "semantic" | "entity" = "keyword") =>
    request<SearchHit[]>("/api/search", { method: "POST", body: JSON.stringify({ q, mode, limit: 25 }) }),

  ask: (question: string) =>
    request<AskResponse>("/api/ask", { method: "POST", body: JSON.stringify({ question }) }),

  scopedInsight: (payload: {
    subject_id: string;
    relationship_ids: string[];
    entity_ids: string[];
    rel_type_filter?: string;
    entity_type_filter?: string;
  }) => request<AskResponse>("/api/insights/scoped", {
    method: "POST", body: JSON.stringify(payload),
  }),

  sources: () => request<Source[]>("/api/ingest/sources"),
  addSource: (s: { name: string; kind: "rss" | "sitemap" | "url"; url: string }) =>
    request<Source>("/api/ingest/sources", { method: "POST", body: JSON.stringify(s) }),
  runIngest: () => request<{ queued: true }>("/api/ingest/run", { method: "POST" }),

  watchlists: () => request<Watchlist[]>("/api/watchlists"),
  addWatchlist: (entity_id: string) =>
    request<Watchlist>("/api/watchlists", { method: "POST", body: JSON.stringify({ entity_id }) }),
  alerts: () => request<Alert[]>("/api/alerts"),
};
