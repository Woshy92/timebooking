---
id: doc-0003
title: 'Architecture: Building Blocks'
type: specification
created_date: '2026-06-12 17:04'
updated_date: '2026-06-12 17:04'
tags:
  - arc42
---
# Building Block View (arc42 §5)

> Maintained by woshy_plan_and_do on architecturally significant changes.
> What belongs here: the major components/modules, their responsibilities, and
> how they depend on each other. Keep it a high-level map, not a file listing.

Seed map: frontend/src/app/{domain,application,infrastructure,state,features,shared}
(hexagonal — domain has no framework imports; adapters bound in app.config.ts)
and backend/src/{config,routes,services,middleware} (OAuth2 + Calendar proxy).

_Component responsibilities and dependency map not yet populated._
