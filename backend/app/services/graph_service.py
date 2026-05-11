"""SQL-backed graph service. Swap with a Neo4j adapter when scale demands."""
from __future__ import annotations

from collections import defaultdict, deque
from typing import Iterable

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from ..models import Article, ArticleEntity, Entity, Relationship_
from ..schemas import GraphEdge, GraphNode, GraphResponse, PathInfo, PathStep, TimelinePoint
from ..services.embedding_service import cosine


def upsert_entity(db: Session, name: str, name_norm: str, type_: str) -> Entity:
    existing = db.execute(
        select(Entity).where(Entity.name_norm == name_norm, Entity.type == type_)
    ).scalar_one_or_none()
    if existing:
        return existing
    ent = Entity(name=name, name_norm=name_norm, type=type_)
    db.add(ent)
    db.flush()
    return ent


def upsert_article_entity(db: Session, article_id: str, entity_id: str, occurrences: int) -> None:
    existing = db.execute(
        select(ArticleEntity).where(
            ArticleEntity.article_id == article_id,
            ArticleEntity.entity_id == entity_id,
        )
    ).scalar_one_or_none()
    if existing:
        existing.occurrences += occurrences
    else:
        db.add(ArticleEntity(article_id=article_id, entity_id=entity_id, occurrences=occurrences))


def upsert_relationship(
    db: Session,
    source_id: str,
    target_id: str,
    relation_type: str,
    confidence: float,
    article_id: str,
    observed_at,
) -> None:
    # Dedup at (source, target, type) level — accumulate weight instead of inserting duplicates.
    existing = db.execute(
        select(Relationship_).where(
            Relationship_.source_entity == source_id,
            Relationship_.target_entity == target_id,
            Relationship_.relation_type == relation_type,
        )
    ).scalar_one_or_none()
    if existing:
        existing.weight += 1.0
        existing.confidence = max(existing.confidence, confidence)
        existing.observed_at = max(existing.observed_at, observed_at)
        return
    db.add(Relationship_(
        source_entity=source_id, target_entity=target_id,
        relation_type=relation_type, confidence=confidence, weight=1.0,
        article_id=article_id, observed_at=observed_at,
    ))


def neighbourhood(db: Session, entity_id: str, depth: int = 1, limit: int = 80) -> GraphResponse:
    seeds = {entity_id}
    frontier = {entity_id}
    edges: list[Relationship_] = []
    for _ in range(max(1, depth)):
        if not frontier:
            break
        next_edges = db.execute(
            select(Relationship_).where(
                or_(
                    Relationship_.source_entity.in_(frontier),
                    Relationship_.target_entity.in_(frontier),
                )
            ).limit(limit * 3)
        ).scalars().all()
        edges.extend(next_edges)
        frontier = {e.target_entity for e in next_edges if e.source_entity in seeds} | \
                   {e.source_entity for e in next_edges if e.target_entity in seeds}
        seeds.update(frontier)

    if len(seeds) > limit:
        # Trim to the highest-mention entities for readability.
        ranked = db.execute(
            select(Entity).where(Entity.id.in_(seeds)).order_by(Entity.mentions.desc()).limit(limit)
        ).scalars().all()
        keep = {e.id for e in ranked}
        keep.add(entity_id)
    else:
        keep = seeds

    ent_rows = db.execute(select(Entity).where(Entity.id.in_(keep))).scalars().all()
    nodes = [GraphNode(id=e.id, label=e.name, type=e.type, mentions=e.mentions) for e in ent_rows]

    edge_objs: list[GraphEdge] = []
    seen_edge: set[tuple[str, str, str]] = set()
    for e in edges:
        if e.source_entity not in keep or e.target_entity not in keep:
            continue
        key = (e.source_entity, e.target_entity, e.relation_type)
        if key in seen_edge:
            continue
        seen_edge.add(key)
        edge_objs.append(GraphEdge(
            id=e.id, source=e.source_entity, target=e.target_entity,
            type=e.relation_type, confidence=e.confidence, weight=e.weight,
        ))

    return GraphResponse(nodes=nodes, edges=edge_objs)


