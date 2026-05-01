# Context Preservation

Panduan untuk menjaga context antar sesi agar AI tidak pernah kehilangan informasi penting tentang project.

---

## Prinsip Utama

1. **Baca dulu, kerja kemudian** — Selalu baca `.opencode-context.md` di awal sesi sebelum mulai kerja
2. **Tulis ringkas** — Hanya fakta penting, format bullet point, hindari narasi panjang
3. **Update inkremental** — Tambah/ubah saat ada keputusan, jangan tulis ulang seluruh file
4. **User adalah pemilik** — User boleh edit manual kapan saja

---

## Flow Setiap Sesi

```
1. Awal sesi → Cek apakah .opencode-context.md ada di root project
2. Jika ada → Baca dan pahami sebelum menjawab apapun
3. Selama sesi → Update file saat ada:
   - Keputusan arsitektur baru
   - Stack/dependency baru ditambahkan
   - Task selesai (checklist update)
   - Bug penting ditemukan & di-fix
   - Konvensi baru disepakati
4. Akhir sesi → Pastikan status terkini tercatat
```

---

## Kapan HARUS Update Context File

| Event | Contoh | Action |
|-------|--------|--------|
| Keputusan arsitektur | "Kita pakai JWT untuk auth" | Tambah di ## Architecture Decisions |
| Dependency baru | "Install Redis untuk caching" | Update ## Stack |
| Task selesai | "Auth controller done" | Checklist [x] di ## Current Status |
| Konvensi baru | "Semua API return {success,data,error}" | Tambah di ## Conventions |
| Bug kritis di-fix | "Race condition di payment" | Tambah di ## Important Notes |

---

## Kapan TIDAK PERLU Update

- Perubahan kecil (typo fix, rename variable)
- Hal yang sudah jelas dari kode (import statements)
- Informasi sementara yang tidak relevan sesi berikutnya
- Detail implementasi yang bisa dibaca dari source code

---

## Format File .opencode-context.md

```markdown
# Project Context
> Auto-maintained by AI. You can edit this file freely.
> Last updated: YYYY-MM-DD

## Stack
- [bahasa/framework utama]
- [database]
- [tools penting]

## Architecture Decisions
- [keputusan 1]: [alasan singkat]
- [keputusan 2]: [alasan singkat]

## Conventions
- [aturan 1]
- [aturan 2]

## Current Status
- [x] [task selesai]
- [x] [task selesai]
- [ ] [task sedang dikerjakan] ← IN PROGRESS
- [ ] [task belum mulai]

## Important Notes
- [hal penting yang harus diingat]
```

---

## Rules Penulisan (Hemat Token)

1. **Maksimal 50 baris** — Jika lebih, ringkaskan
2. **Bullet point only** — Tidak perlu paragraf
3. **Tidak ada duplikasi** — Jangan tulis yang sudah ada
4. **Gunakan simbol:**
   - `[x]` = selesai
   - `[ ]` = belum
   - `←` = sedang dikerjakan
   - `⚠️` = perlu perhatian
5. **Tanggal di header** — Agar tahu kapan terakhir update

---

## Integrasi dengan Memory MCP

Jika MCP Memory server aktif, gunakan untuk:
- **Fakta permanen** (API keys location, deployment URL) → simpan di Memory
- **Status project yang berubah** (current task, progress) → simpan di .opencode-context.md

Pembagian:
| Jenis Info | Simpan Di |
|-----------|-----------|
| Stack & arsitektur | .opencode-context.md |
| Status & progress | .opencode-context.md |
| Credentials location | Memory MCP |
| User preferences | Memory MCP |
| Deployment info | Memory MCP |

---

## Contoh Lengkap

```markdown
# Project Context
> Auto-maintained by AI. You can edit this file freely.
> Last updated: 2025-01-15

## Stack
- Laravel 11, PHP 8.3
- PostgreSQL 16, Redis 7
- Frontend: Blade + Livewire 3 + Tailwind CSS 3.4
- Queue: Laravel Horizon
- Deploy: Docker + AWS ECS

## Architecture Decisions
- Auth: JWT + refresh token (access 15min, refresh 7d)
- API: RESTful, versioned /api/v1/, rate limited 60/min
- File storage: S3 with signed URLs
- Cache: Redis with 5min TTL default

## Conventions
- All endpoints return: { success: bool, data: any, error: string|null }
- Migrations: YYYY_MM_DD_HHMMSS_verb_noun (e.g. create_users_table)
- Tests: Feature tests for endpoints, Unit tests for services
- Commits: feat|fix|refactor(scope): description

## Current Status
- [x] User authentication (JWT + refresh)
- [x] Product CRUD + image upload
- [x] Category management
- [ ] Shopping cart ← IN PROGRESS
- [ ] Checkout + Stripe payment
- [ ] Order management
- [ ] Email notifications

## Important Notes
- Products table has soft deletes enabled
- User model uses HasApiTokens trait (Sanctum removed, custom JWT)
- Redis connection pool max 10 in production
- ⚠️ Migration 2025_01_10 has breaking change on products.price (int→decimal)
```
