# Graph Report - .  (2026-07-18)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 611 nodes · 1146 edges · 53 communities (24 shown, 29 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `9a59d848`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- cn
- useAuthStore
- member-service.ts
- authApi.ts
- FirestoreRepository
- devDependencies
- compilerOptions
- ProjectDetailsPage.tsx
- CreateProjectPage.tsx
- components.json
- package.json
- index.ts
- audit-service.ts
- HealthScoreCard.tsx
- dependencies
- custom.d.ts
- send-invitation.mjs
- Environment
- index.ts
- Project
- permissions.ts
- switch-env.js
- variableCategories.constants.ts
- comparison-service.ts
- clsx
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
- @base-ui/react
- @tailwindcss/vite
- @tanstack/react-query
- tw-animate-css
- @types/file-saver
- @types/papaparse
- uuid
- @vitejs/plugin-react
- zod
- zustand
- canWriteEnvironmentType

## God Nodes (most connected - your core abstractions)
1. `cn()` - 61 edges
2. `useAuthStore` - 38 edges
3. `FirestoreRepository` - 30 edges
4. `Button()` - 18 edges
5. `Variable` - 15 edges
6. `compilerOptions` - 15 edges
7. `Project` - 12 edges
8. `Input()` - 11 edges
9. `VariableRepository` - 11 edges
10. `compilerOptions` - 11 edges

## Surprising Connections (you probably didn't know these)
- `TooltipContent()` --calls--> `cn()`  [EXTRACTED]
  src/components/ui/tooltip.tsx → src/lib/utils.ts
- `ProjectDetailsPage()` --calls--> `useAuthStore`  [EXTRACTED]
  src/features/projects/pages/ProjectDetailsPage.tsx → src/features/auth/store/authStore.ts
- `include` --extends--> `./src/*`  [EXTRACTED]
  functions/tsconfig.json → tsconfig.json
- `AppSidebar()` --calls--> `useAuthStore`  [EXTRACTED]
  src/components/layout/AppSidebar.tsx → src/features/auth/store/authStore.ts
- `TopNavbar()` --calls--> `useAuthStore`  [EXTRACTED]
  src/components/layout/TopNavbar.tsx → src/features/auth/store/authStore.ts

## Import Cycles
- None detected.

## Communities (53 total, 29 thin omitted)

### Community 0 - "cn"
Cohesion: 0.06
Nodes (55): AppSidebar(), AppSidebarProps, BOTTOM_NAV, MAIN_NAV, NavItem, CommandItem, CommandPalette(), TopNavbar() (+47 more)

### Community 1 - "useAuthStore"
Cohesion: 0.07
Nodes (39): Layout(), NotificationBell(), timeAgo(), Badge(), BadgeProps, badgeVariants, EmptyStateProps, EnvironmentBadgeProps (+31 more)

### Community 2 - "member-service.ts"
Cohesion: 0.07
Nodes (25): AcceptInvitePage(), Blocker, ASSIGNABLE_ROLES, InviteMemberDialog(), InviteMemberDialogProps, ASSIGNABLE_ROLES, MembersPage(), ROLE_COLORS (+17 more)

### Community 3 - "authApi.ts"
Cohesion: 0.08
Nodes (32): App(), Providers(), queryClient, TooltipContent(), TooltipProvider(), AuthError, buildUserProfile(), confirmPhoneCode() (+24 more)

### Community 4 - "FirestoreRepository"
Cohesion: 0.08
Nodes (6): VersionHistoryDialogProps, FirestoreRepository, VariableRepository, VersionRepository, Variable, VariableVersion

### Community 5 - "devDependencies"
Cohesion: 0.06
Nodes (33): autoprefixer, esbuild, vite, devDependencies, autoprefixer, esbuild, tailwindcss, tsx (+25 more)

### Community 6 - "compilerOptions"
Cohesion: 0.06
Nodes (32): compilerOptions, esModuleInterop, module, moduleResolution, noImplicitReturns, outDir, rootDir, skipLibCheck (+24 more)

### Community 7 - "ProjectDetailsPage.tsx"
Cohesion: 0.10
Nodes (21): Github(), Label(), Tabs(), TabsContent(), TabsList(), tabsListVariants, TabsTrigger(), createProject() (+13 more)

