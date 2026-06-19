# Transforming Benefits Administration: SFHSS Research Assistant

**Client:** San Francisco Health Service System (SFHSS)  
**Industry:** Public Sector — Government Healthcare Benefits Administration  
**Solution:** Multi-Subagent Salesforce Agentforce Research Assistant  
**Implementation Partner:** SuccessMetrics

> AI agents built on Agentforce can compress multi-screen service workflows into a single guided conversation — without removing human control from consequential actions.

## The Challenge

Health Benefits Specialists at SFHSS manage Qualifying Life Events (QLEs) — life changes that trigger updates to members’ health benefits eligibility. Every member interaction follows a repeatable but fragmented pattern:

- Pull the member’s case record
- Answer detailed questions about Medicare, enrollment, and coverage
- Decide on and execute the next step (such as creating a mailing record for physical documents)
- Confirm the action and close the loop with a follow-up email

Before Agentforce, each of these tasks lived on a different screen inside Salesforce. Specialists constantly switched between records, knowledge articles, and email, manually re-entering information and losing valuable time during live calls. In a high-volume government benefits environment, these inefficiencies compounded daily while increasing the risk of errors on actions that directly affect people’s healthcare access.

## The Solution: SFHSS Research Assistant

SuccessMetrics designed and deployed a **persistent, multi-capability Agentforce assistant** that lives inside the Salesforce Lightning Service Console. Staff open a chat panel from any screen, type their request, and complete the entire workflow without leaving their existing workspace.

The assistant is built as four focused sub-capabilities, each mapping directly to a real step in the specialist workflow:

| Capability            | What It Does |
|-----------------------|--------------|
| **Case Information**     | Fetches case details and member info using a case number. Stores everything for the session. |
| **Benefits FAQ**         | Answers benefit questions covering Medicare, enrollment, and coverage. Context-aware when a case is loaded. |
| **Mailing Record**       | Guides specialists through document type and member group selection. Creates the Salesforce record on explicit confirmation. |
| **Send Member Email**    | Drafts a benefit summary email using the FAQ answer and member email from the case record. Sends on explicit YES. |

## A Real Session: Five Exchanges, One Screen

Here is a typical SFHSS specialist session from start to finish — previously requiring navigation across at least four separate screens:

1. **Specialist:** “Get me case 00503027”  
   **Agent:** Fetches case details and stores member name, email, case reason, and sub-reason for the entire session.

2. **Specialist:** “What are the Medicare enrollment options for this member?”  
   **Agent:** Searches the SFHSS knowledge base. Because a case is loaded, it filters results by Case Reason: Retiree / Sub Reason: Retiree - Counsel and returns precise, contextual guidance.

3. **Specialist:** “Create a mailing record”  
   **Agent:** Asks for document type and member group. Specialist selects from the list. Agent displays a clear confirmation summary of exactly what will be created.

4. **Specialist:** “YES”  
   **Agent:** Creates the mailing record in Salesforce and displays the new Record ID and status.

5. **Specialist:** “Send email”  
   **Agent:** Drafts a complete email using the FAQ answer and member email from the case record. Specialist reviews the draft, confirms, and the email is sent.

The full workflow — case lookup, benefits research, mailing record creation, and personalized email — now completes in a single guided conversation inside the agent panel.

## Five Design Principles That Delivered Production-Ready Results

SuccessMetrics followed a disciplined, workflow-first approach that proved essential for government environments:

1. **Start with the workflow, not the technology** — Every sub-capability was mapped to an actual step specialists perform during live member calls. Nothing was added simply because it was technically possible.

2. **Session memory removes the biggest source of friction** — Once a case number is provided, the agent stores member name, email, and context for the rest of the conversation. Staff never re-enter data.

3. **Validate first. Confirm before every consequential action.** — Case numbers are validated before any action. Mailing records and emails require an explicit “YES.” In public-sector work where errors have real human consequences, this is not overhead — it is the point.

4. **Focused subagents outperform monolithic agents** — Each capability is isolated. When benefits content needs updating, only the relevant subagent changes. Easier to test, maintain, and explain to end users.

5. **Edge cases are the real product** — Wrong case numbers, missing emails, multi-question sessions, and confirmation flows were all scripted, tested, and handled gracefully before go-live. An agent that handles the unexpected earns lasting trust.

## Impact

By collapsing fragmented, multi-screen processes into one trustworthy conversation, SFHSS specialists now move faster while maintaining full human oversight on every action that affects members. The deliberate emphasis on validation, explicit confirmation, and transparent output separates a tool staff actually use from one they quietly abandon after the first mistake.

This implementation shows exactly how Agentforce, when built around real workflows and public-sector safeguards, can deliver meaningful efficiency gains without compromising control or accuracy.

---

*SuccessMetrics helps government and mission-driven organizations design and deploy focused, production-grade Agentforce solutions. [Contact us](https://successmetricscorp.com/contact) to start a workflow discovery conversation for your team.*
