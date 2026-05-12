# UAT Guide — AI Job Applications Platform

**Version:** 2026-05-12  
**Scope:** Full-stack end-to-end validation (frontend + backend + billing + webhooks)

---

## 1. Prerequisites

| Tool | Version | Check command |
|------|---------|---------------|
| PHP | 8.2+ | `php -v` |
| Composer | 2.x | `composer -V` |
| Node.js | 20+ | `node -v` |
| npm | 10+ | `npm -v` |
| Python | 3.11+ | `python3 -V` *(for worker)* |
| Stripe CLI | latest | `stripe --version` *(optional, for local webhook testing)* |

### Optional: Docker services
If you want MySQL/Redis instead of SQLite:
```bash
docker-compose up -d
```
Then update `apps/backend/.env`:
```
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=ai_job_apps
DB_USERNAME=app_user
DB_PASSWORD=app_pass
```

---

## 2. URLs

| Service | Local URL | Notes |
|---------|-----------|-------|
| **Frontend (dev)** | http://localhost:5173 | Vite dev server |
| **Frontend (preview)** | http://localhost:4173 | After `npm run preview` |
| **Backend API** | http://localhost:8000/api/v1 | Laravel artisan serve |
| **Health check** | http://localhost:8000/api/v1/health | Should return `{"status":"ok"}` |
| **Stripe Webhook** | http://localhost:8000/api/v1/billing/stripe/webhook | Public endpoint (no auth) |

---

## 3. Quick Start (5 minutes)

### 3.1 Backend
```bash
cd apps/backend
composer install
php artisan key:generate   # if .env is fresh
php artisan migrate --force
php artisan db:seed
php artisan serve
```
Backend runs at **http://localhost:8000**

### 3.2 Frontend
```bash
cd apps/frontend
npm install
```

Create `.env` (or `.env.local`) if not present:
```
VITE_API_BASE=http://localhost:8000/api/v1
```

```bash
npm run dev
```
Frontend runs at **http://localhost:5173**

### 3.3 Worker (optional)
```bash
cd apps/worker
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python src/main.py
```

---

## 4. UAT Test Cases

### 4.1 Authentication & Tenant
| Step | Action | Expected Result |
|------|--------|---------------|
| 1 | Open http://localhost:5173 | Login/register screen visible |
| 2 | Register a new user | Success toast, token saved to localStorage |
| 3 | Login with same credentials | Dashboard loads, tenant context established |
| 4 | Click **Overview** tab | Tenant stats, onboarding milestones visible |
| 5 | Check `X-Tenant-Id` header in Network tab | Present on all API calls |

### 4.2 Resume Scanner
| Step | Action | Expected Result |
| 4.6 | Go to **Resume** tab | Upload area visible |
| 4.7 | Upload a PDF resume | ATS score, grammar issues, rewrite suggestions displayed |
| 4.8 | Click **View Diff** | Layout-preserving diff with highlighted changes |

### 4.3 Interview Buddy
| Step | Action | Expected Result |
| 4.9 | Go to **Interview** tab | Start session button visible |
| 4.10 | Start a session (select role) | Questions load, timer starts |
| 4.11 | Submit a response | AI feedback + scoring returned |
| 4.12 | End session | Session summary with average score |

### 4.4 Job Discovery (Backend-Driven Scoring)

#### 4.4.1 CV Upload & Parsing
| Step | Action | Expected Result |
|------|--------|---------------|
| 4.13 | Go to **Jobs** tab | Job Discovery Studio visible |
| 4.14 | Upload CV (PDF or DOCX) | File accepted, parse animation starts |
| 4.15 | Wait for parsing animation | Steps cycle: Scanning → Finding recipe → Ingredients → Role types → Finalizing |
| 4.16 | Parsing completes | Role title, skills, experience level auto-filled from CV |