def entity_timeline(db: Session, entity_id: str, limit: int = 50) -> list[TimelinePoint]:
    rows = db.execute(
        select(Article).join(ArticleEntity, ArticleEntity.article_id == Article.id)
        .where(ArticleEntity.entity_id == entity_id)
        .order_by(Article.published_at.desc().nulls_last(), Article.created_at.desc())
        .limit(limit)
    ).scalars().all()
    return [
        TimelinePoint(
            date=a.published_at or a.created_at,
            article_id=a.id,
            title=a.title,
        )
        for a in rows
    ]


def entity_articles(db: Session, entity_id: str, limit: int = 50) -> list[Article]:
    return db.execute(
        select(Article).join(ArticleEntity, ArticleEntity.article_id == Article.id)
        .where(ArticleEntity.entity_id == entity_id)
        .order_by(Article.created_at.desc())
        .limit(limit)
    ).scalars().all()


def entity_relationships(db: Session, entity_id: str, limit: int = 100) -> list[Relationship_]:
    return db.execute(
        select(Relationship_).where(
            or_(Relationship_.source_entity == entity_id, Relationship_.target_entity == entity_id)
        ).order_by(Relationship_.weight.desc()).limit(limit)
    ).scalars().all()


# ---------- Centrality (degree-based — fast, no NetworkX dependency) ----------
def top_entities(db: Session, type_: str | None, limit: int) -> Iterable[Entity]:
    stmt = select(Entity).order_by(Entity.mentions.desc()).limit(limit)
    if type_:
        stmt = select(Entity).where(Entity.type == type_).order_by(Entity.mentions.desc()).limit(limit)
    return db.execute(stmt).scalars().all()


def degree_centrality(db: Session, top: int = 25) -> list[tuple[Entity, int]]:
    rels = db.execute(select(Relationship_)).scalars().all()
    deg: dict[str, int] = defaultdict(int)
    for r in rels:
        deg[r.source_entity] += 1
        deg[r.target_entity] += 1
    if not deg:
        return []
    top_ids = sorted(deg.items(), key=lambda kv: kv[1], reverse=True)[:top]
    ent_map = {
        e.id: e for e in db.execute(
            select(Entity).where(Entity.id.in_([i for i, _ in top_ids]))
        ).scalars().all()
    }
    return [(ent_map[i], d) for i, d in top_ids if i in ent_map]


def entity_similarity(db: Session, entity_id: str, limit: int = 10) -> list[tuple[Entity, float]]:
    base = db.get(Entity, entity_id)
    if not base or not base.embedding:
        return []
    candidates = db.execute(
        select(Entity).where(Entity.id != entity_id, Entity.type == base.type).limit(500)
    ).scalars().all()
    scored = [(c, cosine(base.embedding, c.embedding)) for c in candidates if c.embedding]
    scored.sort(key=lambda x: x[1], reverse=True)
    return scored[:limit]


# ---------- Multi-entity & path finding ----------
def multi_neighbourhood(db: Session, entity_ids: list[str], depth: int = 1, limit: int = 120) -> GraphResponse:
    """Union of neighbourhoods around several seed entities, with cross-edges between them."""
    seeds = set(entity_ids)
    frontier = set(entity_ids)
    edges_collected: list[Relationship_] = []
    for _ in range(max(1, depth)):
        if not frontier:
            break
        edges = db.execute(
            select(Relationship_).where(
                or_(
                    Relationship_.source_entity.in_(frontier),
                    Relationship_.target_entity.in_(frontier),
                )
            ).limit(limit * 4)
        ).scalars().all()
        edges_collected.extend(edges)
        new_frontier = set()
        for e in edges:
            if e.source_entity not in seeds:
                new_frontier.add(e.source_entity)
            if e.target_entity not in seeds:
                new_frontier.add(e.target_entity)
        frontier = new_frontier
        seeds.update(new_frontier)

    if len(seeds) > limit:
        ranked = db.execute(
            select(Entity).where(Entity.id.in_(seeds)).order_by(Entity.mentions.desc()).limit(limit)
        ).scalars().all()
        keep = {e.id for e in ranked}
        for sid in entity_ids:
            keep.add(sid)
    else:
        keep = seeds

    ent_rows = db.execute(select(Entity).where(Entity.id.in_(keep))).scalars().all()
    nodes = [GraphNode(id=e.id, label=e.name, type=e.type, mentions=e.mentions) for e in ent_rows]

    seen: set[tuple[str, str, str]] = set()
    edge_objs: list[GraphEdge] = []
    for e in edges_collected:
        if e.source_entity not in keep or e.target_entity not in keep:
            continue
        k = (e.source_entity, e.target_entity, e.relation_type)
        if k in seen:
            continue
        seen.add(k)
        edge_objs.append(GraphEdge(
            id=e.id, source=e.source_entity, target=e.target_entity,
            type=e.relation_type, confidence=e.confidence, weight=e.weight,
        ))
    return GraphResponse(nodes=nodes, edges=edge_objs)


