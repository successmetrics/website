# Unifying Housing Program Support: MOHCD Employee Assistant

**Client:** Mayor’s Office of Housing and Community Development (MOHCD), San Francisco  
**Industry:** Public Sector — Affordable Housing & Community Development  
**Solution:** Multi-Subagent Salesforce Agentforce Employee Assistant (SFHD Assistant)  
**Implementation Partner:** SuccessMetrics

> AI agents built on Agentforce can compress multi-screen service workflows into a single guided conversation — without removing human control from consequential actions.

## The Challenge: One Assistant, Three Very Different Jobs

MOHCD program staff answer questions about DALP loans, Below Market Rate (BMR) ownership, Teacher Next Door eligibility, income limits, and the DAHLIA portal — often while actively managing live affordable housing applications in Salesforce.

Staff needed one place to:

1. Ask detailed program and policy questions and receive answers grounded in official MOHCD documents with clear source citations.
2. Look up application status and key fields (plus household members and linked listings) by application number, and update status when needed.
3. Draft and send a consolidated summary email to an applicant that pulls together both the application record and everything discussed in the current session.

Each of these is fundamentally different work — retrieval, data operations, and communication. Bundling them into a single monolithic agent tends to produce mediocre performance across all three. MOHCD needed precision, safety, and reliability in a high-stakes housing context where application numbers can be transposed and policy language overlaps across programs.

## The Solution: A Router + Three Specialized Subagents

SuccessMetrics built the **SFHD Employee Assistant** as a single persistent panel inside Salesforce, powered by a parent router agent that recognizes intent and hands off to three purpose-built subagents. This architecture delivers excellence in each domain rather than compromise.

### The Three Subagents

- **SFHD FAQ Subagent** — Answers questions using retrieval-augmented generation against a curated MOHCD knowledge library. Always cites the source document. Includes topic disambiguation logic for overlapping terminology (e.g., “50% AMI” or “Section 8” appearing in multiple programs) and asks clarifying questions when a query could reasonably refer to more than one program area.

- **Application Status Subagent** — First validates the application number against existing records. On success, retrieves seven key fields plus household members and the linked listing. Can update application status (Draft / Submitted / Removed / Needs Review) when explicitly requested. Stops cleanly on invalid numbers.

- **SFHD Email Subagent** — Consolidates every FAQ answer from the session plus relevant application context into one well-organized email draft. Auto-fetches the applicant’s email address from the Salesforce record. Handles multi-question sessions gracefully.

## Design Decisions That Made It Production-Ready

Several architectural choices proved essential for real-world reliability in San Francisco’s housing programs:

- **Strict validation as the first step** — If an application number does not match an existing record, the agent stops immediately and clearly states the issue. No silent failures, no actions taken against the wrong applicant’s record.

- **Order-independent subagents with smart session memory** — Staff can ask a housing question, then request a status update, then ask for an email summary — or any sequence. Context retrieved earlier is reused intelligently while each subagent’s underlying flow remains self-contained for data integrity.

- **Multi-FAQ email handling from day one** — When a staff member asks three program questions during a session and then requests an email summary, the agent includes all three answers, clearly organized — not just the last one.

- **Defined, non-improvising fallback** — When a question is not covered by the knowledge base, the FAQ subagent tells the employee plainly and provides MOHCD’s direct contact information instead of guessing.

- **Explicit confirmation for every write action** — Status updates and emails are never sent without a clear summary and an explicit “YES.”

## Why Focused Subagents Outperform Monolithic Agents

A single large agent attempting retrieval, data operations, and email drafting at once tends to be mediocre at all three. By giving each subagent a single, well-defined responsibility with its own reasoning instructions, SuccessMetrics delivered:

- Higher accuracy and trust on policy answers (grounded retrieval + mandatory citations)
- Safer data operations (validation gates + confirmation requirements)
- More coherent, useful communications (full session context, not just the last exchange)

When MOHCD needs to update program content, only the FAQ subagent is modified — zero risk to application lookup or email capabilities. Each subagent is easier to test in isolation and easier to explain to end users.

## Impact

MOHCD staff now have a true single pane of glass for program knowledge, application management, and applicant communication. The assistant handles complexity while staff retain complete control over every consequential action. In a domain where application numbers get confused between programs and policy questions carry real weight for residents, this combination of precision, validation, and graceful edge-case handling is what turns a promising demo into a tool staff rely on every day.

This project exemplifies SuccessMetrics’ core philosophy: **Agentforce implementation is an architecture discipline, not a prompt-writing exercise.** The patterns — single-responsibility subagents, explicit routing, validation-first design, grounded retrieval with citations, and workflow-first discovery — are the same ones we apply across government, healthcare, and mission-driven organizations.

---

*SuccessMetrics partners with public sector agencies to design and deploy safe, focused, production-grade Agentforce solutions. [Contact us](https://successmetricscorp.com/contact) to begin a workflow mapping engagement for your team.*
