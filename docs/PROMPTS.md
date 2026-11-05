# AI Prompt Log

Every prompt I gave the AI assistant (Claude Code, Claude Opus 5.5) while designing and building this License Management System, in order and quoted exactly as typed (typos included). I'll walk through these in the in-person AI usage review.

- **Date:** 2026-11-05
- **Tool:** Claude Code (VS Code extension)
- **Repository:** `LMS/`

---

## Prompt 1: Requirements and architecture (no code yet)

I pasted the assignment brief, followed by my instructions.

<details>
<summary>Pasted assignment brief (click to expand)</summary>

```text
Campus Evaluation Challenge: B2B License Management System (v2 — Fresher)
Architecture & System Design Assessment (AI-Assisted)

1. The Challenge (Problem Statement)
Design the high-level system architecture, database schema, and REST API contract for a self-service License Managemehttps://github.com/Jeyasangavint System (LMS).
An enterprise corporate client purchases software in bulk (e.g., a pool of 500 licenses). Enterprise administrators must be able to distribute and revoke seats to their employees, staying within the purchased limit. The company's SaaS application must be able to check whether an employee currently holds a valid, active license.
Time guidance: 40 minutes.

2. Core Requirements
2.1 Functional Workflows
Create License Pool: An administrator establishes a license pool of N seats bound by a start date and an end date.
Manage Seats: An administrator assigns an available seat to an employee (identified by email) or revokes an active seat so it returns to the pool. Every assign and revoke action must record who performed it, which employee was affected, and when.
Verify License: The SaaS application checks whether a given employee email currently holds a valid, active license.
2.2 System Constraints & Edge Cases
Pool Boundary: The number of actively assigned seats must never exceed the purchased pool capacity N. An allocation request when the pool is full must be rejected with a clear error.
Date Window: Allocation must be rejected, and verification must report the employee as unlicensed, if the current date falls outside the pool's active date range.
Double Allocation: If two administrators attempt to allocate the final remaining seat at the same time, only one allocation may succeed. Your design must explain how this is prevented.

3. Expected Deliverables
Candidates must use AI assistants (e.g., Claude, Copilot) to design, refine, and deliver the following components.
A. High-Level System Architecture (Mermaid.js)
Provide a simple architecture diagram using Mermaid syntax showing how these components interact:
Admin UI (enterprise administrator manages pools and seats)
API / App Layer (business logic)
Database
The diagram must show the request flow for at least one seat allocation path and one license verification path.
B. Database Schema Design
Define your own tables (or collections), including field names, data types, primary keys, and foreign keys. Your schema must account for:
Pool capacity and active date range
Seat assignments and revocations
Audit history for assign/revoke actions
How the "never exceed N active seats" rule is enforced — in the database, in application logic, or both (state your choice)
C. API Design
Define a REST API contract sufficient to support all three workflows above. For each endpoint, specify the path, HTTP method, request body, response body, and HTTP status codes — including error responses for a full pool, an expired pool, and invalid requests.
D. Concurrency Note
A brief explanation — tied to your own schema and API — of how two administrators racing for the last available seat do not both succeed.
E. AI Usage Review (In-Person)
Be prepared to walk the interviewer through every AI prompt used during the session and show design artifacts on your laptop (with timestamp visible). No separate document submission is required — this is reviewed live at the end of the round.

4. Extended Scope (Not a mandate)
Caching, Redis, or read replicas
Microservices, message queues, or container orchestration
Multi-tenant company hierarchies
Payment or billing
```

</details>

```text
this is an application assigned for me to design and build from scratch

dont start with the coding now

act as a prinicple softwarre architect with great expreince deisgning scalable production grade-application

first identify functional requirements, non-functional reqs, user roles, contraints, edge cases etc

provide me with an appropriate architecture, and why its suiting the application
also identify frontend, backend , database services

first well walk thru all this and then continue
```

**What came back:** functional and non-functional requirements, user roles, constraints, 15 edge cases, a recommended modular monolith (React, API, PostgreSQL) with the reasons for it, the alternatives it rejected, and an initial Mermaid diagram.

---

## Prompt 2: Stack decision and database design

```text
this looks good overall. I'd prefer react + typescript + vite for the frontend and node.js + express + typescript for the backend since I'm more comfortable with that stack and can implement and explain it confidently. postgreSQL is definitely a good choice, especially for transactions and concurrency control. I'm okay with using raw SQL/pg for critical allocation logic. 

Next lets do the database design. provide me with database table or collections. define relationships ..also explain indexing strategies ..consider acid properties, and provide consitency and scalabiloyt
```

**What came back:** the table definitions (SQL DDL), an entity-relationship diagram, the relationships, the indexing strategy (partial unique index, verify index), the assign and revoke transactions, how each ACID property applies, how the seat counter stays consistent, and the scalability path.

---

## Prompt 3: Failure points, request flow, API, auth and validation

```text
okay good. we need to identify failure points as well. also explain the request response flow, and api endpoints should be deifned. 
provide me with authentication and authorisation and data validation
```

**What came back:** the full REST API contract (10 endpoints with request and response bodies and status codes), JWT login for admins and API keys for the SaaS app, role and tenant authorization, three layers of validation with Zod schemas, the middleware pipeline, sequence diagrams, 22 failure points with mitigations, and a catalogue of error codes.

---

## Prompt 4: Build the application

```text
now proceed with the impemetation part based on all requirements, deisgn ,a rchitectiure, database scehma,, api etc
start building the complete application in the current repository. follow the agreed tech stack and architecture without changing decisions unnecessarily.
immplement incrementally, ensuring the database, backend, and frontend are fully integrated, prioritizing correctness, concurrency safety, security, maintainability, etc
do not repeat the design documentation. Focus on implementation, testing, and verifying that everything works end-to-end. 
if any doubt ask me, dont assume
```

### My answers to the AI's clarifying questions

| Question | My choice |
|---|---|
| How should PostgreSQL run locally? | **Docker Compose** |
| Repository layout? | **npm workspaces monorepo** (`shared/`, `backend/`, `frontend/`) |
| Git commits during the build? | **No commits** (I commit myself) |
| Test stack? | **Vitest + Supertest** |

---

## Prompt 5: Course correction during the build

I stopped the AI partway through (it was adding rate limiting before anything ran) and redirected it:

```text
for now focus more on forntend, backedn and database, like a proper running system...lets build other edge cases as next iteration
```

**What came back:** a working system end to end: PostgreSQL migration and seed data, an Express API (auth, pools, seats, audit, verify) with the atomic seat reservation, and a React frontend (login, pool list and create, pool detail with assign and revoke, seats and audit tables, a page that simulates the SaaS verify call). It was verified with a 26-check end-to-end script, including 20 admins racing at the same moment for the last 2 seats (exactly 2 succeeded), run both directly against the API and through the frontend.

---

## Prompt 6: Architecture document

```text
give a [proper documet of the architecture used, stating why this architecture inlcuding mermaid diagrams
```

**What came back:** [`docs/ARCHITECTURE.md`](ARCHITECTURE.md), with 15 Mermaid diagrams, the architecture reasoning, alternatives considered, data, concurrency, security, deployment, decision records, and traceability to deliverables A–D.

---

## Prompt 7: Save the prompts

```text
put all my prompts into one file, not to lose them
```

**What came back:** this file.

---

> **To keep this log current:** add each new prompt at the end, quoted exactly as typed.
