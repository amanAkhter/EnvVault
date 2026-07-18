# EnvVault (envHandler) - Senior Engineering Guidelines

## Core Philosophy
EnvVault is a secure, high-performance environment variable manager. Treat all data as highly sensitive. Code must be deterministic, strictly typed, gracefully degraded, and easily testable. We use a **Feature-Sliced Design (FSD)** inspired architecture to ensure modularity as the application scales.

## Architecture & Directory Structure
Our architecture favors colocation of related logic (features) rather than grouping by technical role (actions/reducers).

- `src/features/` - Domain-specific modules (e.g., `auth`, `environments`, `secrets`). Each feature contains its own components, hooks, schemas, and API calls.
- `src/components/` - Global, dumb UI components only. Specifically, `shadcn/ui` and `base-ui` primitives, layout shells, and generic fallbacks.
- `src/routes/` - Route definitions (React Router v8). Keep these ultra-thin; they should only compose feature components and handle suspense boundaries.
- `src/firebase/` - Centralized Firebase initialization and secure configuration. Do not leak Firebase SDK imports into UI components.
- `src/services/` - Abstracted backend services. Currently wrapping Firebase, but interface-driven to allow future migration.
- `src/lib/` - Pure utility functions, centralized `tailwind-merge`/`clsx` helpers, and formatters.
- `src/types/` - Global TypeScript interfaces. (Feature-specific types live in their respective feature folders).
- `src/constants/` - Magic strings, API limits, validation regexes, and configuration flags.

## Tech Stack & Strict Usage Rules

### 1. State Management (The "State Split" Rule)
Never mix client and server state.
- **Server State (`@tanstack/react-query`)**: All asynchronous data, Firebase fetch calls, mutations, and caching. Use strict query key factories per feature (e.g., `['secrets', envId]`).
- **Client State (`zustand`)**: Only for global UI state that crosses feature boundaries (e.g., `useThemeStore`, `useActiveVaultStore`).
- **Local State (`useState` / `useReducer`)**: Form inputs (handled via React Hook Form), toggle states, and ephemeral component state.

### 2. Forms & Data Integrity
Every piece of data entering the system must be validated at the boundary.
- **Library**: `react-hook-form` + `@hookform/resolvers/zod`.
- **Validation**: Define Zod schemas in `src/features/{feature}/schemas.ts`. Infer TypeScript types from Zod (`z.infer<typeof schema>`). Do not duplicate type definitions.
- **Security**: Never log sensitive environment variables or secrets to the console.

### 3. Component Design (Atomic & Performant)
- **Props**: Interfaces must be explicit. No `any`. Prefer `Readonly<T>` for complex objects.
- **Styling**: Tailwind CSS v4. Use `cva` (class-variance-authority) for complex variants. All dynamic class strings MUST pass through the `cn()` utility (`clsx` + `twMerge`) in `src/lib/utils.ts` to prevent style conflicts.
- **Animation**: Use `framer-motion` for interaction feedback (e.g., secret reveal animations, copy-to-clipboard success states). Respect user `prefers-reduced-motion` settings.

### 4. Error Handling & Observability
Errors must not crash the application silently.
- **Boundaries**: Wrap route groups in React Error Boundaries (`react-error-boundary`). Provide localized fallback UIs (e.g., "Failed to load vault").
- **Async Errors**: Use React Query's `onError` to pipe critical failures to a centralized toast notification system (`react-hot-toast`).
- **Sanitization**: Ensure error messages shown to users do NOT expose stack traces or raw database query strings.

### 5. Performance Targets
- **Code Splitting**: Lazy load route components using `React.lazy()` and `<Suspense>`.
- **Memoization**: Only memoize (`useMemo`, `React.memo`) when profiling identifies a bottleneck. Premature optimization is banned.
- **Asset Loading**: Icons (`lucide-react`) must be imported specifically, avoiding barrel file bloat.

### 6. Backend Integration (Firebase)
- Firebase logic must be encapsulated in `src/services/` or custom hooks in `src/features/{feature}/api/`.
- UI components should never import `firebase/firestore` directly. They call custom hooks (e.g., `useGetVaults()`) which internally use React Query + Firebase SDK.

## Workflow & Development Commands
- `pnpm run dev` - Standard development.
- `pnpm run dev:prod` - Local dev against production configurations (use with extreme caution).
- `pnpm run lint` - Run before every commit. Zero TypeScript errors allowed.
- `pnpm run build` - Ensure zero warnings in the Vite build output.

## Code Review Checklist for Agents
Before generating code, verify:
1. Are styles utilizing existing Tailwind/shadcn patterns?
2. Is async data properly cached via React Query?
3. Are inputs validated via Zod?
4. Are we leaking Firebase logic into presentation components? (If yes, refactor).
5. Are secrets handled securely without console logging?
