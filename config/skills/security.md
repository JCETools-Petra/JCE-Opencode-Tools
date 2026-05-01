# Skill: Security & Hardening
# Loaded on-demand when task involves input validation, auth, OAuth2, JWT, OWASP, secrets, network security, path safety, or rate limiting

---

## 4. Security & Hardening

### 4.1 Input Validation

**All external input is untrusted.** This includes:
- User input (forms, CLI args, query params)
- File contents (JSON, YAML, CSV, uploaded files)
- API responses from third-party services
- Environment variables
- URL parameters and headers
- WebSocket messages
- Deserialized data from caches/queues

**Validation rules:**
- Validate type, length, format, and range
- Use allowlists over denylists — define what IS valid, not what isn't
- Validate on the server/backend even if the client validates too
- Sanitize output for the target context (HTML -> escape, SQL -> parameterize)
- Reject early — fail at the boundary, not deep in business logic

### 4.2 Authentication & Authorization

**Authentication (who are you?):**

```
┌─────────────────────────────────────────────────┐
│              OAuth2 / OIDC Flow                  │
├─────────────────────────────────────────────────┤
│  1. User clicks "Login with Provider"           │
│  2. Redirect to provider's /authorize           │
│  3. User authenticates with provider            │
│  4. Provider redirects back with auth code      │
│  5. Backend exchanges code for tokens           │
│  6. Backend validates ID token, creates session │
│  7. Return session cookie to client             │
└─────────────────────────────────────────────────┘
```

**JWT best practices:**
- Short expiry (15 min access token, 7 day refresh token)
- Store refresh tokens server-side (database), not in localStorage
- Include only necessary claims — JWTs are not encrypted by default
- Validate: signature, expiry, issuer, audience on EVERY request
- Use `RS256` (asymmetric) for distributed systems, `HS256` for single-service

**Authorization (what can you do?):**
- **RBAC** (Role-Based): user has roles, roles have permissions
- **ABAC** (Attribute-Based): policies based on user/resource/environment attributes
- **Check permissions on every request** — never trust client-side checks alone
- **Deny by default** — explicitly grant, never implicitly allow
- **Resource-level authorization** — user can edit THEIR posts, not ALL posts

### 4.3 OWASP Top 10 Awareness

| Risk | Prevention |
|------|-----------|
| **Injection** (SQL, NoSQL, OS command) | Parameterized queries, array-form spawn, ORMs |
| **Broken Authentication** | MFA, secure session management, rate limiting |
| **Sensitive Data Exposure** | Encrypt at rest (AES-256) and in transit (TLS 1.3) |
| **XML External Entities (XXE)** | Disable external entity processing |
| **Broken Access Control** | Deny by default, validate on every request |
| **Security Misconfiguration** | Minimal permissions, disable defaults, automate config |
| **Cross-Site Scripting (XSS)** | Context-aware encoding, CSP headers, sanitize HTML |
| **Insecure Deserialization** | Validate schemas, use safe formats (JSON over pickle) |
| **Known Vulnerabilities** | Automated dependency scanning in CI |
| **Insufficient Logging** | Log auth events, access patterns, anomalies |

### 4.4 Secrets Management

- **Never hardcode secrets** — use environment variables or secret managers (Vault, AWS Secrets Manager)
- **Never commit secrets** — use `.gitignore`, pre-commit hooks, git-secrets
- **Never log secrets** — redact sensitive values in log output
- **Rotate secrets regularly** — automate rotation where possible
- **Use least privilege** — each service gets only the permissions it needs
- **Encrypt secrets at rest** — even in environment variables on disk

### 4.5 Network Security

**CORS (Cross-Origin Resource Sharing):**
```typescript
// ✅ Specific origins, not wildcard
cors({
  origin: ["https://app.example.com", "https://admin.example.com"],
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true,
  maxAge: 86400, // preflight cache 24h
});

// ❌ Never in production
cors({ origin: "*" })
```

**Security headers (helmet.js or manual):**
```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

**TLS/HTTPS:**
- TLS 1.3 minimum (disable TLS 1.0, 1.1, 1.2 where possible)
- HSTS with preload for production domains
- Certificate pinning for mobile apps
- Redirect all HTTP to HTTPS (301)

### 4.6 Path & Command Safety

```typescript
// ❌ DANGEROUS — command injection
execSync(`git clone ${userUrl}`)

// ✅ SAFE — array form, no shell interpretation
spawn("git", ["clone", userUrl])

// ❌ DANGEROUS — path traversal
readFile(join(baseDir, userInput))

// ✅ SAFE — validate resolved path
const resolved = resolve(join(baseDir, userInput))
if (!resolved.startsWith(resolve(baseDir))) throw new Error("Path traversal")

// ❌ DANGEROUS — prototype pollution
Object.assign(config, userInput)

// ✅ SAFE — validate keys, use Map or structured clone
const safeInput = pick(userInput, ["name", "email", "age"]);
```

### 4.7 Rate Limiting & Abuse Prevention

- **Rate limit all public endpoints** — especially auth, search, file upload
- **Sliding window** over fixed window (smoother, harder to game)
- **Per-user AND per-IP** — authenticated users get higher limits
- **Exponential backoff** on failed auth attempts (1s, 2s, 4s, 8s...)
- **CAPTCHA** after N failed attempts
- **Request size limits** — body size, file upload size, query complexity
