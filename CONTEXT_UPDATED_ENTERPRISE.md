# Project Context: Enterprise CLM with Gemini AI

## 1. Project Goals
**Objective**: Build an enterprise-grade, multi-tenant Contract Lifecycle Management (CLM) system.
**Key Features**:
- **Full Contract Lifecycle**: Draft -> Review -> Approval -> Signature -> Active -> Expiry/Renewal.
- **AI Integration**: Deep integration with Google Gemini for contract analysis, risk assessment, and drafting assistance.
- **Multi-tenancy**: strict data isolation between companies (tenants).
- **Role-Based Access Control (RBAC)**: Granular permissions for users within a company.

## 2. Technology Stack
- **Frontend**:
    - **Framework**: React 18
    - **Build Tool**: Vite
    - **Language**: TypeScript
    - **Styling**: Tailwind CSS, Framer Motion (animations)
    - **Icons**: Lucide React
    - **Rich Text Editor**: Tiptap
- **Backend**:
    - **Platform**: Supabase (BaaS)
    - **Database**: PostgreSQL
    - **Authentication**: Supabase Auth
    - **Storage**: Supabase Storage
    - **Edge Functions**: Deno/Node.js (for Stripe webhooks, complex logic)
- **AI**: Google Gemini API
- **Payments**: Stripe
- **Testing**: Vitest, React Testing Library

## Security & Compliance Baseline (Enterprise)

- **Tenant Isolation**: All tenant-scoped tables use **Postgres RLS** with membership checks via `company_users`.
- **Private Contract Storage**: The `contracts` bucket is **PRIVATE**. Do not use public URLs for contracts.
- **Downloads**: Use **signed URLs** or an **Edge Function** that checks membership/permissions before serving files.
- **Audit Logging**: `audit_logs` should be written from **trusted server-side code** (service role / edge functions), not the client.
- **Data Integrity**: Add uniqueness constraints (e.g., one membership per user+company, unique contract version numbers) and indexes for scale.

Reference scripts:
- `supabase/schema_UPDATED_ENTERPRISE.sql`
- `supabase/rls_UPDATED_ENTERPRISE.sql`

## 3. Folder Structure
```
/
├── components/          # Reusable React components
│   ├── ui/              # Generic UI components (buttons, inputs, etc.)
│   ├── layout/          # Layout components (Sidebar, Header)
│   └── ...              # Feature-specific components
├── contexts/            # React Context providers (AuthContext, etc.)
├── hooks/               # Custom React hooks
├── lib/                 # Utility libraries and API clients
│   └── supabaseClient.ts # Supabase client initialization
├── pages/               # Route pages (Dashboard, Contracts, Settings)
├── services/            # API service layers
├── supabase/            # Supabase configuration and SQL
│   ├── functions/       # Edge Functions
│   ├── config.toml      # Local development config
│   └── ...
├── types.ts             # TypeScript type definitions
└── ...
```

## 4. Database Schema & Architecture
**Multi-tenancy**:
- Almost every table has a `company_id` column.
- **Rule**: All queries MUST filter by `company_id` to ensure data isolation.
- **RLS**: Row Level Security policies enforce this at the database level.

**Key Tables**:
- `companies`: Tenants (stores settings, plan info).
- `users`: Global user profiles (linked to `auth.users`).
- `company_users`: Join table for User <-> Company (assigns roles).
- `contracts`: Core contract data.
- `contract_versions`: History of contract edits.
- `contract_documents`: Attached files.
- `clause_library` & `contract_templates`: Reusable legal content.
- `approval_workflows` & `approval_steps`: Configurable approval chains.
- `audit_logs`: Track all system activity.

## 5. Development Rules
- **Authentication**: Use `AuthContext` to access current user and session.
- **Styling**: Use Tailwind utility classes. Avoid custom CSS files where possible.
- **State Management**: Use React Context for global state (Auth, Toast, etc.) and React Query (or `useEffect` with services) for data fetching.
- **Type Safety**: Maintain strict TypeScript types in `types.ts`.
- **Environment Variables**: Access via `import.meta.env.VITE_...`.
