# Skill: Architecture & Backend
# Loaded on-demand when task involves system design, API design (REST/GraphQL/gRPC/WebSocket), database patterns, error handling/resilience, or caching

---

## 5. Architecture & Backend

### 5.1 System Design Principles

**Choose architecture based on actual needs, not hype:**

| Scale | Architecture | When |
|-------|-------------|------|
| 0-100K users | **Monolith** | Start here. Always. |
| 100K-1M users | **Modular monolith** | Split by domain, deploy together |
| 1M+ users | **Microservices** | Only when team/scale demands it |

**Domain-Driven Design (DDD) — when complexity warrants it:**
- **Bounded Contexts** — each domain has its own models and language
- **Aggregates** — consistency boundaries; one transaction per aggregate
- **Domain Events** — communicate between contexts asynchronously
- **Ubiquitous Language** — code uses the same terms as the business

**Event-Driven Architecture:**
```
Producer -> Event Bus (Kafka/RabbitMQ/SQS) -> Consumer(s)

Benefits: decoupling, scalability, audit trail
Costs: eventual consistency, debugging complexity, ordering challenges
```

### 5.2 API Design

**REST conventions:**
- Use nouns for resources: `/users`, `/orders`, `/products`
- Use HTTP methods correctly: GET (read), POST (create), PUT (replace), PATCH (update), DELETE (remove)
- Return appropriate status codes: 200, 201, 204, 400, 401, 403, 404, 409, 422, 429, 500
- Version your API: `/api/v1/users` or `Accept: application/vnd.api.v1+json`
- Use pagination: `?page=1&limit=20` or cursor-based `?cursor=abc123&limit=20`
- HATEOAS for discoverability (when appropriate)

**GraphQL patterns:**
- **DataLoader** for N+1 prevention — batch and cache within a request
- **Complexity limits** — prevent deeply nested queries from DOSing your server
- **Persisted queries** — whitelist allowed queries in production
- **Schema-first design** — define schema, then implement resolvers

**gRPC patterns:**
- Use for internal service-to-service communication
- Define `.proto` files as the contract
- Use streaming for real-time data (server-stream, client-stream, bidirectional)
- Implement health checks and graceful shutdown

**WebSocket & Real-time:**
```typescript
// Pattern: Room-based pub/sub
socket.join(`project:${projectId}`);
io.to(`project:${projectId}`).emit("update", payload);

// Always handle: reconnection, heartbeat, backpressure
// Use SSE (Server-Sent Events) for one-way server->client streams
// Use WebSocket for bidirectional real-time
```

**API rate limiting response:**
```
HTTP/1.1 429 Too Many Requests
Retry-After: 60
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1625097600
```

### 5.3 Database Patterns

**Query optimization:**
```sql
-- Always EXPLAIN before optimizing
EXPLAIN ANALYZE SELECT * FROM orders WHERE user_id = 123 AND status = 'pending';

-- Index strategy
CREATE INDEX idx_orders_user_status ON orders(user_id, status);  -- composite for common queries
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);   -- for sorting
-- Partial index for hot queries
CREATE INDEX idx_orders_pending ON orders(user_id) WHERE status = 'pending';
```

**Connection pooling:**
- Use a connection pool (PgBouncer, HikariCP, `pool` option in ORMs)
- Pool size = (core_count * 2) + effective_spindle_count (for PostgreSQL)
- Set connection timeout, idle timeout, max lifetime
- Monitor pool exhaustion — alert when waiting for connections

**Migration best practices:**
- Every migration is reversible (has `up` AND `down`)
- Never modify a deployed migration — create a new one
- Separate schema migrations from data migrations
- Run migrations in a transaction where supported
- Test migrations against production-size data (not just empty DB)

**Scaling patterns:**
- **Read replicas** — route reads to replicas, writes to primary
- **Sharding** — partition data by tenant/region/hash (last resort)
- **CQRS** — separate read model (denormalized, fast) from write model (normalized, consistent)
- **Event Sourcing** — store events, derive state; perfect audit trail

### 5.4 Error Handling & Resilience

**Circuit Breaker pattern:**
```
CLOSED -> (failures exceed threshold) -> OPEN -> (timeout) -> HALF-OPEN -> (success) -> CLOSED
                                                             -> (failure) -> OPEN
```

- **Retry with exponential backoff + jitter** for transient failures
- **Timeouts on everything** — HTTP (30s), DB (5s), cache (1s)
- **Bulkhead** — isolate resources per service/tenant to prevent noisy neighbor
- **Graceful degradation** — if recommendations fail, show popular items
- **Dead letter queues** — failed messages go to DLQ for manual inspection
- **Idempotency keys** — client sends unique key, server deduplicates

**Distributed transactions (Saga pattern):**
```
Order Created -> Payment Charged -> Inventory Reserved -> Shipping Scheduled
     | (if any fails)
Order Cancelled <- Payment Refunded <- Inventory Released <- Shipping Cancelled
```

### 5.5 Caching Strategy

**Cache layers:**
```
Client (browser cache, service worker)
  -> CDN (static assets, API responses)
    -> Application cache (Redis/Memcached)
      -> Database query cache
        -> Database
```

**Cache invalidation strategies:**
- **TTL** — simplest, set expiry time (good for 90% of cases)
- **Write-through** — update cache on every write
- **Write-behind** — batch writes to DB, serve from cache
- **Cache-aside** — app checks cache, falls back to DB, populates cache
- **Event-driven invalidation** — publish event on change, subscribers invalidate

**Cache stampede prevention:**
- **Locking** — only one request rebuilds cache, others wait
- **Stale-while-revalidate** — serve stale, rebuild in background
- **Probabilistic early expiration** — randomly refresh before TTL