#### 4.4.2 Preference Setup
| Step | Action | Expected Result |
|------|--------|---------------|
| 4.17 | Confirm role title, location, work type | Fields pre-filled from CV or manual entry |
| 4.18 | Select role types (Full Time, Part Time, Contract, Casual, Internship) | Checkboxes toggle on/off |
| 4.19 | Set salary range and currency | Min/max salary validated as numbers |
| 4.20 | Click **Save Preferences** | `POST /api/v1/job-discovery/preferences` returns 200 with saved preference |

#### 4.4.3 Job Search & Scoring
| Step | Action | Expected Result |
|------|--------|---------------|
| 4.21 | Click **Search Jobs** | `POST /api/v1/job-discovery/search` returns 201 |
| 4.22 | Verify score out of 10 | Each result shows `preference_score_10` (e.g., 5.3/10) |
| 4.23 | Verify score breakdown | `score_breakdown_json` shows weights, components, and `final_score_10` |
| 4.24 | Verify backend ownership | Score is computed server-side; no client-side score calculation |

**Exact API Response Fields (from smoke test):**
```json
{
  "message": "Jobs discovered via Google Grounding Search",
  "total_found": 5,
  "first_result": {
    "id": 16,
    "title": "Backend Engineer",
    "company": "Google",
    "location_text": "San Francisco, CA",
    "salary_text": "$188K - $232K",
    "match_score": "70.00",
    "preference_score_10": "5.30",
    "score_breakdown_json": {
      "weights": {
        "ai_match": 0.5,
        "role_title": 0.18,
        "location": 0.1,
        "skills_overlap": 0.1,
        "salary_range": 0.05,
        "work_type": 0.04,
        "role_type": 0.03
      },
      "components": {
        "ai_match": { "signal": 0.7, "weight": 0.5, "weighted_score": 0.35 },
        "role_title": { "signal": 1, "weight": 0.18, "weighted_score": 0.18 },
        "location": { "signal": 0, "weight": 0.1, "weighted_score": 0 },
        "skills_overlap": { "signal": 0, "weight": 0.1, "weighted_score": 0 },
        "salary_range": { "signal": 0, "weight": 0.05, "weighted_score": 0 },
        "work_type": { "signal": 0, "weight": 0.04, "weighted_score": 0 },
        "role_type": { "signal": 0, "weight": 0.03, "weighted_score": 0 }
      },
      "final_score_10": 5.3
    },
    "status": "new"
  }
}
```

#### 4.4.4 Filtering & Sorting
| Step | Action | Expected Result |
|------|--------|---------------|
| 4.25 | Filter by min score (e.g., 6/10) | Only jobs with score ≥ 6 shown |
| 4.26 | Filter by location | Location text match filters results |
| 4.27 | Filter by status | All/New/Viewed/Saved/Applied filters work |
| 4.28 | Sort by score descending | Highest score first |
| 4.29 | Sort by latest posted | Most recent jobs first |

#### 4.4.5 Apply Flow
| Step | Action | Expected Result |
|------|--------|---------------|
| 4.30 | Click **Apply** on a job | Apply Lab opens with job details |
| 4.31 | Click **Open in new tab** | External apply URL opens in new tab |
| 4.32 | Click **Queue Seek Auto-Apply** | Agent task queued (if SEEK URL detected) |
| 4.33 | Update status to "applied" | `PUT /api/v1/job-discovery/results/{id}` returns updated status |

#### 4.4.6 Happy Path User Journey
1. **Upload CV** → PDF/DOCX parsed with animated steps
2. **Confirm Preferences** → Role, skills, salary, role types set
3. **Search Jobs** → Backend computes scores out of 10
4. **Filter/Sort** → Find best matches by score, location, status
5. **Apply** → Open external URL or queue auto-apply agent
6. **Track Status** → Update through new → viewed → saved → applied

