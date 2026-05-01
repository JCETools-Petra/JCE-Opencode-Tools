# Skill: DevOps & Infrastructure
# Loaded on-demand when task involves Docker, CI/CD, deployment, or monitoring

---

## 7.1 Docker Best Practices

```dockerfile
# Multi-stage build
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production image
FROM node:22-alpine AS runtime
RUN addgroup -S app && adduser -S app -G app
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
USER app
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost:3000/health || exit 1
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

- **Pin base image digests** for reproducibility: `FROM node:22-alpine@sha256:abc123`
- **Non-root user** — always
- **Multi-stage builds** — separate build and runtime
- **Minimal base images** — Alpine or distroless
- **One process per container**
- **No secrets in images** — use runtime env vars or secret mounts
- **Layer caching** — copy dependency files before source code
- **.dockerignore** — exclude node_modules, .git, .env, tests, docs

---

## 7.2 CI/CD Pipeline

**Every push should trigger:**
1. **Lint** — code style and static analysis
2. **Typecheck** — type safety verification
3. **Test** — unit and integration tests
4. **Security scan** — dependency audit, SAST
5. **Build** — verify the project compiles/bundles
6. **Preview deploy** — for PRs (Vercel, Netlify, etc.)

**Deployment strategies:**
- **Blue-Green** — two identical environments, switch traffic instantly
- **Canary** — route 1-5% traffic to new version, monitor, expand
- **Rolling** — gradually replace instances (Kubernetes default)
- **Feature flags** — deploy code dark, enable per-user/percentage

**Rollback plan:**
- Every deployment must be reversible within 5 minutes
- Database migrations must be backward-compatible (expand-contract pattern)
- Keep N-1 version artifacts available for instant rollback

---

## 7.3 Monitoring & Observability

**Three pillars:**
- **Logs** — structured (JSON), correlation IDs, appropriate levels
- **Metrics** — RED method (Rate, Errors, Duration) for services
- **Traces** — distributed tracing (OpenTelemetry) for request flow

**SLOs/SLIs/SLAs:**
- **SLI** (indicator): "99.2% of requests complete in < 500ms"
- **SLO** (objective): "99.9% availability over 30 days"
- **Error budget**: 100% - SLO = allowed downtime (43 min/month for 99.9%)
- When error budget is exhausted: freeze features, focus on reliability

**Alerting rules:**
- Alert on symptoms (error rate > 1%), not causes (CPU > 80%)
- Every alert must be actionable — if you can't do anything, don't alert
- Runbook link in every alert
- Page only for customer-impacting issues; everything else is a ticket

**Structured logging:**
```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "level": "error",
  "service": "payment-api",
  "traceId": "abc123",
  "userId": "usr_456",
  "message": "Payment processing failed",
  "error": { "code": "INSUFFICIENT_FUNDS", "provider": "stripe" },
  "duration_ms": 1250
}
```

---

## 7.4 Infrastructure as Code

- **All infrastructure is code** — no manual console changes
- **Terraform/Pulumi/CDK** for cloud resources
- **Version controlled** — same review process as application code
- **State management** — remote state with locking (S3 + DynamoDB)
- **Modular** — reusable modules for common patterns
- **Drift detection** — alert when actual state diverges from code
- **Blast radius** — use workspaces/stacks to isolate environments

---

## 7.5 Monorepo Patterns

When using monorepos (Turborepo, Nx, pnpm workspaces):
- **Shared packages** — common types, utilities, UI components
- **Build caching** — remote cache for CI (Turborepo Remote Cache)
- **Affected-only** — only test/build packages that changed
- **Consistent tooling** — same linter, formatter, test runner across packages
- **Dependency boundaries** — enforce import rules between packages
- **Independent versioning** — each package has its own version (changesets)
