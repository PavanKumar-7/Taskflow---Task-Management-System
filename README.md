# TaskFlow

### Project Management & Team Collaboration Platform

A full-stack project management application built to help teams organize workspaces, manage projects, track tasks through Kanban boards, and collaborate with role-based access control.

**[🌐 Live Demo](https://taskflow-task-management-system-five.vercel.app/)** · **[📦 GitHub Repository](https://github.com/PavanKumar-7/Taskflow---Task-Management-System)**

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-4169E1?logo=postgresql&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma&logoColor=white)
![Vercel](https://img.shields.io/badge/Deployment-Vercel-black?logo=vercel)

---

## Overview

TaskFlow is a full-stack project management platform designed to simplify project organization and team collaboration. It enables users to manage workspaces, organize projects, track task progress through Kanban boards, and collaborate with team members through invitations and role-based permissions.

Built with Next.js, TypeScript, Prisma, and PostgreSQL, TaskFlow combines a responsive user interface with backend API routes and persistent database storage. The application is deployed on Vercel, with Neon providing the PostgreSQL database.

## Key Features

### Workspace & Team Collaboration

- Create and manage workspaces.
- Invite collaborators through email invitations.
- Assign workspace roles and manage member access.
- Organize team collaboration within workspaces.

### Project Management

- Create, edit, archive, and restore projects.
- Delete projects when they are no longer needed.
- Organize projects within workspaces.
- Access project-specific task boards.

### Task Management

- Visualize tasks through a Kanban board.
- Manage task status and priority.
- Track due dates, task positions, and estimated hours.
- Add comments and maintain activity records.

### Authentication & Security

- User registration and login.
- Password hashing with bcrypt.
- JWT-based authentication using HTTP-only cookies.
- Input validation with Zod.
- Server-side authorization and environment-based configuration.

### Email Invitations

- Send workspace invitations through a configured email provider.
- Generate invitation links using the application's public URL.
- Support collaboration between workspace members and invited users.

## Technology Stack

| Category | Technologies |
|---|---|
| Frontend | Next.js App Router, React, TypeScript |
| Styling | Tailwind CSS |
| Backend | Next.js Route Handlers, REST APIs |
| Database | PostgreSQL, Neon |
| ORM | Prisma |
| Authentication | bcryptjs, jose, HTTP-only cookies |
| Validation | Zod |
| Notifications | Sonner |
| Deployment | Vercel |

## Architecture

```text
┌────────────────────────────────┐
│          User Interface         │
│          Next.js + React        │
└───────────────┬────────────────┘
                │
                ▼
┌────────────────────────────────┐
│         Next.js Backend         │
│                                │
│  Authentication and Sessions   │
│  Workspace and Member APIs     │
│  Project and Task APIs         │
│  Invitations and Comments      │
└───────────────┬────────────────┘
                │
                ▼
┌────────────────────────────────┐
│            Prisma ORM           │
└───────────────┬────────────────┘
                │
                ▼
┌────────────────────────────────┐
│        Neon PostgreSQL          │
│       Persistent Data           │
└────────────────────────────────┘

       Next.js Backend
              │
              ▼
       Email Provider
       Invitation Delivery
```

## Getting Started

### Prerequisites

Make sure you have the following installed:

- Node.js
- npm
- PostgreSQL database or a Neon PostgreSQL database
- Git

### 1. Clone the repository

```bash
git clone https://github.com/PavanKumar-7/Taskflow---Task-Management-System.git
cd Taskflow---Task-Management-System
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the project root and configure the required environment variables.

```dotenv
DATABASE_URL="YOUR_POSTGRESQL_CONNECTION_STRING"
AUTH_SECRET="YOUR_STRONG_AUTH_SECRET"
APP_URL="http://localhost:3000"
```

Configure the email provider and its required credentials if you want to use email invitations locally. Refer to the application's implementation for the exact provider-specific variable names.

**Security:** Never commit `.env` files, database credentials, authentication secrets, or email API keys to GitHub.

### 4. Generate Prisma Client

```bash
npm run db:generate
```

### 5. Initialize the database

For a new development database, synchronize the Prisma schema:

```bash
npm run db:push
```

Make sure `DATABASE_URL` points to your intended development database before running this command. Review schema changes carefully before applying them to any database containing important data.

### 6. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Development Commands

| Command | Description |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Build the production application |
| `npm start` | Start the production server |
| `npm test` | Run the configured test suite |
| `npm run lint` | Run ESLint |
| `npm run db:generate` | Generate Prisma Client |
| `npm run db:push` | Synchronize the Prisma schema with the database |

## Deployment

TaskFlow is deployed on **Vercel**, with **Neon PostgreSQL** providing the production database.

The production environment requires appropriate configuration for:

- `DATABASE_URL` — PostgreSQL connection string.
- `AUTH_SECRET` — authentication signing secret.
- `APP_URL` — public HTTPS URL of the deployed application.
- Email provider variables — credentials required for invitation delivery.

Configure environment variables through the deployment platform rather than committing secrets to source control.

After changing production environment variables, redeploy the application so the updated configuration takes effect.

## Security Considerations

- Store secrets in environment variables.
- Use HTTPS for production deployments.
- Protect authentication cookies and JWT signing secrets.
- Validate API inputs on the server.
- Enforce workspace membership and role permissions on protected operations.
- Review database schema changes before applying them to production.

## Author

**Pavan Kumar**

- GitHub: [PavanKumar-7](https://github.com/PavanKumar-7)
- Email: [pavannkumarr7@gmail.com](mailto:pavannkumarr7@gmail.com)

---

*Built with Next.js, TypeScript, Prisma, and PostgreSQL.*