#### 4.4.7 Unhappy Path User Journey
| Scenario | Action | Expected Error |
|----------|--------|----------------|
| No auth token | Call `GET /job-discovery/results` without token | `401 {"message":"Unauthenticated."}` |
| Invalid token | Call with `Bearer badtoken` | `401 {"message":"Unauthenticated."}` |
| Cross-tenant access | User B tries to update User A's result | `403 {"message":"Unauthorized"}` |
| Missing role_title | `POST /preferences` with only location | `422 {"message":"The role title field is required."}` |
| Invalid work_type | `POST /preferences` with `work_type: "spacestation"` | `422 {"message":"The selected work type is invalid."}` |
| Invalid preference_id type | `POST /search` with `preference_id: "notanumber"` | `422 {"message":"The preference id field must be an integer."}` |
| Non-existent preference_id | `POST /search` with `preference_id: 999999` | `422` (validation error) |
| Invalid status enum | `PUT /results/{id}` with `status: "hired"` | `422 {"message":"The selected status is invalid."}` |
| Unsupported file type | Upload `.txt` or `.jpg` as CV | Client-side error: "Only PDF and DOCX are supported" |
| Iframe blocked | Apply Lab embed on X-Frame-Options site | Fallback to "Open in new tab" |

### 4.5 AI Agents & Journeys
| Step | Action | Expected Result |
| 4.17 | Go to **Agents** tab | Task dispatch form visible |
| 4.18 | Dispatch a task (e.g., `apply_job`) | Task queued, status updates poll correctly |
| 4.19 | Go to **Journeys** tab | Journey builder / milestone tracker visible |

### 4.6 Review Queue (Tenant Admin)
| Step | Action | Expected Result |
| 4.20 | As tenant admin, go to **Review** tab | Pending applications list |
| 4.21 | Click **Approve** on an application | Application status updated, next item slides in |
| 4.22 | Click **Skip** | Item removed from queue |

---

## 5. Billing & Subscriptions UAT

### 5.1 Super Admin Stripe Key Management
| Step | Action | Expected Result |
|------|--------|---------------|
| 5.1 | Login as `super_admin` role user | Billing tab visible in nav |
| 5.2 | Go to **Billing** tab | Stripe keys card + plans card visible |
| 5.3 | Enter test Stripe keys (pk_test_, sk_test_, whsec_) | Save succeeds, "Configured: secret yes, webhook yes" |
| 5.4 | Refresh page | Keys persisted (publishable key shown, secrets masked) |

**Test keys (Stripe test mode):**
- Publishable: `pk_test_...` (from Stripe Dashboard → Developers → API keys)
- Secret: `sk_test_...`
- Webhook secret: `whsec_...` (from Stripe Dashboard → Webhooks → Signing secret)

### 5.2 Subscription Checkout Flow
| Step | Action | Expected Result |
|------|--------|---------------|
| 5.5 | Select a tenant from dropdown | Tenant subscription badge appears (or "no subscription") |
| 5.6 | Click **Create Checkout** on Starter ($19/mo) | If Stripe configured: Stripe Checkout URL opens in new tab |
| 5.7 | Complete Stripe test checkout | Redirected to success URL |
| 5.8 | Check backend subscription status | `status` = `active`, `stripe_subscription_id` populated |

**Mock checkout (no Stripe keys):**
If Stripe secret is not configured, the backend returns a mock checkout URL:
```
http://localhost:5173/billing/success?mock_subscription=1
```
This simulates the flow without real charges.

### 5.3 Webhook Lifecycle
| Step | Action | Expected Result |
|------|--------|---------------|
| 5.9 | Trigger `checkout.session.completed` event | Backend updates subscription to `active` |
| 5.10 | Trigger `customer.subscription.updated` | `current_period_start/end` updated |
| 5.11 | Trigger `customer.subscription.deleted` | Subscription status set to `canceled` |

**Local webhook testing with Stripe CLI:**
```bash
stripe login
stripe listen --forward-to http://localhost:8000/api/v1/billing/stripe/webhook
```
Then trigger events:
```bash
stripe trigger checkout.session.completed
stripe trigger customer.subscription.deleted
```

