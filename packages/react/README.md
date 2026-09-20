# Actyx RPC React

**React client for Actyx RPC — type-safe queries, mutations, streaming, and server actions.**

`@explita/actyx-rpc-react` provides first-class React hooks and client-side caching for [Actyx RPC](https://github.com/explita/actyx-rpc). It enables end-to-end type safety from server procedures to React components with zero code generation.

[![NPM Version](https://img.shields.io/npm/v/@explita/actyx-rpc-react?style=flat-square&color=blue)](https://www.npmjs.com/package/@explita/actyx-rpc-react)
[![License](https://img.shields.io/npm/l/@explita/actyx-rpc-react?style=flat-square&color=lightgray)](https://github.com/explita/actyx-rpc/blob/main/LICENSE)
[![Documentation](https://img.shields.io/badge/docs-actyx.explita.ng-blueviolet?style=flat-square)](https://actyx.explita.ng)

---

## 📖 Complete Documentation

Visit our documentation portal for the complete guide, hook recipes, streaming patterns, and API references:

👉 **[actyx.explita.ng](https://actyx.explita.ng)**

---

## Installation

```bash
npm install @explita/actyx-rpc-react @explita/actyx-rpc
```

> **Peer Dependency**: Requires `react` version `^19` (or `^18.2.0`).

---

## Quick Start

### 1. Setup Provider & QueryClient

Wrap your application root (or layout) with `ActyxProvider`:

```tsx
// app/providers.tsx
"use client";

import { useState } from "react";
import { ActyxProvider, QueryClient } from "@explita/actyx-rpc-react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    queries: {
      staleTime: "5m",
    },
  }));

  return (
    <ActyxProvider client={queryClient}>
      {children}
    </ActyxProvider>
  );
}
```

### 2. Query and Mutate Procedures

Use your typed server procedures directly inside React components:

```tsx
// components/user-profile.tsx
"use client";

import { useQuery, useMutation } from "@explita/actyx-rpc-react";
import { getUserProfile, updateUserProfile } from "@/server/procedures";

export function UserProfile({ userId }: { userId: string }) {
  // Queries automatically infer inputs, outputs, and status
  const { data, isLoading, error } = useQuery(getUserProfile, {
    input: { id: userId },
  });

  // Mutations provide async execution and reactive states
  const { mutate, isPending } = useMutation(updateUserProfile, {
    onSuccess(updated) {
      console.log("Profile updated:", updated.name);
    },
  });

  if (isLoading) return <p>Loading profile...</p>;
  if (error) return <p>Error: {error.message}</p>;

  return (
    <div>
      <h2>{data?.name}</h2>
      <p>{data?.email}</p>

      <button
        disabled={isPending}
        onClick={() => mutate({ id: userId, name: "New Name" })}
      >
        {isPending ? "Saving..." : "Save Changes"}
      </button>
    </div>
  );
}
```

---

## Features

- ⚡ **End-to-End Type Safety**: Input validation and output types flow seamlessly from server procedures to hooks.
- 🎯 **Core Hooks**: `useQuery`, `useMutation`, and `useSuspenseQuery` with automatic unwrap and selection helpers.
- 📦 **Parallel Fetching**: `useQueries` with per-element contextual type inference and IDE autocompletion.
- 📜 **Pagination & Infinite Lists**: `useInfiniteQuery` and `usePaginatedQuery` with bidirectional selection sync.
- 🌊 **Real-Time Streaming**: First-class `useSSE` (Server-Sent Events) and `useWS` (WebSocket) hooks.
- 🔄 **Stream Pagination**: `useSSEInfiniteQuery` and `useWSInfiniteQuery` for real-time live feeds.
- 🔍 **Activity Tracking**: `useIsFetching` and `useIsMutating` indicators for global background state.
- 💾 **Intelligent Caching**: `QueryClient` supports TTL, stale windows, optimistic updates, and tag invalidation.

---

## 💖 Support the Mission

Actyx RPC is built to simplify building type-safe, distributed systems with minimal boilerplate. If it has helped you build better apps faster, please consider supporting the project!

<p align="left">
  <a href="https://github.com/sponsors/explita">
    <img src="https://img.shields.io/badge/Sponsor_on_GitHub-EA4AAA?style=for-the-badge&logo=github-sponsors&logoColor=white" />
  </a>
  <a href="https://ko-fi.com/explita">
    <img src="https://img.shields.io/badge/Buy_Me_A_Coffee-FF5E5B?style=for-the-badge&logo=ko-fi&logoColor=white" />
  </a>
</p>

### 🚀 Ways to Contribute

- **Give us a ⭐**: It helps others discover the project on GitHub.
- **Join the Discussion**: Report [bugs](https://github.com/explita/actyx-rpc/issues) or suggest new [features](https://github.com/explita/actyx-rpc/discussions).
- **Spread the Word**: Share your experience with Actyx RPC on social media.
