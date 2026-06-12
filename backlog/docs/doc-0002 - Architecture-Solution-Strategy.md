---
id: doc-0002
title: 'Architecture: Solution Strategy'
type: specification
created_date: '2026-06-12 17:04'
updated_date: '2026-06-12 17:04'
tags:
  - arc42
---
# Solution Strategy (arc42 §4)

> Maintained by woshy_plan_and_do on architecturally significant changes.
> What belongs here: the key technology choices and the reasoning behind them.

Current strategy (seed): Angular 19 SPA (Standalone Components, Signals,
NgRx Signal Store, Tailwind 4) with hexagonal architecture (ports as
InjectionTokens, adapters in infrastructure/). Express 5 backend exists solely
for Google OAuth2 + Calendar proxying; tokens stay server-side in the session.

_Rationale per choice not yet populated — record significant choices as
backlog decisions and summarize here._
