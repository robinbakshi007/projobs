PROJOBS Autoscaling and PWA Guide

1) What is done already
- Frontend is now a Progressive Web App (PWA).
- Manifest and Service Worker are generated in production build.
- Install icons are included (192x192 and 512x512).

2) Install as PWA (desktop or mobile)
- Open the app in a Chromium browser over HTTPS or localhost.
- Use browser menu: Install App / Add to Dock / Add to Home Screen.
- If install prompt is not shown, open DevTools Lighthouse and run the PWA audit.

3) Why autoscaling is not active on local machine
- Local development runs a single frontend preview process and a single backend process.
- Autoscaling requires an orchestrator or managed platform.

4) Production autoscaling options
Option A: Kubernetes (recommended)
- Run backend in a Deployment with multiple replicas.
- Add Horizontal Pod Autoscaler for CPU and/or memory.
- Use Ingress + Load Balancer for routing.
- Move sessions/cache/queues to Redis and database to managed MySQL/Postgres.

Option B: Managed container services
- Use AWS ECS/Fargate, GCP Cloud Run, or Azure Container Apps.
- Configure min/max instance counts and request-based scaling.

Option C: VM autoscaling groups
- Put backend behind Nginx/Load Balancer.
- Scale VM count using autoscaling group policies.

5) Backend autoscaling readiness checklist
- Keep backend stateless.
- Store sessions in Redis or database.
- Use queue workers as separate scalable service.
- Ensure idempotent webhook/event handlers.
- Use health checks and readiness probes.

6) Frontend scaling notes
- Frontend is static assets and can be hosted on CDN.
- CDN edge distribution provides global scaling automatically.

7) Suggested target architecture
- Frontend: Vite build deployed to CDN.
- Backend API: multiple containers behind load balancer.
- Redis: shared cache/session/queue backend.
- DB: managed relational database.
- Worker: separate autoscaled worker pool.