def _load_adjacency(db: Session, max_edges: int = 50000) -> dict[str, list[tuple[str, Relationship_]]]:
    """Load the whole relationship table into an undirected adjacency list. Suitable for graphs up to ~50K edges."""
    adj: dict[str, list[tuple[str, Relationship_]]] = defaultdict(list)
    rows = db.execute(select(Relationship_).limit(max_edges)).scalars().all()
    for e in rows:
        adj[e.source_entity].append((e.target_entity, e))
        adj[e.target_entity].append((e.source_entity, e))
    return adj


def find_paths(
    db: Session,
    src_id: str,
    dst_id: str,
    max_hops: int = 3,
    max_paths: int = 3,
    adj: dict[str, list[tuple[str, Relationship_]]] | None = None,
) -> list[list[Relationship_]]:
    """Breadth-first search for up to ``max_paths`` shortest paths between two entities (undirected)."""
    if src_id == dst_id:
        return []
    if adj is None:
        adj = _load_adjacency(db)
    if src_id not in adj or dst_id not in adj:
        return []
    paths: list[list[Relationship_]] = []
    # BFS — each queue entry is (current_node, edges_so_far, visited_set)
    queue: deque[tuple[str, list[Relationship_], frozenset[str]]] = deque()
    queue.append((src_id, [], frozenset({src_id})))
    while queue:
        node, path, visited = queue.popleft()
        if len(path) >= max_hops:
            continue
        for neighbour, edge in adj.get(node, []):
            if neighbour in visited:
                continue
            new_path = path + [edge]
            if neighbour == dst_id:
                paths.append(new_path)
                if len(paths) >= max_paths:
                    return paths
            else:
                queue.append((neighbour, new_path, visited | {neighbour}))
    return paths


def edges_to_path_info(
    edges: list[Relationship_],
    src_id: str,
    dst_id: str,
    entity_map: dict[str, Entity],
) -> PathInfo:
    """Convert an ordered list of edges (BFS path) into a PathInfo with chain names."""
    chain_ids: list[str] = [src_id]
    current = src_id
    steps: list[PathStep] = []
    for edge in edges:
        nxt = edge.target_entity if edge.source_entity == current else edge.source_entity
        chain_ids.append(nxt)
        steps.append(PathStep(
            relationship_id=edge.id,
            source_entity_id=current,
            source_entity_name=entity_map[current].name if current in entity_map else None,
            target_entity_id=nxt,
            target_entity_name=entity_map[nxt].name if nxt in entity_map else None,
            relation_type=edge.relation_type,
            confidence=edge.confidence,
            weight=edge.weight,
            article_id=edge.article_id,
        ))
        current = nxt
    return PathInfo(
        from_id=src_id,
        from_name=entity_map[src_id].name if src_id in entity_map else None,
        to_id=dst_id,
        to_name=entity_map[dst_id].name if dst_id in entity_map else None,
        length=len(edges),
        chain_names=[entity_map[i].name if i in entity_map else i for i in chain_ids],
        steps=steps,
    )
