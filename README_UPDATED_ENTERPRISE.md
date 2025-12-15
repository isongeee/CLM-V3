# Enterprise Contract Lifecycle Management (CLM) with Gemini AI

This project is an enterprise-grade, multi-tenant Contract Lifecycle Management (CLM) web application. It is designed to manage the entire lifecycle of contracts, from drafting and negotiation to execution and renewal. The application features deep integration with Google Gemini for advanced document analysis, risk assessment, and AI-assisted drafting.

## Table of Contents

1.  [Tech Stack & Architecture](#1-tech-stack--architecture)
2.  [Database Schema & Multi-Tenancy](#2-database-schema--multi-tenancy)
3.  [Contract Lifecycle](#3-contract-lifecycle)
4.  [Per-Company Configuration](#4-per-company-configuration)
5.  [Onboarding Flow](#5-onboarding-flow)
6.  [Gemini AI Integration](#6-gemini-ai-integration)
7.  [User Invitations](#7-user-invitations)
8.  [API & Frontend Design](#8-api--frontend-design)
9.  [Supabase MCP Server](#9-supabase-mcp-server)
10. [Email Configuration](#10-email-configuration)
11. [Getting Started](#11-getting-started)

## 1. Tech Stack & Architecture

The application is built on a modern, scalable tech stack designed for SaaS products.

- **Backend Data Layer**: [Supabase](https://supabase.io/) (PostgreSQL)
- **Authentication**: Supabase Auth (JWT-based)
- **File Storage**: Supabase Storage (for contract documents)
- **Frontend**: React (Vite) with TypeScript and Tailwind CSS
- **Artificial Intelligence**: Google Gemini for all intelligent features.

The architecture follows a standard pattern where the React frontend communicates directly with Supabase services for database operations, authentication, and storage, utilizing Row Level Security (RLS) for protection.

---

## 2. Database Schema & Multi-Tenancy

### Multi-Tenant Model

The application is designed as a multi-tenant SaaS where each tenant is a distinct `company`. A single `user` can belong to multiple companies with different roles in each. This is achieved through a `company_users` join table.

- Every business-related table includes a `company_id` column to isolate data.
- All database queries are filtered by the current user's active `company_id`.

### Row Level Security (RLS) & Storage (Enterprise Baseline)

This project is **multi-tenant** and relies on **Row Level Security (RLS)** for tenant isolation.

**Run these scripts in order:**

1. **Schema / DDL**: `supabase/schema_UPDATED_ENTERPRISE.sql`
   - Creates tables + enums.
   - Adds recommended constraints + indexes (enterprise hardening patch).

2. **RLS + Storage**: `supabase/rls_UPDATED_ENTERPRISE.sql`
   - Enables RLS on all tables.
   - Adds tenant-safe policies for every table.
   - Creates/forces the **`contracts` storage bucket as PRIVATE** (no public URLs).
   - Adds **tenant-scoped storage policies** requiring the object path to start with `company_id/…`.

**Company creation note**: the schema patch includes a trigger that automatically adds the `created_by_user_id` as an active **admin** in `company_users` after a company is created.


**Contract document storage path convention (recommended)**  
Store files under:
`<company_id>/contracts/<contract_id>/<filename>`

Then store that **path** (not a public URL) in `contract_documents.storage_path` (or `file_url` if you keep the legacy column).

**How to serve downloads**
- Use **signed URLs** (short expiry) or an **Edge Function** that validates membership/permissions before streaming.
- Avoid `getPublicUrl()` for contracts in production.

**Audit logs**
For enterprise auditability, treat `audit_logs` as **write-only from trusted server-side code** (service role / edge function). The provided RLS script intentionally does not allow client-side inserts.


## 3. Contract Lifecycle

The application manages a full contract lifecycle with defined states and transitions.

**States:** `Draft` → `In Review` → `Pending Approval` → `Sent for Signature` → `Fully Executed` → `Active` → `Expired` → `Terminated` / `Superseded`

**Lifecycle Entry Point:**

- **Create Contract**
  - `Create Contract -> Draft`
    - **Action**: Create Contract (from template, from scratch, or via upload)
    - **Role**: Requester, Legal (or any role allowed to initiate contracts)

**State Transition Diagram:**

- **Draft**:

  - `Draft -> In Review`
    - **Action**: Submit for Review
    - **Role**: Requester, Legal

- **In Review**:

  - `In Review -> Draft`
    - **Action**: Request Changes
    - **Role**: Legal, Stakeholder
  - `In Review -> Pending Approval`
    - **Action**: Finalize and Send for Approval
    - **Role**: Legal

- **Pending Approval**:

  - `Pending Approval -> In Review`
    - **Action**: Reject
    - **Role**: Approver
  - `Pending Approval -> Sent for Signature`
    - **Action**: Approve
    - **Role**: Final Approver

- **Sent for Signature**:

  - `Sent for Signature -> Fully Executed`
    - **Action**: All Parties Signed (See Signature Workflow below)

- **Fully Executed**:

  - `Fully Executed -> Active`
    - **Action**: Activate (typically triggered automatically on `effective_date`)

- **Active**:
  - `Active -> Expired`
    - **Action**: End date passed without renewal
  - `Active -> Terminated`
    - **Action**: Terminate manually

### Signature Workflow

Once a contract is fully approved, it enters the **Sent for Signature** stage.

1.  **Initiation**: The contract owner builds a "Signature Envelope" by selecting recipients.
    - **Internal Signers**: Selected from company users.
    - **External Signers**: Added via name and email.
2.  **Notification**: Signers receive an email notification and an in-app task (if internal).
3.  **Signing**:
    - Users open the **E-Signature Hub** (`/signing`).
    - They review the document and click "Sign".
    - They can choose to **Draw** their signature or **Adopt** a text-based signature.
4.  **Completion**:
    - The digital signature is appended to the contract document history.
    - Once all parties have signed, the contract automatically transitions to `FullyExecuted`.

---

## 4. Per-Company Configuration

Each company (tenant) can highly configure the application to fit their specific business needs. This is managed through a dedicated "Company Settings" area for administrators.

- **Custom Fields**: Admins can add custom data fields to core entities like `Contracts` and `Counterparties`. The frontend will dynamically render form inputs based on these definitions.
- **Contract Types**: Define custom contract types organized into three main categories. The frontend will guide users to create types within these standard categories.
- **Enterprise Workflows**: Design complex, multi-step approval chains using a form-based editor.
  - **Conditional Logic**: Trigger workflows based on Contract Type and Monetary Value thresholds.
  - **Dynamic Assignment**: Route approvals to specific **Users** or abstract **Roles** (e.g., "Legal Team", "CFO").
- **Clause Library & Templates**: Build a library of pre-approved legal clauses and full contract templates to standardize drafting.
- **AI Configuration**: Customize Gemini's behavior, including drafting tone, language, and rules for identifying high-risk clauses.

---

## 5. Onboarding Flow

New companies are guided through a setup wizard by their first administrator. This ensures the CLM is correctly configured from the start.

**Onboarding Steps:**

1.  **Organization Details**: Set company name, industry, default currency.
2.  **Contract Types**: Define the types of contracts the company manages.
3.  **Departments**: Define the company's organizational structure.

Admins can revisit and modify these settings at any time in the "Company Settings" section.

---

## 6. Gemini AI Integration

Gemini is integrated into key workflows to provide intelligent automation and insights.

#### 1. Contract Ingestion & Analysis

- **Flow**: A user uploads a third-party contract (PDF/DOCX).
- **Action**: The backend sends the document content to Gemini for analysis.
- **Example Prompt**:
  ```text
  Analyze the following contract document.
  1. Extract the following metadata: Counterparty Name, Effective Date, End Date, Renewal Term, Governing Law, and Total Contract Value.
  2. Summarize the contract in three sentences for a non-legal audience.
  3. Identify any clauses that match the following high-risk categories: [Unilateral Indemnification, Termination for Convenience, Unlimited Liability]. For each identified clause, explain the risk and suggest a more balanced alternative.
  ```

#### 2. AI-Assisted Drafting & Redlining

- **Flow**: A user creates a new contract from a company template.
- **Action**: Gemini generates a draft based on the template and user-provided parameters. Users can then select text in the editor and request specific changes.
- **Example Prompt (for a change request)**:

  ```text
  You are a helpful legal assistant.
  Context: We are editing a "Limitation of Liability" clause.

  Current Clause:
  """
  [... existing clause text ...]
  """

  User Request: "Make the liability cap mutual and set it to the total fees paid in the last 12 months."

  Please generate the revised clause.
  ```

---

## 7. User Invitations

Administrators can invite new team members to their company via the **Settings > Users & Roles** page.

**Invitation Methods:**

1.  **Direct Add by Email**:
    - Admins enter the email address of an existing user.
    - The system uses a secure backend function to verify the user exists and add them to the company immediately.
2.  **Invite Code**:
    - If the user does not yet have an account, the modal displays a unique **Company Invite Code**.
    - The admin shares this code with the new user.
    - During signup, the new user selects "Join Company" and enters the code to be automatically added to the organization.

---

## 8. Frontend Pages

The frontend is organized into several key pages:

- **Global Layout**: Contains a persistent sidebar for navigation and a top header with a company switcher and user profile menu.
- **Dashboard**: A high-level overview with KPIs (e.g., contracts pending approval, upcoming renewals), charts, and recent activity.
- **Contracts List**: A powerful, filterable table view of all contracts. Users can create and save custom views.
- **Contract Detail View**: A comprehensive view of a single contract, organized into tabs:
  - **Overview**: Key metadata and summary.
  - **Editor**: Rich text editor with AI drafting and redlining capabilities.
  - **Documents**: Repository for attached files.
  - **Versions**: History of all versions and associated documents.
  - **AI Insights**: Results from the Gemini analysis, including risks and suggestions.
  - **Activity**: An audit log of all changes made to the contract.
- **Company Settings**: An admin-only section to manage all company-level configurations (workflows, custom fields, users, etc.).

---

## 9. Supabase MCP Server

This project is configured to use Supabase's Model Context Protocol (MCP) servers. This allows AI tools (like Claude Desktop) to inspect your Supabase database schema and run queries.

### Setup Instructions for Claude Desktop

1.  Open your `claude_desktop_config.json`.
2.  Add the configuration as per the previous section details.
3.  Restart Claude Desktop.

---

## 10. Email Configuration

To prevent emails from going to spam or displaying warning banners, this project uses **SendGrid**.

1.  **Create SendGrid Account**: Sign up at [SendGrid](https://sendgrid.com) and create an API Key.
2.  **Verify Sender Identity**: Verify a single sender or a domain (recommended) in SendGrid settings to allow sending from your chosen email address.
3.  **Set Environment Variables**: Set the following secrets in your Supabase project:
    - `SENDGRID_API_KEY`: Your SendGrid API Key.
    - `SENDER_EMAIL`: The verified email address (e.g., `notifications@your-app.com`).

Run:

```bash
npx supabase secrets set SENDGRID_API_KEY=your_sendgrid_key
npx supabase secrets set SENDER_EMAIL=notifications@your-app.com
npx supabase functions deploy send-email
```

---

## 11. Stripe Payment Integration

The application includes Stripe integration for subscription and one-time payments.

### Edge Functions

Two Supabase Edge Functions handle Stripe operations:

1. **create-checkout-session**: Creates a Stripe Checkout Session for subscriptions or one-time payments
2. **stripe-webhook**: Handles Stripe webhook events to update subscription status

### Setup Instructions

1. **Create a Stripe Account**: Sign up at [Stripe](https://stripe.com) and get your API keys from the Dashboard.

2. **Create Products and Prices**: In the Stripe Dashboard, create your subscription products and note the `price_id` for each.

3. **Set Environment Variables**: Configure the following secrets in Supabase:

```bash
# Stripe API keys
npx supabase secrets set STRIPE_SECRET_KEY=sk_test_...
npx supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...

# Optional: Default price ID for subscriptions
npx supabase secrets set STRIPE_PRICE_ID=price_...

# Your app URL for redirects
npx supabase secrets set APP_URL=https://your-app.com
```

4. **Configure Webhook Endpoint**: In the Stripe Dashboard, add a webhook endpoint:
   - URL: `https://<your-project>.supabase.co/functions/v1/stripe-webhook`
   - Events to listen for:
     - `checkout.session.completed`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_failed`

### Local Testing

To test webhooks locally, use the Stripe CLI:

```bash
# Install Stripe CLI and login
stripe login

# Forward webhooks to your local Supabase
stripe listen --forward-to http://localhost:54321/functions/v1/stripe-webhook

# Use the webhook signing secret provided by the CLI
```

### Frontend Usage

The Billing settings page (`Settings > Billing`) allows users to:

- View current subscription status
- Subscribe to a plan via Stripe Checkout
- See billing period and payment status

Update the `PRICING_PLANS` array in `components/settings/BillingSettingsManager.tsx` with your actual Stripe price IDs.

---

## 12. Getting Started

Follow these steps to set up and run the project locally.

**Prerequisites:**

- Node.js (v18 or later)
- A Supabase account

**Setup Instructions:**

1.  **Clone the repository:**

    ```bash
    git clone <repository-url>
    cd <project-directory>
    ```

2.  **Install dependencies:**

    ```bash
    npm install
    ```

3.  **Set up Supabase:**

    - Create a new project on [Supabase](https://app.supabase.io).
    - Go to the **SQL Editor** and run the schema from the `schema.txt` file to create the tables.
    - After creating the tables, run all policies from the `supabase/rls_UPDATED_ENTERPRISE.sql` file.
    - Go to **Storage** and create a new public bucket named `contracts`.
    - In your project settings, find your **Project URL** and `anon` **public key**.

4.  **Configure Environment Variables:**

    - Create a file named `.env.local` in the root of the project.
    - Add your Supabase and other necessary credentials:
      ```env
      VITE_SUPABASE_URL=YOUR_SUPABASE_PROJECT_URL
      VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
      # In a real app, API keys should be proxied via backend
      VITE_GEMINI_API_KEY=YOUR_GOOGLE_GEMINI_API_KEY
      ```

5.  **Run the development server:**
    ```bash
    npm run dev
    ```

The application should now be running at `http://localhost:5173` (standard Vite port).
