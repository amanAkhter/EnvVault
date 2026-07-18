# Graph Report - .  (2026-07-17)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 492 nodes · 1051 edges · 41 communities (14 shown, 27 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `9a59d848`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- cn
- FirestoreRepository
- index.ts
- VariableEditor.tsx
- devDependencies
- index.tsx
- button.tsx
- ProjectDetailsPage.tsx
- components.json
- compilerOptions
- dependencies
- custom.d.ts
- switch-env.js
- @base-ui/react
- @vitejs/plugin-react
- dayjs
- dotenv
- express
- file-saver
- firebase
- framer-motion
- @google/genai
- @hookform/resolvers
- lucide-react
- motion
- papaparse
- react
- react-dom
- react-hook-form
- react-hot-toast
- shadcn
- tailwind-merge
- @tailwindcss/vite
- @tanstack/react-query
- tw-animate-css
- @types/file-saver
- @types/papaparse
- uuid
- zod
- zustand

## God Nodes (most connected - your core abstractions)
1. `cn()` - 63 edges
2. `FirestoreRepository` - 31 edges
3. `useAuthStore` - 30 edges
4. `Button()` - 22 edges
5. `Variable` - 16 edges
6. `compilerOptions` - 15 edges
7. `Project` - 14 edges
8. `Input()` - 12 edges
9. `VariableEditor()` - 12 edges
10. `VariableRepository` - 12 edges

## Surprising Connections (you probably didn't know these)
- `DialogOverlay()` --calls--> `cn()`  [EXTRACTED]
  src/components/ui/dialog.tsx → src/lib/utils.ts
- `TooltipContent()` --calls--> `cn()`  [EXTRACTED]
  src/components/ui/tooltip.tsx → src/lib/utils.ts
- `Providers()` --calls--> `initAuthListener()`  [EXTRACTED]
  src/app/providers.tsx → src/features/auth/api/authApi.ts
- `AppSidebar()` --calls--> `useAuthStore`  [EXTRACTED]
  src/components/layout/AppSidebar.tsx → src/features/auth/store/authStore.ts
- `AppSidebar()` --calls--> `cn()`  [EXTRACTED]
  src/components/layout/AppSidebar.tsx → src/lib/utils.ts

## Import Cycles
- None detected.

## Communities (41 total, 27 thin omitted)

### Community 0 - "cn"
Cohesion: 0.06
Nodes (54): AppSidebarProps, BOTTOM_NAV, MAIN_NAV, NavItem, Avatar(), AvatarBadge(), AvatarFallback(), AvatarGroup() (+46 more)

### Community 1 - "FirestoreRepository"
Cohesion: 0.05
Nodes (18): EnvironmentCompareDialogProps, VariableEditorProps, VersionHistoryDialogProps, AuditLogRepository, FirestoreRepository, PaginatedResult, QueryOptions, EnvironmentRepository (+10 more)

### Community 2 - "index.ts"
Cohesion: 0.07
Nodes (42): AuthError, buildUserProfile(), ensureAdminBootstrapOrganization(), fetchOrganizationMemberships(), fetchOrganizationsByMembership(), initAuthListener(), loginWithGoogle(), slugify() (+34 more)

### Community 3 - "VariableEditor.tsx"
Cohesion: 0.12
Nodes (34): Input(), Label(), CategoryPreset, getCategory(), VARIABLE_CATEGORIES, CreateProjectPage(), ProjectFormData, projectSchema (+26 more)

### Community 4 - "devDependencies"
Cohesion: 0.06
Nodes (35): autoprefixer, esbuild, vite, devDependencies, autoprefixer, esbuild, tailwindcss, tsx (+27 more)

### Community 5 - "index.tsx"
Cohesion: 0.08
Nodes (22): App(), NotFoundPage(), Providers(), queryClient, AppSidebar(), Breadcrumbs(), CommandItem, CommandPalette() (+14 more)

### Community 6 - "button.tsx"
Cohesion: 0.12
Nodes (24): Button(), buttonVariants, Dialog(), DialogContent(), DialogDescription(), DialogFooter(), DialogHeader(), DialogOverlay() (+16 more)

### Community 7 - "ProjectDetailsPage.tsx"
Cohesion: 0.11
Nodes (20): Github(), Tabs(), TabsContent(), TabsList(), tabsListVariants, TabsTrigger(), reauthenticateGoogle(), createProject() (+12 more)

### Community 8 - "components.json"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 9 - "compilerOptions"
Cohesion: 0.10
Nodes (20): DOM, DOM.Iterable, ES2022, ./src/*, compilerOptions, allowImportingTsExtensions, allowJs, experimentalDecorators (+12 more)

### Community 10 - "dependencies"
Cohesion: 0.22
Nodes (9): class-variance-authority, clsx, @fontsource-variable/geist, dependencies, class-variance-authority, clsx, @fontsource-variable/geist, react-router (+1 more)

### Community 11 - "custom.d.ts"
Cohesion: 0.22
Nodes (8): *.css, ImportMeta, ImportMetaEnv, *.jpeg, *.jpg, *.png, *.scss, *.svg

### Community 12 - "switch-env.js"
Cohesion: 0.40
Nodes (4): __dirname, __filename, sourceFile, targetFile

## Knowledge Gaps
- **158 isolated node(s):** `$schema`, `style`, `rsc`, `tsx`, `config` (+153 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **27 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `cn` to `index.ts`, `VariableEditor.tsx`, `index.tsx`, `button.tsx`, `ProjectDetailsPage.tsx`?**
  _High betweenness centrality (0.077) - this node is a cross-community bridge._
- **Why does `useAuthStore` connect `cn` to `index.ts`, `VariableEditor.tsx`, `index.tsx`, `ProjectDetailsPage.tsx`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **What connects `$schema`, `style`, `rsc` to the rest of the system?**
  _158 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `cn` be split into smaller, more focused modules?**
  _Cohesion score 0.06416275430359937 - nodes in this community are weakly interconnected._
- **Should `FirestoreRepository` be split into smaller, more focused modules?**
  _Cohesion score 0.0539906103286385 - nodes in this community are weakly interconnected._
- **Should `index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06745098039215686 - nodes in this community are weakly interconnected._
- **Should `VariableEditor.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.11517165005537099 - nodes in this community are weakly interconnected._