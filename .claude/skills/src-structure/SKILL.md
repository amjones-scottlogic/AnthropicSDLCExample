---
name: src-structure
description: Folder structure for code under src/, organised by domain. Use when planning or implementing a change that adds, moves or renames files in src/, or when deciding where a component, page, model, hook or helper belongs.
---

# Source structure

Code under `src/` is organised by domain (a page or area of the app such as `todos`), with models for the data the app is about. Follow this when writing a plan's "files to change" list and when creating files. If a change doesn't fit, flag it in the plan; don't invent a new top-level layout.

## Layout

```
src/
  main.tsx              entry point only: mounts <App />
  App.tsx               app shell: routing and top-level layout
  components/           generic UI (button, dialog), no domain or model knowledge
  models/
    <model>/            one folder per model, e.g. todo/ (a todo item)
      types/
      utils/
  storage/              localStorage reads and writes
  <domain>/             one folder per page, e.g. todos/ (route /todos)
    page.tsx            the page itself
    screens/            only if the page has several screens
    components/         UI used only by this domain
    hooks/              React hooks used only by this domain
    <sub-domain>/       a page nested under the domain, e.g. todo/ (route /todos/1)
      page.tsx
      screens/
      components/       same shape as a domain, used only at this level
      hooks/
  test/                 global test setup only
```

Create only the folders a domain needs. Don't add empty ones.

## What goes where

- **Domain:** one per page or route. If a page needs several screens, they go in its `screens/` folder rather than becoming new domains.
- **Sub-domain:** a page that sits under a domain's route, such as the page for a single todo item (`/todos/1`). It has its own `page.tsx` and may have its own `components/`, `hooks/` and `screens/`, used only at that level.
- **Model:** a concept shared across the app, usually one that would map to a backend entity (a todo item). `types/` holds its types; `utils/` holds pure logic over it. Models contain no React. Add a `hooks/` folder only when a model genuinely needs one.
- **Generic components:** top-level `components/` is for UI with no knowledge of any domain or model.
- **Storage:** `storage/` is the only code that touches `localStorage`, so the browser-only data rule in `project-standards` has one place to check.
- **No shared hooks or utils folders.** A hook or helper lives in the one domain that uses it, or with the model it relates to. If it fits neither, ask whether it is really generic UI or a new model.

## Rules

- **Dependencies point one way:** `page` → `screens` → `components` → `hooks` → `storage` → `models`.
  - Pages and screens may use their own domain's components and hooks, plus models and top-level `components/`.
  - Components may use hooks, models and top-level `components/`. They never call `storage/` directly; that goes through a hook.
  - Hooks may use `storage/` and models.
  - `storage/` may use models. `models/` import nothing from React or any other folder. Top-level `components/` import nothing from domains, models or storage.
- **Sub-domains:** a sub-domain may use its parent domain's `components/` and `hooks/`. A parent never imports from its sub-domains. Code used by both a parent and a sub-domain belongs in the parent.
- **No imports between domains.** Two sibling domains that need the same thing means it moves to a model, to top-level `components/`, or to their common parent domain.
- **Domain first.** Name a domain for the page or thing the user sees (`todos`), not a technical role.
- **Promote late.** Code starts in the domain that uses it. Move it up only when a second place needs it.
- **Tests sit next to the code.** `Thing.tsx` and `Thing.test.tsx` live in the same folder.
- **Imports are relative.** No path aliases are configured; don't add one without a plan that says so.

## Naming

- Components and screens: `PascalCase.tsx`, one component per file, named for what it is (`TodoList.tsx`). Pages are always `page.tsx`.
- Hooks: `useThing.ts`. Models, storage and utilities: `camelCase.ts`.
- Folders: lowercase. Kind folders are plural (`components`, `screens`, `hooks`, `types`, `utils`); model, domain and sub-domain folders are named for the thing they hold.

## When planning

State in the plan which domain or model each new file belongs to and give its full path. If a file goes in top-level `components/` or `storage/`, say which domains use it. If the layout above needs to change, update this skill in the same commit.
