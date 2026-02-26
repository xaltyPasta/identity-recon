# Identity-Reconciliation

A transaction-safe identity reconciliation service built with Node.js, Express, TypeScript, Prisma ORM (v6.19.0), and PostgreSQL (Supabase).

The service resolves customer identities by deterministically merging contact records based on shared email and/or phone number relationships while guaranteeing exactly one primary contact per identity cluster.

Deployed on Vercel (serverless).

---

## System Overview

This service exposes a single endpoint:

```
POST /identify
```

It performs identity reconciliation by:

* Discovering existing contacts matching email and/or phone number
* Constructing a full identity cluster
* Resolving conflicting primaries deterministically
* Creating secondary contacts when new identifiers are introduced
* Returning a structured, deduplicated identity response

All reconciliation logic executes inside a database transaction to ensure atomicity and consistency.

---

## Tech Stack

* Node.js
* Express
* TypeScript (strict mode enabled)
* Prisma ORM v6.19.0
* PostgreSQL (Supabase)
* Vercel (Serverless deployment)

---

## Directory Structure

```
identity-recon/
├── package.json
├── tsconfig.json
├── prisma/
│   └── schema.prisma
└── src/
    ├── app.ts
    ├── server.ts
    ├── controllers/
    │   └── identity.controller.ts
    ├── prisma/
    │   └── client.ts
    ├── repositories/
    │   └── contact.repository.ts
    ├── routes/
    │   └── identity.route.ts
    └── services/
        └── identity.service.ts
```

---

## Architectural Design

The application follows strict layered architecture.

### 1. Route Layer (`identity.route.ts`)

* Defines the `/identify` endpoint
* Binds controller handler
* No business logic

### 2. Controller Layer (`identity.controller.ts`)

* Handles HTTP request/response
* Extracts input
* Calls service
* Returns formatted response
* No database logic

### 3. Service Layer (`identity.service.ts`)

* Core identity reconciliation algorithm
* Builds identity cluster
* Determines primary resolution
* Handles merge logic
* Creates secondary contacts if required
* Executes everything inside a transaction

This is the most critical layer.

### 4. Repository Layer (`contact.repository.ts`)

* Encapsulates all Prisma queries
* Provides reusable database methods
* Accepts optional Prisma transaction client
* Ensures ORM isolation from business logic

### 5. Prisma Client (`src/prisma/client.ts`)

* Singleton pattern
* Prevents connection explosion in development
* Serverless-compatible setup

---

## Database Design

Schema: `identity_reconciliation`

### Contact Model

| Field          | Type                     | Notes                       |
| -------------- | ------------------------ | --------------------------- |
| id             | Int (PK, auto increment) | Unique contact ID           |
| email          | String (nullable)        | Indexed                     |
| phoneNumber    | String (nullable)        | Indexed                     |
| linkedId       | Int (nullable)           | Indexed, references primary |
| linkPrecedence | Enum                     | primary / secondary         |
| createdAt      | DateTime                 | Default now()               |
| updatedAt      | DateTime                 | Auto-updated                |
| deletedAt      | DateTime (nullable)      | Soft delete ready           |

---

### Index Strategy

Indexes are created on:

* email
* phoneNumber
* linkedId

Identity resolution requires fast lookup of:

* Direct matches
* Cluster expansion
* Linked secondary contacts

---

## Identity Reconciliation Algorithm (Detailed)

All operations are wrapped inside:

```ts
prisma.$transaction(...)
```

Ensuring atomic state transitions.

---

### Step 1 — Input Validation

At least one of:

* email
* phoneNumber

Reject otherwise.

---

### Step 2 — Fetch Initial Matches

Query:

* email = input.email OR
* phoneNumber = input.phoneNumber
* deletedAt IS NULL

Possible outcomes:

* No matches
* Single primary
* Single secondary
* Multiple primaries
* Mixed cluster

---

### Step 3 — Identify Root Primaries

For each matched contact:

* If primary → include its id
* If secondary → include its linkedId

This identifies all root primary IDs.

---

### Step 4 — Build Full Identity Cluster

For each root primary:

* Fetch all contacts where:

  * id = primaryId OR
  * linkedId = primaryId

Combine and deduplicate.

This constructs the full connected component.

---

### Step 5 — Determine Final Primary

If multiple primaries exist:

* Sort by createdAt ascending
* Oldest remains primary
* All other primaries converted to secondary
* linkedId updated to final primary

This guarantees:

* Exactly one primary per cluster
* Deterministic resolution
* No ambiguous state

---

### Step 6 — Secondary Creation Logic

If incoming email or phoneNumber does not exist in cluster:

* Create new secondary contact
* linkedId = finalPrimary.id
* linkPrecedence = secondary

If already present:

* Do not create new record

Ensures idempotency.

---

### Step 7 — Response Construction

Response format strictly follows:

```json
{
  "contact": {
    "primaryContactId": number,
    "emails": string[],
    "phoneNumbers": string[],
    "secondaryContactIds": number[]
  }
}
```

Rules enforced:

* Deduplicated email list
* Deduplicated phone list
* Primary's identifiers appear first
* Secondary IDs returned explicitly
* No extra fields

---

## Transaction Safety & Concurrency Handling

All reconciliation steps run within a database transaction.

Safeguards include:

* Atomic primary conversion
* Atomic secondary creation
* Defensive recheck before insert
* Deterministic primary selection

This prevents:

* Split identity clusters
* Duplicate secondaries under concurrent requests
* Partial merge states

---

## API Contract

### Endpoint

```
POST /identify
```

### Request

```json
{
  "email": "example@test.com",
  "phoneNumber": "9999999999"
}
```

Both optional but at least one required.

---

### Response

```json
{
  "contact": {
    "primaryContactId": 1,
    "emails": ["example@test.com"],
    "phoneNumbers": ["9999999999"],
    "secondaryContactIds": [2]
  }
}
```

---

## Deployment Architecture

* Hosted on Vercel (serverless runtime)
* Express app exported as handler
* Prisma configured with connection pooling
* Supabase PostgreSQL backend

Environment variable required:

```
DATABASE_URL=<supabase_pooling_url>
```

---

## Local Development

Install dependencies:

```
npm install
```

Run development server:

```
npm run dev
```

Run migrations:

```
npx prisma migrate dev
```

---

## Engineering Characteristics

This implementation demonstrates:

* Deterministic graph merging logic
* Transaction-safe data mutations
* Proper layered architecture
* ORM isolation through repository pattern
* Serverless-compatible database handling
* Indexed relational schema design
* Idempotent API behavior

---

## Summary

This project implements a robust identity reconciliation system that:

* Merges identity clusters deterministically
* Maintains exactly one primary per cluster
* Ensures atomic consistency
* Handles concurrency safely
* Adheres to clean backend architecture principles

The system is production-ready and deployable in a serverless environment.
