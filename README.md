# TaskFlow — Collaborative Task Management Platform

A full-stack project and task management application built with **Next.js, TypeScript, PostgreSQL, and Prisma**. Organize projects, manage tasks with Kanban boards, collaborate with teammates, and control access through role-based permissions.

**Repository:** [GitHub](https://github.com/PavanKumar-7/Taskflow---Task-Management-System)

**Live Demo:** Coming soon — deployment in progress.

---

## Overview

TaskFlow is designed to bring project planning and team collaboration into one platform. It supports multiple workspaces, project lifecycle management, task assignments, task discussions, workspace invitations, and in-app notifications.

The application uses Next.js for the frontend and backend, PostgreSQL for persistent data, and Prisma ORM for database access.

## Features

- **Workspace management:** Create workspaces and manage team members with Owner, Admin, and Member roles.
- **Project management:** Create, update, archive, restore, and delete projects.
- **Kanban boards:** Organize tasks across To Do, In Progress, In Review, and Done.
- **Task tracking:** Set priorities, due dates, assignees, and task status.
- **Collaboration:** Add task comments and view workspace activity.
- **Invitations:** Invite team members by email with expiring, single-use invitation tokens.
- **Notifications:** Track task assignments, comments, and workspace invitations.
- **Authentication:** Password hashing, signed JWT sessions, and HttpOnly cookies.
- **Input validation:** Validate requests using Zod and enforce server-side workspace permissions.
- **Email integration:** Support Gmail SMTP, Resend, and a local development preview mode.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js, React, TypeScript |
| Styling | Tailwind CSS v4 |
| Backend | Next.js App Router, REST API Route Handlers |
| Database | PostgreSQL |
| ORM | Prisma |
| Authentication | jose, JWT, bcryptjs |
| Validation | Zod |
| Email | Nodemailer, Resend |
| Testing | Node.js Test Runner, tsx |
| Hosting plan | Vercel |
| Database hosting plan | Managed PostgreSQL provider |

## Screenshots

Screenshots will be added after capturing the application UI.

Suggested screenshots:
- Dashboard and project overview
- Kanban task board
- Workspace members and role management
- Invitation and notification flows

## Architecture

```text
User Browser
     |
     v
Next.js Application
     |
     +---- React UI
     |
     +---- REST API
               |
               v
      Authentication & RBAC
               |
               v
           Prisma ORM
               |
               v
       Hosted PostgreSQL
```

## Run Locally

### Prerequisites

- Node.js 20 or later
- npm
- PostgreSQL
- Git

### 1. Clone the repository

```bash
git clone https://github.com/PavanKumar-7/Taskflow---Task-Management-System.git
cd Taskflow---Task-Management-System
```

If the repository contains the application in a nested directory, navigate to the directory containing `package.json` before continuing.

### 2. Install dependencies

```bash
npm install
```

### 3. Create the database

Create a PostgreSQL database named `taskflow` using PostgreSQL or pgAdmin.

```sql
CREATE DATABASE taskflow;
```

### 4. Configure environment variables

Copy `.env.example` to `.env.local`.

**Windows PowerShell**

```powershell
Copy-Item .env.example .env.local
```

**macOS / Linux**

```bash
cp .env.example .env.local
```

Configure your local database connection and application secret in `.env.local`.

```dotenv
NODE_ENV=development
APP_URL=http://localhost:3000
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/taskflow?schema=public"
AUTH_SECRET="replace-with-a-long-random-development-secret"
EMAIL_PROVIDER="preview"
```

Replace the database credentials and secret with your own values. Never commit `.env.local` or real credentials.

### 5. Synchronize the schema

```bash
npm run db:push
```

Ensure the command targets your intended development database.

### 6. Start the application

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000).

## Deploy to Vercel

The following is the intended deployment workflow. The production deployment is not yet confirmed.

### Step 1: Prepare a hosted PostgreSQL database

Provision a managed PostgreSQL database through a provider such as Neon or Supabase.

Obtain the appropriate connection string for your deployment environment. Use the provider's recommended pooled connection for runtime queries and its recommended direct connection for schema-management commands if required by the provider.