**Webhook signature verification:**
- If `webhook_secret` is configured, invalid signatures return `401`
- If not configured (dev mode), all events are accepted

### 5.4 Billing Portal
| Step | Action | Expected Result |
|------|--------|---------------|
| 5.12 | Select a tenant with an active subscription | Badge shows `active` |
| 5.13 | Click **Open Billing Portal** | Stripe Customer Portal opens in new tab |
| 5.14 | In portal, change plan or cancel | Backend receives webhook and updates status |

---

## 6. API Smoke Tests (curl)

### Health
```bash
curl http://localhost:8000/api/v1/health
```
Expected: `{"status":"ok","service":"backend-api"}`

### Register
```bash
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"UAT User","email":"uat@example.com","password":"password123","password_confirmation":"password123","tenant_id":1}'
```

### Login
```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"uat@example.com","password":"password123"}'
```

### Plans (no auth)
```bash
curl http://localhost:8000/api/v1/billing/plans
```

### Stripe Webhook (simulate)
```bash
curl -X POST http://localhost:8000/api/v1/billing/stripe/webhook \
  -H "Content-Type: application/json" \
  -d '{"type":"checkout.session.completed","data":{"object":{"metadata":{"subscription_id":"1"},"customer":"cus_test","subscription":"sub_test"}}}'
```

---

## 7. Troubleshooting

| Symptom | Fix |
|---------|-----|
| `CORS error` | Ensure `APP_URL` in backend `.env` matches frontend origin (`http://localhost:5173`) |
| `401 Unauthorized` | Token expired — re-login; check `Authorization: Bearer <token>` header |
| `403 Invalid tenant` | `X-Tenant-Id` header missing or tenant inactive |
| `422 Stripe checkout failed` | Stripe keys invalid or plan code mismatch — check backend logs |
| `401 Invalid signature` on webhook | Webhook secret mismatch — verify `whsec_` value in Billing tab matches Stripe Dashboard |
| Frontend blank screen | Check browser console for React errors; ensure `VITE_API_BASE` is set |
| Database locked (SQLite) | Only one process can write — stop queue worker or switch to MySQL |

---

## 8. Test Data Reference

### Seeded User (from `DatabaseSeeder`)
- Email: `test@example.com`
- Password: *(hashed, use register flow instead)*

### Subscription Plans
| Plan | Price | Key Feature |
|------|-------|-------------|
| Starter | $19/mo | 100 AI applies/mo |
| Growth | $49/mo | 500 AI applies/mo |
| Pro | $99/mo | Unlimited applies |
| Enterprise | $249/mo | SLA + SSO |

### Subscription Statuses
| Status | Color | Meaning |
|--------|-------|---------|
| `active` | Green | Paid subscription running |
| `trialing` | Blue | Within 14-day trial |
| `pending` | Yellow | Awaiting first payment |
| `checkout_created` | Yellow | Checkout session created, not completed |
| `canceled` | Red | Subscription ended |
| `past_due` | Red | Payment failed |
| `unpaid` | Red | Invoice unpaid |

---

## 9. Sign-off Checklist

- [ ] Frontend loads at http://localhost:5173 without console errors
- [ ] Backend health check returns `ok`
- [ ] Register / login / logout flow works end-to-end
- [ ] Resume scanner produces ATS score and diff
- [ ] Interview Buddy session starts, submits, and scores
- [ ] Job discovery preferences save and search returns results
- [ ] Agent task dispatches and status updates poll correctly
- [ ] Review queue approve/skip updates application state
- [ ] Super admin can save Stripe keys (test mode)
- [ ] Subscription checkout creates session (mock or real)
- [ ] Webhook updates subscription status correctly
- [ ] Billing portal opens for active subscriptions
- [ ] All 9 PHPUnit tests pass
- [ ] Frontend `npm run build` completes without errors

---

*Prepared: 12 May 2026*  
*Contact: Check `README.md` in project root for architecture overview.*
