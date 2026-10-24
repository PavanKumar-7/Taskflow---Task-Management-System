# TaskFlow — Collaborative Task Management Platform

[![Next.js](https://img.shields.io/badge/Next.js-16.4.2-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.3.0-blue?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)
[![Prisma](https://img.shields.io/badge/Prisma-6.19.3-2D3748?logo=prisma)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14%2B-336791?logo=postgresql)](https://www.postgresql.org/)
[![JWT](<https://img.shields.io/badge/Auth-Stateless_JWT_(jose)-orange?logo=jsonwebtokens>)](https://github.com/panva/jose)
[![Nodemailer](https://img.shields.io/badge/Email-Gmail_SMTP_%2F_Resend-007ACC)](https://nodemailer.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](#license)

TaskFlow is a modern, full-stack collaborative task and project management web application built to streamline team execution. Teams often struggle with fragmented communication, opaque task progression, and weak workspace boundaries across tools. TaskFlow resolves these bottlenecks by centralizing multi-tenant workspaces, role-based project governance, interactive Kanban workflows, task-level conversations, real-time in-app notifications, and cryptographic email invitations into a single unified platform.

> **Project Status:** TaskFlow currently runs in a verified local development environment (`http://localhost:3000`) with local PostgreSQL, backed by an automated test suite of 192 tests (191 passing, 1 opt-in skipped).

---

## Table of Contents

- [Key Features](#key-features)
- [Screenshots & Demo](#screenshots--demo)
- [Technology Stack](#technology-stack)
- [System Architecture](#system-architecture)
- [Database Design](#database-design)
- [Authentication & Security](#authentication--security)
- [Installation & Local Setup](#installation--local-setup)
- [Environment Variables](#environment-variables)
- [Email Service Configuration](#email-service-configuration)
- [REST API Reference](#rest-api-reference)
- [Testing & Quality Assurance](#testing--quality-assurance)
- [Project Structure](#project-structure)
- [Production Deployment & Limitations](#production-deployment--limitations)
- [Future Improvements](#future-improvements)
- [Author & Contact](#author--contact)

---

## Key Features

### 1. Multi-Tenant Workspaces & Role-Based Access Control (RBAC)

- **Isolated Workspaces:** Seamless switching across multiple workspaces with distinct team contexts stored and remembered via local persistence.
- **Granular Permissions:** Strict three-tier RBAC (`OWNER`, `ADMIN`, `MEMBER`):
  - **OWNER:** Complete workspace ownership, workspace deletion, role reassignment, and member removal.
  - **ADMIN:** Workspace member invitations, project creation/archival/restoration, task management, and member removal.
  - **MEMBER:** Task creation, assignments, board transitions, and comments within assigned projects.

### 2. Interactive Kanban Task Board

- **Workflow Columns:** Four status lanes: `TODO`, `IN_PROGRESS`, `IN_REVIEW`, and `DONE`.
- **Status & Priority Governance:** Move tasks between workflow columns and categorize by urgency (`LOW`, `MEDIUM`, `HIGH`, `URGENT`).
- **Team Assignment:** Assign tasks to verified workspace members with automatic unassignment cascades if a member leaves.
- **Due Dates & Focus Ranks:** Set task deadlines with automated date boundary analysis (overdue, due today, due this week).
- **Filtering & Search:** Real-time client-side and server-side task filtering by assignee, priority, status, and global text search.

### 3. Project Management Lifecycle

- **Project Governance:** Create, update, archive, restore, and delete projects.
- **Visual Status Badges:** Differentiate between active and archived project states.
- **Progress Tracking:** Aggregated progress bars calculated from task completion ratios.

### 4. Collaboration & Auditability

- **Task Comments:** Timestamped threaded discussions on individual tasks with author attribution.
- **Workspace Activity History:** Audit log capturing key mutations (task creation, status movements, member invites, role modifications).

### 5. Secure Workspace Invitations

- **Dual Recipient Support:** Invite both existing registered users and prospective team members by email.
- **Cryptographic Tokens:** 32-byte secure random tokens; only SHA-256 hashes are persisted to the database.
- **Expiration & Single-Use:** 7-day expiration window, admin revocation capability, and atomic single-use redemption enforced via PostgreSQL transactions.
- **Recipient Verification:** The accepting user's authenticated email must strictly match the invitation email.

### 6. Multi-Channel Notifications

- **In-App Notification Feed:** Real-time unread badges for task assignments, comments, and workspace invitations.
- **Read State Management:** Single-click read markers, bulk "Mark all as read" API, and sanitized in-app navigation routes.

### 7. Email Dispatch System

- **Real Gmail SMTP:** Zero-cost outbound email delivery to any external recipient via Nodemailer and Google App Passwords.
- **Resend API Integration:** Alternate provider support for custom domain production delivery.
- **Local Dev Preview Mode:** In-memory inbox (`/api/v1/dev/emails`) to inspect rendered HTML templates and tokens without dispatching external network requests.

---

## Screenshots & Demo

TaskFlow is developed and verified in a local runtime environment. Screenshots will be added to the repository as UI assets are captured.

|                Workspace Dashboard                |                    Kanban Board                    |
| :-----------------------------------------------: | :------------------------------------------------: |
| _Placeholder: `public/screenshots/dashboard.png`_ |   _Placeholder: `public/screenshots/kanban.png`_   |
|           **Workspace Members & Roles**           |           **Email Invitation & Preview**           |
|  _Placeholder: `public/screenshots/members.png`_  | _Placeholder: `public/screenshots/invitation.png`_ |

> **To add screenshots to your fork:**
>
> 1. Capture application views at `http://localhost:3000`.
> 2. Save them into `public/screenshots/` (e.g., `dashboard.png`, `kanban.png`, `members.png`).
> 3. Update the Markdown image references above.

---

## Technology Stack

| Layer                     | Technology                                                                    | Version   | Purpose in TaskFlow                                                                 |
| :------------------------ | :---------------------------------------------------------------------------- | :-------- | :---------------------------------------------------------------------------------- |
| **Frontend Framework**    | [Next.js](https://nextjs.org/)                                                | `16.4.2`  | App Router, Server Components, client state boundaries, API route handlers          |
| **UI Library**            | [React](https://react.dev/)                                                   | `19.3.0`  | Declarative component hierarchy and concurrent UI rendering                         |
| **Language**              | [TypeScript](https://www.typescriptlang.org/)                                 | `5.x`     | End-to-end static typing across database models, APIs, and client components        |
| **Styling**               | [Tailwind CSS](https://tailwindcss.com/)                                      | `v4`      | Utility-first responsive design, dark-mode ready design tokens                      |
| **UI Components**         | [Radix UI](https://www.radix-ui.com/) / [shadcn/ui](https://ui.shadcn.com/)   | Latest    | Accessible, unstyled primitives for dialogs, dropdowns, and form controls           |
| **Icons & Notifications** | [Lucide React](https://lucide.dev/) & [Sonner](https://sonner.emilkowal.ski/) | Latest    | Iconography and toast feedback notifications                                        |
| **Database**              | [PostgreSQL](https://www.postgresql.org/)                                     | `14+`     | Relational data persistence with strict foreign key constraints and ACID guarantees |
| **ORM**                   | [Prisma](https://www.prisma.io/)                                              | `6.19.3`  | Type-safe query building, connection pooling, and schema synchronization            |
| **Authentication**        | [jose](https://github.com/panva/jose)                                         | `6.2.13`  | Stateless JWT issuance and cryptographic verification via HttpOnly cookies          |
| **Password Hashing**      | [bcryptjs](https://github.com/dcodeIO/bcrypt.js)                              | `3.0.3`   | Salted multi-round password hashing                                                 |
| **Validation**            | [Zod](https://zod.dev/)                                                       | `4.6.7`   | Runtime request body validation and environment schema enforcement                  |
| **Email Transport**       | [Nodemailer](https://nodemailer.com/)                                         | `10.2.1`  | Direct SMTP transport for sending invitation emails via Gmail                       |
| **Email Service API**     | [Resend](https://resend.com/)                                                 | REST API  | Alternative cloud email provider for production domain delivery                     |
| **Testing**               | Node.js Test Runner & [tsx](https://github.com/privatenumber/tsx)             | `4.23.15` | Native TypeScript test runner executing unit and integration test suites            |

---

## System Architecture

TaskFlow leverages Next.js 16 App Router architecture, cleanly separating server-side security logic from client-side state management.

```mermaid
flowchart TD
    subgraph Client["Client Tier (React 19)"]
        UI["Web Browser"]
        Storage["Local Storage (Workspace ID)"]
    end

    subgraph Security["Edge & Middleware"]
        MW["Next.js Middleware<br/>(JWT Signature & Expiry)"]
        RateLimit["Anti-Spoofing Rate Limiter<br/>(IP Resolution Engine)"]
    end

    subgraph Server["Server Tier (Next.js 16 API Routes)"]
        AuthAPI["/api/v1/auth/*"]
        WorkspaceAPI["/api/v1/workspaces/*"]
        ProjectAPI["/api/v1/workspaces/[id]/projects/*"]
        TaskAPI["/api/v1/workspaces/[id]/tasks/*"]
        InviteAPI["/api/v1/invitations/*"]
        NotifAPI["/api/v1/notifications/*"]
    end

    subgraph Services["Core Application Services"]
        RBAC["RBAC Permission Matrix"]
        EmailService["Email Dispatcher<br/>(Gmail SMTP / Resend / Preview)"]
        NotifService["Notification Event Service"]
    end

    subgraph Persistence["Data & Storage Tier"]
        PrismaClient["Prisma ORM Client"]
        PostgresDB[("PostgreSQL Database")]
        GmailSMTP["Google Gmail SMTP Server"]
    end

    UI -->|HTTP Requests + HttpOnly Cookie| MW
    MW -->|Validated Session| RateLimit
    RateLimit --> Server

    WorkspaceAPI --> RBAC
    ProjectAPI --> RBAC
    TaskAPI --> RBAC
    TaskAPI --> NotifService

    InviteAPI --> RBAC
    InviteAPI --> EmailService
    InviteAPI --> NotifService

    EmailService -->|Port 465 SSL| GmailSMTP
    Server --> PrismaClient
    PrismaClient --> PostgresDB
```

### Request & Invitation Lifecycle Flow

1. **Authentication:** The client logs in through `/api/v1/auth/login`. On credential verification via `bcryptjs`, a stateless JWT token is generated with `jose` and set in an `HttpOnly`, `SameSite=Lax`, `Secure` session cookie (`taskflow_session`).
2. **Route Guard:** `src/middleware.ts` intercepts protected routes (`/dashboard`, `/projects`, `/workspaces`, `/settings`), verifying the JWT signature before rendering.
3. **Workspace RBAC:** Inbound API requests execute `requireWorkspaceMember(workspaceId, allowedRoles)`. Queries verify the user's active membership and role in the target workspace.
4. **Invitation Creation:** An `ADMIN` or `OWNER` submits an invitation. The system generates a 32-byte cryptographic token, hashes it using SHA-256, writes the record to PostgreSQL, and delivers the unhashed token URL strictly via the configured email provider.
5. **Atomic Acceptance:** When the recipient accepts the invitation at `/invite/[token]`, `/api/v1/invitations/[token]/accept` runs an atomic Prisma transaction (`$transaction`):
   - Confirms token hash exists and status is `PENDING`.
   - Validates that the invitation has not expired.
   - Enforces that the authenticated user's email matches the invitation recipient.
   - Upserts the `WorkspaceMember` record.
   - Marks the invitation `ACCEPTED`.
   - Records the audit activity and dispatches in-app notifications.

---

## Database Design

TaskFlow uses Prisma ORM with PostgreSQL. The database schema enforces strict relational integrity, indexed foreign keys, and cascading deletes.

```mermaid
erDiagram
    User ||--o{ WorkspaceMember : "has"
    User ||--o{ Task : "created"
    User ||--o{ Task : "assigned"
    User ||--o{ Comment : "wrote"
    User ||--o{ ActivityLog : "performed"
    User ||--o{ WorkspaceInvitation : "sent"
    User ||--o{ Notification : "receives"

    Workspace ||--o{ WorkspaceMember : "contains"
    Workspace ||--o{ Project : "owns"
    Workspace ||--o{ Task : "contains"
    Workspace ||--o{ ActivityLog : "logs"
    Workspace ||--o{ WorkspaceInvitation : "invites"
    Workspace ||--o{ Notification : "triggers"

    Project ||--o{ Task : "includes"
    Project ||--o{ ActivityLog : "tracks"

    Task ||--o{ Comment : "has"
    Task ||--o{ ActivityLog : "logs"

    User {
        string id PK
        string email UK
        string passwordHash
        string name
        string avatarUrl
        datetime createdAt
    }

    Workspace {
        string id PK
        string name
        string slug UK
        string ownerId
        datetime createdAt
    }

    WorkspaceMember {
        string id PK
        string workspaceId FK
        string userId FK
        WorkspaceRole role
        datetime joinedAt
    }

    Project {
        string id PK
        string workspaceId FK
        string name
        string description
        ProjectStatus status
        datetime createdAt
    }

    Task {
        string id PK
        string workspaceId FK
        string projectId FK
        string title
        string description
        TaskStatus status
        TaskPriority priority
        float position
        datetime dueDate
        string assigneeId FK
        string creatorId FK
    }

    WorkspaceInvitation {
        string id PK
        string workspaceId FK
        string email
        WorkspaceRole role
        string tokenHash UK
        InvitationStatus status
        string invitedById FK
        datetime expiresAt
    }

    Notification {
        string id PK
        string userId FK
        string workspaceId FK
        NotificationType type
        string title
        string message
        string link
        boolean read
        datetime createdAt
    }
```

### Relational Constraints & Enums

- **`WorkspaceRole`:** `OWNER`, `ADMIN`, `MEMBER`.
- **`ProjectStatus`:** `ACTIVE`, `ARCHIVED`.
- **`TaskStatus`:** `TODO`, `IN_PROGRESS`, `IN_REVIEW`, `DONE`.
- **`TaskPriority`:** `LOW`, `MEDIUM`, `HIGH`, `URGENT`.
- **`InvitationStatus`:** `PENDING`, `ACCEPTED`, `REVOKED`, `EXPIRED`.
- **`NotificationType`:** `TASK_ASSIGNED`, `TASK_COMMENT`, `WORKSPACE_INVITATION`.
- **Cascade Deletions:** Deleting a `Workspace` cascades to members, projects, tasks, comments, activity logs, and pending invitations. Removing a user unassigns their tasks (`SetNull`) without deleting project task history.

---

## Authentication & Security

TaskFlow implements defense-in-depth security principles across transport, session, data, and API tiers:

- **Password Security:** Salted password hashing using `bcryptjs` with verified resistance against timing attacks.
- **Stateless Session Authentication:** JWTs signed with HMAC-SHA256 via `jose`. Tokens are delivered inside `HttpOnly`, `SameSite=Lax`, `Secure` cookies, mitigating XSS token harvesting.
- **Server-Side Authorization & Isolation:** Client assertions are never trusted. Every workspace endpoint verifies membership and checks permissions on the server before query execution.
- **Hashed Invitation Tokens:** Raw tokens are generated using 32 bytes of cryptographic randomness (`crypto.randomBytes(32)`). Only the SHA-256 hash is saved in PostgreSQL, ensuring database read breaches cannot be used to redeem pending invitations.
- **Anti-Spoofing Rate Limiter:** An in-memory token bucket rate limiter protects sensitive endpoints (`/api/v1/auth/*`, `/api/v1/workspaces/[id]/invitations`). The client IP resolution engine validates IPv4/IPv6 octet syntax, prioritizes trusted ingress headers (`cf-connecting-ip`, `x-real-ip`), and parses the rightmost entry of `x-forwarded-for` to defeat attacker-injected header spoofing.
- **Safe Error Responses:** Production environments execute `formatInternalErrorMessage()`, masking internal Prisma query errors and database connection strings into generic, safe responses (`"An unexpected error occurred."`).
- **HTML Injection Prevention:** Email templates pass dynamic inputs through entity escaping (`&`, `<`, `>`, `"`, `'`) to prevent HTML/XSS injection into recipient email clients.
- **HTTP Strict Transport Security (HSTS):** Pre-configured in `next.config.ts` (`max-age=31536000; includeSubDomains`) to enforce HTTPS in production environments.

> [!NOTE]
> Rate limiting is currently managed in-memory per Node.js process. In distributed or serverless multi-instance environments, integrating an external key-value store (e.g., Upstash Redis) provides global cross-instance aggregation.

---

## Installation & Local Setup

Follow these steps to configure and run TaskFlow locally on Windows, macOS, or Linux.

### Prerequisites

- **Node.js:** `v20.x` or later (LTS recommended)
- **npm:** `v10.x` or later
- **PostgreSQL:** `v14` or later running locally (or a cloud PostgreSQL instance via Neon / Supabase)
- **Git**

### Step 1: Clone the Repository

```bash
git clone https://github.com/<your-username>/taskflow.git
cd taskflow/taskmanagementproject
```

_(If working inside the single project repository, navigate directly to the project root containing `package.json`)._

### Step 2: Install Dependencies

```bash
npm install
```

_(Running `npm install` triggers `prisma generate` automatically via the `postinstall` hook)._

### Step 3: Configure Local PostgreSQL Database

Using the PostgreSQL command line (`psql`) or pgAdmin, create a database named `taskflow`:

```sql
CREATE DATABASE taskflow;
```

### Step 4: Configure Environment Variables

Copy the example environment configuration file:

**Windows (PowerShell):**

```powershell
Copy-Item .env.example .env.local
```

**macOS / Linux:**

```bash
cp .env.example .env.local
```

Open `.env.local` in your editor and configure your database connection string and secret key:

```env
NODE_ENV=development
APP_URL=http://localhost:3000

# PostgreSQL Connection String (adjust user, password, and port to match your local setup)
DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/taskflow?schema=public"

# Session JWT Secret (minimum 32 characters in production)
AUTH_SECRET="your-development-secret-key-at-least-32-chars-long"

# Email Provider Configuration (choose 'gmail', 'resend', or 'preview')
EMAIL_PROVIDER="preview"
```

### Step 5: Synchronize Database Schema

Push the Prisma schema to your PostgreSQL database.

> [!IMPORTANT]
> The project manages its schema using `prisma db push`. Do not run destructive reset commands.

```bash
npm run db:push
```

### Step 6: Start the Development Server

```bash
npm run dev
```

### Step 7: Open the Application

Navigate to [http://localhost:3000](http://localhost:3000) in your web browser.

1. Click **Register** to create your first user account.
2. An initial personal workspace is created automatically upon registration.
3. Access the **Dashboard**, create projects, and start managing tasks.

---

## Environment Variables

All environment variables are validated at startup and request execution by Zod schemas in `src/lib/validation/env.ts`.

| Variable                    |    Required    | Default / Mode                     | Description                                                                      |
| :-------------------------- | :------------: | :--------------------------------- | :------------------------------------------------------------------------------- |
| `NODE_ENV`                  |       No       | `development`                      | Runtime environment (`development`, `test`, `production`).                       |
| `APP_URL`                   |       No       | `http://localhost:3000`            | Application origin used to build invitation links. Must use HTTPS in production. |
| `DATABASE_URL`              |    **Yes**     | —                                  | PostgreSQL connection string (`postgresql://...`).                               |
| `AUTH_SECRET`               | **Yes** (Prod) | Dev fallback                       | 32+ character key used to sign and verify stateless session JWTs.                |
| `EMAIL_PROVIDER`            |       No       | `preview`                          | Provider selection: `gmail`, `resend`, or `preview`.                             |
| `GMAIL_USER`                |  Conditional   | —                                  | Sender Gmail address. Required if `EMAIL_PROVIDER="gmail"`.                      |
| `GMAIL_APP_PASSWORD`        |  Conditional   | —                                  | 16-character Google App Password. Required if `EMAIL_PROVIDER="gmail"`.          |
| `RESEND_API_KEY`            |  Conditional   | —                                  | Resend API key (`re_...`). Required if `EMAIL_PROVIDER="resend"`.                |
| `EMAIL_FROM`                |       No       | `TaskFlow <onboarding@resend.dev>` | Display sender name and email address.                                           |
| `EMAIL_DEV_MODE`            |       No       | —                                  | Set to `preview` to capture emails locally regardless of provider setting.       |
| `RUN_REAL_EMAIL_TEST`       |       No       | `0`                                | Set to `1` to enable live Gmail dispatch testing during automated test runs.     |
| `REAL_EMAIL_TEST_RECIPIENT` |       No       | —                                  | Target email address when `RUN_REAL_EMAIL_TEST=1`.                               |

> [!CAUTION]
> Never commit `.env.local` or publish credentials to GitHub. TaskFlow's `.gitignore` explicitly excludes all `.env*` files.

---

## Email Service Configuration

TaskFlow supports three distinct email delivery modes:

### Option A: Real Gmail SMTP (Recommended for Zero-Cost Testing)

Sends real invitation emails directly to any Gmail or external address without purchasing a domain.

1. Enable **2-Step Verification** on your Google Account: [Google Account Security](https://myaccount.google.com/security).
2. Generate an **App Password**: [Google App Passwords](https://myaccount.google.com/apppasswords).
   - App Name: `TaskFlow`
   - Google will generate a 16-character code (e.g., `abcd efgh ijkl mnop`).
3. Add the credentials to your `.env.local`:
   ```env
   EMAIL_PROVIDER="gmail"
   GMAIL_USER="your-email@gmail.com"
   GMAIL_APP_PASSWORD="abcd efgh ijkl mnop"
   ```

_(Spaces in the app password are automatically stripped by the runtime validator)._

### Option B: Resend API (For Custom Domains)

For teams with a verified domain configured in Resend:

```env
EMAIL_PROVIDER="resend"
RESEND_API_KEY="re_123456789"
EMAIL_FROM="TaskFlow <invitations@yourdomain.com>"
```

_(Note: Resend accounts using `onboarding@resend.dev` without a custom domain restrict delivery to the account owner's email)._

### Option C: Local Dev Preview Mode (No External Emails)

Captures outbound emails in an in-memory buffer for local UI inspection. No emails leave your machine:

```env
EMAIL_PROVIDER="preview"
EMAIL_DEV_MODE="preview"
```

Inspect captured emails via `GET /api/v1/dev/emails`.

### Development Seed CLI Tool

TaskFlow includes a developer CLI script to seed workspace invitations directly:

```bash
npx tsx scripts/seed-invitation.ts colleague@example.com MEMBER my-workspace-slug
```

_(This CLI tool includes safety guards that strictly abort if executed in production)._

---

## REST API Reference

All application endpoints are served under `/api/v1` and return structured JSON responses.

### Authentication Endpoints

| Method | Endpoint                | Description                                          | Auth Required |
| :----- | :---------------------- | :--------------------------------------------------- | :-----------: |
| `POST` | `/api/v1/auth/register` | Register a new user and create an initial workspace  |    Public     |
| `POST` | `/api/v1/auth/login`    | Authenticate credentials and receive HttpOnly cookie |    Public     |
| `POST` | `/api/v1/auth/logout`   | Invalidate session by clearing the auth cookie       |    Public     |
| `GET`  | `/api/v1/auth/me`       | Fetch authenticated user profile and memberships     |   Required    |

### Workspaces & Member Management

| Method   | Endpoint                                   | Description                                                 |    Required Role     |
| :------- | :----------------------------------------- | :---------------------------------------------------------- | :------------------: |
| `GET`    | `/api/v1/workspaces`                       | List all workspaces the user belongs to                     |        Member        |
| `POST`   | `/api/v1/workspaces`                       | Create a new workspace (user becomes `OWNER`)               |         Auth         |
| `GET`    | `/api/v1/workspaces/:id`                   | Fetch workspace metadata                                    |        Member        |
| `PATCH`  | `/api/v1/workspaces/:id`                   | Update workspace name/slug                                  |    Owner / Admin     |
| `DELETE` | `/api/v1/workspaces/:id`                   | Delete workspace and all associated data                    |        Owner         |
| `GET`    | `/api/v1/workspaces/:id/members`           | List members and roles                                      |        Member        |
| `PATCH`  | `/api/v1/workspaces/:id/members/:memberId` | Update a member's role (`ADMIN` $\leftrightarrow$ `MEMBER`) |        Owner         |
| `DELETE` | `/api/v1/workspaces/:id/members/:memberId` | Remove member or leave workspace                            | Owner / Admin / Self |
| `GET`    | `/api/v1/workspaces/:id/activity`          | Retrieve workspace audit activity history                   |        Member        |
| `GET`    | `/api/v1/workspaces/:id/analytics`         | Fetch analytics, completion metrics, and overdue tasks      |        Member        |

### Projects & Tasks

| Method   | Endpoint                                        | Description                                 | Required Role |
| :------- | :---------------------------------------------- | :------------------------------------------ | :-----------: |
| `GET`    | `/api/v1/workspaces/:id/projects`               | List projects in workspace                  |    Member     |
| `POST`   | `/api/v1/workspaces/:id/projects`               | Create a new project                        | Owner / Admin |
| `GET`    | `/api/v1/workspaces/:id/projects/:projectId`    | Fetch project details                       |    Member     |
| `PATCH`  | `/api/v1/workspaces/:id/projects/:projectId`    | Edit, archive, or restore project           | Owner / Admin |
| `DELETE` | `/api/v1/workspaces/:id/projects/:projectId`    | Delete project and cascade tasks            | Owner / Admin |
| `GET`    | `/api/v1/workspaces/:id/tasks`                  | List/filter tasks across the workspace      |    Member     |
| `POST`   | `/api/v1/workspaces/:id/tasks`                  | Create a task in a project                  |    Member     |
| `GET`    | `/api/v1/workspaces/:id/tasks/:taskId`          | Fetch task details with comments            |    Member     |
| `PATCH`  | `/api/v1/workspaces/:id/tasks/:taskId`          | Update status, priority, due date, assignee |    Member     |
| `DELETE` | `/api/v1/workspaces/:id/tasks/:taskId`          | Delete task                                 |    Member     |
| `POST`   | `/api/v1/workspaces/:id/tasks/:taskId/comments` | Post a comment on a task                    |    Member     |

### Invitations & Notifications

| Method   | Endpoint                                    | Description                             | Auth Required |
| :------- | :------------------------------------------ | :-------------------------------------- | :-----------: |
| `GET`    | `/api/v1/workspaces/:id/invitations`        | List pending workspace invitations      | Owner / Admin |
| `POST`   | `/api/v1/workspaces/:id/invitations`        | Create and email an invitation token    | Owner / Admin |
| `DELETE` | `/api/v1/workspaces/:id/invitations/:invId` | Revoke a pending invitation             | Owner / Admin |
| `GET`    | `/api/v1/invitations/:token`                | Validate an invitation token's metadata |    Public     |
| `POST`   | `/api/v1/invitations/:token/accept`         | Accept an invitation into the workspace |   Required    |
| `GET`    | `/api/v1/notifications`                     | Fetch user notifications                |   Required    |
| `GET`    | `/api/v1/notifications/unread-count`        | Get count of unread notifications       |   Required    |
| `PATCH`  | `/api/v1/notifications/:id/read`            | Mark individual notification as read    |   Required    |
| `PATCH`  | `/api/v1/notifications/mark-all-read`       | Mark all notifications as read          |   Required    |

---

## Testing & Quality Assurance

TaskFlow includes comprehensive automated test coverage spanning authentication, role matrices, Kanban state transitions, invitation hashing, notification routing, and security guardrails.

### Automated Test Verification

Run the complete test suite using the Node.js test runner:

```bash
npm test
```

_Current test suite results:_

- **Total Tests:** 192 tests across 64 suites.
- **Passing:** 191 passed.
- **Skipped:** 1 skipped (the real Gmail live delivery test, which is skipped by default to avoid unintended inbox traffic during automated runs).
- **Execution Time:** ~7 seconds.

### Opt-In Live Gmail SMTP Test

To execute the live email integration test verifying actual SMTP delivery through Google's mail servers:

```bash
RUN_REAL_EMAIL_TEST=1 REAL_EMAIL_TEST_RECIPIENT="your-email@example.com" npm test
```

### Type Checking & Code Quality

```bash
# Verify static TypeScript types (0 errors)
npx tsc --noEmit

# Run ESLint across Next.js and TypeScript files (0 warnings / errors)
npm run lint

# Check code formatting with Prettier
npm run format:check

# Compile production Turbopack build
npm run build
```

---

## Project Structure

```text
taskmanagementproject/
├── prisma/
│   └── schema.prisma               # Database models, enums, and relations
├── public/
│   ├── favicon.ico
│   └── screenshots/                # Application UI preview captures
├── scripts/
│   └── seed-invitation.ts          # Safe development CLI invitation seeder
├── src/
│   ├── app/                        # Next.js 16 App Router
│   │   ├── (auth)/                 # Unauthenticated layout group
│   │   │   ├── invite/[token]/     # Public invitation redemption page
│   │   │   ├── login/              # User sign-in page
│   │   │   └── register/           # Registration page
│   │   ├── (dashboard)/            # Protected application layout group
│   │   │   ├── dashboard/          # Analytics overview and overdue tasks
│   │   │   ├── projects/           # Project list and [projectId] Kanban board
│   │   │   ├── settings/           # User account and profile settings
│   │   │   └── workspaces/         # Workspace member management & invitations
│   │   ├── api/v1/                 # REST API route handlers
│   │   ├── layout.tsx              # Root HTML shell and theme providers
│   │   ├── globals.css             # Tailwind CSS tokens and layout styles
│   │   └── page.tsx                # Index redirect to /dashboard
│   ├── components/                 # Modular React UI components
│   │   ├── auth/                   # Login and registration forms
│   │   ├── dashboard/              # Metrics, charts, and progress cards
│   │   ├── kanban/                 # Kanban columns, task cards, modal dialogs
│   │   ├── layout/                 # Top navigation, sidebar, notifications popover
│   │   ├── projects/               # Project cards, creation dialogs, archive controls
│   │   ├── ui/                     # Accessible primitives (buttons, dialogs, inputs)
│   │   └── workspaces/             # Member lists, role selectors, invite dialogs
│   ├── context/                    # React Context providers (WorkspaceContext)
│   ├── hooks/                      # Custom hooks (useWorkspace, useAuth, useDebounce)
│   ├── lib/                        # Business logic and server services
│   │   ├── analytics/              # Aggregations, completion rates, overdue dates
│   │   ├── api/                    # Standardized JSON response helpers
│   │   ├── auth/                   # Password hashing and stateless JWT lifecycle
│   │   ├── db/                     # Prisma client singleton and health checks
│   │   ├── email/                  # Gmail SMTP, Resend, and local preview engine
│   │   ├── invitations/            # Cryptographic token hashing and expiration
│   │   ├── notifications/          # In-app notification creation and read state
│   │   ├── permissions/            # RBAC validation matrix (requireWorkspaceMember)
│   │   ├── security/               # Anti-spoofing rate limiting & IP resolution
│   │   └── validation/             # Zod input and environment validation schemas
│   ├── middleware.ts               # Edge authentication guard & route protection
│   └── types/                      # Shared TypeScript models and API contracts
├── tests/                          # Automated test suites (12 test suites, 192 tests)
├── .env.example                    # Sample environment variable template
├── next.config.ts                  # Security headers (HSTS) and Next.js settings
├── package.json                    # Project metadata, dependencies, and npm scripts
└── tsconfig.json                   # Strict TypeScript compiler configuration
```

---

## Production Deployment & Limitations

### Current Deployment State

TaskFlow is currently configured for and verified in **local execution**. The database runs on a local PostgreSQL instance. No public deployment has been executed yet.

### Production Deployment Prerequisites

Before deploying TaskFlow to a cloud hosting platform (such as [Vercel](https://vercel.com) for Next.js and [Neon](https://neon.tech) / [Supabase](https://supabase.com) for managed PostgreSQL):

1. **Hosted PostgreSQL:** Provision a cloud PostgreSQL database with SSL connection pooling enabled (`?sslmode=require`).
2. **Schema Push:** Run `npx prisma db push` against the production `DATABASE_URL` to create tables.
3. **Environment Security:**
   - Configure a strong, randomly generated `AUTH_SECRET` ($\ge 32$ characters) using `openssl rand -base64 32`.
   - Set `APP_URL` to your production HTTPS domain (e.g., `https://taskflow.yourdomain.com`). TaskFlow automatically enforces HTTPS in production mode and blocks invitation links using `localhost`.
   - Set `EMAIL_PROVIDER="gmail"` with your Google App Password, or `EMAIL_PROVIDER="resend"` with a verified custom domain.
4. **Rate Limiting Scalability:** Note that TaskFlow's built-in rate limiter is in-memory per Node.js process. When deploying to serverless platforms where instances scale horizontally, connect an external store like [Upstash Redis](https://upstash.com) to share rate limit counts across cold starts.

---

## Future Improvements

The following features represent the planned development roadmap for future iterations of TaskFlow:

- [ ] **Real-Time Collaboration:** Integrate WebSockets or Server-Sent Events (SSE) to reflect live Kanban card drags, edits, and comments across concurrent user sessions.
- [ ] **File Attachments:** Allow users to upload and attach documents, screenshots, and assets to individual task cards via S3 / Cloudflare R2 storage.
- [ ] **OAuth 2.0 Providers:** Add single-click social authentication via GitHub and Google alongside existing email/password JWT authentication.
- [ ] **Distributed Rate Limiting:** Introduce an Upstash Redis adapter for serverless multi-region rate limit synchronization.
- [ ] **Data Export:** Support exporting project reports and task history to CSV and PDF formats for reporting.

---

## Author & Contact

Developed by **[Pavan]** — Aspiring Software Development Engineer (SDE) & Full Stack Developer.

- **GitHub:** [https://github.com/<your-username>](https://github.com/<your-username>)
- **LinkedIn:** [https://linkedin.com/in/<your-username>](https://linkedin.com/in/<your-username>)
- **Email:** `pavan<placeholder>@example.com`

---

## License

This project is licensed under the [MIT License](LICENSE) — feel free to use, modify, and distribute this codebase for educational and portfolio purposes.