### Step 2: Import the GitHub repository

1. Sign in to Vercel.
2. Choose **Add New Project**.
3. Import `PavanKumar-7/Taskflow---Task-Management-System`.
4. Select the directory containing `package.json` as the project root if the application is nested.
5. Allow Vercel to detect the Next.js framework.
6. Confirm the build settings match the project's scripts.

### Step 3: Configure production environment variables

In Vercel, open **Project Settings → Environment Variables** and configure the values required by the application.

| Variable | Production configuration |
|---|---|
| `DATABASE_URL` | Connection string for hosted PostgreSQL |
| `AUTH_SECRET` | Strong, randomly generated secret of at least 32 characters |
| `APP_URL` | Final public HTTPS URL of your deployed application |
| `NODE_ENV` | Set by the deployment platform; follow Vercel's environment behavior |
| `EMAIL_PROVIDER` | `preview`, `gmail`, or `resend`, depending on your intended setup |
| `GMAIL_USER` | Required if Gmail delivery is enabled |
| `GMAIL_APP_PASSWORD` | Required if Gmail delivery is enabled |
| `RESEND_API_KEY` | Required if Resend delivery is enabled |
| `EMAIL_FROM` | Optional configured sender identity |

Set only the variables required by the code and the email provider you choose. Add production values separately from local development values. Never expose secrets through `NEXT_PUBLIC_` variables.

### Step 4: Initialize the production database

Before running database commands, verify that `DATABASE_URL` points to the **production database**, not your local development database.

Run the project's supported schema synchronization command against that database:

```bash
npm run db:push
```

Review any schema changes before applying them. For a long-lived production application, evaluate a controlled migration workflow instead of relying indefinitely on schema push.

### Step 5: Deploy and verify

Deploy the project through Vercel and inspect the build logs.

After deployment, verify:

- The application loads over HTTPS.
- Registration and login work.
- Sessions and protected routes behave correctly.
- Workspace and project operations persist in the hosted database.
- Task creation, updates, and comments work.
- Invitation and notification flows work.
- Email delivery works if a live email provider is enabled.

Add the final deployment URL to the top of this README only after these checks succeed.

## Environment Variables and Security

- Keep `.env.local` and production secrets out of Git.
- Use a strong production `AUTH_SECRET`.
- Use HTTPS for the deployed application.
- Configure the production `APP_URL` to match the final domain.
- Restrict database credentials and access to authorized environments.
- Verify that every protected API route enforces server-side authorization.
- Test email invitations and expiration behavior in the deployed environment.

**Deployment consideration:** The application's current rate limiter uses in-memory state. In a serverless environment, state may not be shared across instances. Consider a shared rate-limiting store before relying on it for production-wide rate enforcement.

## Testing

Run the project's available quality checks before deployment.

```bash
npm test
npx tsc --noEmit
npm run lint
npm run format:check
npm run build
```

Resolve relevant failures before deploying. Publish test counts only after verifying the latest test output.

## Project Structure

```text
taskmanagementproject/
├── prisma/
│   └── schema.prisma
├── public/
├── scripts/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   ├── (dashboard)/
│   │   └── api/v1/
│   ├── components/
│   ├── context/
│   ├── hooks/
│   ├── lib/
│   ├── middleware.ts
│   └── types/
├── tests/
├── .env.example
├── next.config.ts
├── package.json
└── tsconfig.json
```

## Roadmap

- Deploy the application and add a public demo link.
- Add real application screenshots.
- Add real-time collaboration.
- Support task file attachments.
- Add GitHub and Google OAuth.
- Integrate shared rate limiting for distributed deployments.
- Add project report exports.

## Author

**Pavan Kumar** — Aspiring Software Development Engineer and Full-Stack Developer

- [GitHub Profile](https://github.com/PavanKumar-7)
- [TaskFlow Repository](https://github.com/PavanKumar-7/Taskflow---Task-Management-System)
- Email: pavannkumarr7@gmail.com

## License

MIT License. See the `LICENSE` file for details.