### Community 8 - "CreateProjectPage.tsx"
Cohesion: 0.15
Nodes (27): CreateProjectPage(), ProjectFormData, projectSchema, SecretGeneratorDialog(), createAuditContext(), CHARS, decode(), decrypt() (+19 more)

### Community 9 - "components.json"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 10 - "package.json"
Cohesion: 0.10
Nodes (20): firebase-admin, firebase-functions, dependencies, firebase-admin, firebase-functions, description, devDependencies, typescript (+12 more)

### Community 11 - "index.ts"
Cohesion: 0.10
Nodes (19): BillingPlan, DecryptedVariable, EnvironmentType, FirestoreTimestamp, Invitation, InvitationStatus, LegacyEnvVariable, MemberStatus (+11 more)

### Community 12 - "audit-service.ts"
Cohesion: 0.22
Nodes (7): AuditContext, logAuditEvent(), sanitizeDetails(), AuditLogRepository, PaginatedResult, AuditAction, AuditLog

### Community 13 - "HealthScoreCard.tsx"
Cohesion: 0.31
Nodes (8): HealthScoreCard(), HealthScoreCardProps, SEVERITY_ICON, computeHealth(), healthGrade(), WEIGHTS, HealthCheckResult, HealthIssue

### Community 14 - "dependencies"
Cohesion: 0.22
Nodes (9): class-variance-authority, @fontsource-variable/geist, dependencies, class-variance-authority, @fontsource-variable/geist, react-router, tailwind-merge, react-router (+1 more)

### Community 15 - "custom.d.ts"
Cohesion: 0.22
Nodes (8): *.css, ImportMeta, ImportMetaEnv, *.jpeg, *.jpg, *.png, *.scss, *.svg

### Community 16 - "send-invitation.mjs"
Cohesion: 0.36
Nodes (5): buildInvitationEmail(), capitalize(), escapeHtml(), resend, { subject, html, text }

### Community 17 - "Environment"
Cohesion: 0.36
Nodes (4): EnvironmentCompareDialogProps, EnvironmentRepository, DEFAULT_ENVIRONMENTS, Environment

### Community 18 - "index.ts"
Cohesion: 0.29
Nodes (6): cleanupExpiredSecrets, db, onSecretReveal, onUserSignup, onVariableChange, sendNotifications

### Community 20 - "permissions.ts"
Cohesion: 0.33
Nodes (3): ROLE_PERMISSIONS, OrganizationRole, Permission

### Community 21 - "switch-env.js"
Cohesion: 0.40
Nodes (4): __dirname, __filename, sourceFile, targetFile

### Community 22 - "variableCategories.constants.ts"
Cohesion: 0.67
Nodes (3): CategoryPreset, getCategory(), VARIABLE_CATEGORIES

### Community 23 - "comparison-service.ts"
Cohesion: 0.67
Nodes (3): ComparisonStatus, ComparisonSummary, EnvironmentComparisonResult

## Knowledge Gaps
- **205 isolated node(s):** `$schema`, `style`, `rsc`, `tsx`, `config` (+200 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **29 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useAuthStore` connect `useAuthStore` to `cn`, `member-service.ts`, `authApi.ts`, `ProjectDetailsPage.tsx`, `CreateProjectPage.tsx`?**
  _High betweenness centrality (0.069) - this node is a cross-community bridge._
- **Why does `cn()` connect `cn` to `useAuthStore`, `authApi.ts`, `ProjectDetailsPage.tsx`, `CreateProjectPage.tsx`, `HealthScoreCard.tsx`?**
  _High betweenness centrality (0.069) - this node is a cross-community bridge._
- **Why does `FirestoreRepository` connect `FirestoreRepository` to `Environment`, `Project`, `audit-service.ts`, `ProjectDetailsPage.tsx`?**
  _High betweenness centrality (0.043) - this node is a cross-community bridge._
- **What connects `$schema`, `style`, `rsc` to the rest of the system?**
  _205 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `cn` be split into smaller, more focused modules?**
  _Cohesion score 0.06171025565677343 - nodes in this community are weakly interconnected._
- **Should `useAuthStore` be split into smaller, more focused modules?**
  _Cohesion score 0.07329462989840348 - nodes in this community are weakly interconnected._
- **Should `member-service.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0663265306122449 - nodes in this community are weakly interconnected._