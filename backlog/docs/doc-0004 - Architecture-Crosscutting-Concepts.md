---
id: doc-0004
title: 'Architecture: Crosscutting Concepts'
type: specification
created_date: '2026-06-12 17:04'
updated_date: '2026-06-12 17:04'
tags:
  - arc42
---
# Crosscutting Concepts (arc42 §8)

> Maintained by woshy_plan_and_do on architecturally significant changes.
> What belongs here: patterns that span the system — auth, persistence,
> error handling, i18n, state management conventions.

Seed concepts: session-based auth (httpOnly cookie, session-file-store, tokens
never reach the frontend); persistence via StoragePort (LocalStorage/IndexedDB
adapters); UI language German, code English; transient UI state in UiStore.

_Not yet fully populated — extend as patterns solidify._
