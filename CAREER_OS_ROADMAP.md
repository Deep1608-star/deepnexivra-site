# Deep Nexivra Career Intelligence OS

Deep Nexivra is being converted from a business-idea analyzer into a private, evidence-first career operating system.

## Product principle

The system should optimize applications without fabricating qualifications.

Core loop:

**Career evidence -> Job requirements -> Evidence mapping -> Gap analysis -> Tailored application -> Interview preparation -> Outcome learning**

Deep Nexivra scores its own analysis dimensions. It must never present a number as an employer's private ATS score.

## V1 — Career OS foundation

Implemented on `career-os-v1`:

- Command Center
- Master Resume store
- Evidence Vault
- Match Lab
- Requirement / evidence / ATS / recruiter / readiness scores
- Requirement-to-evidence mapping
- Contextual keyword analysis
- ATS text-level checks
- Evidence-safe rewrite recommendations
- Application tracker
- Interview questions derived from scan results
- Scan history
- Browser-local persistence
- Local fallback analysis engine
- OpenAI GPT-5.6 Sol analysis endpoint
- Strict JSON Structured Outputs
- Mobile-responsive private workspace UI

## V2 — Professional resume ingestion

Build:

- PDF upload
- DOCX upload
- Plain-text extraction
- Section detection
- Resume structure graph
- Date / employer / title parsing
- Bullet-level evidence IDs
- Duplicate content detection
- Master resume versioning
- Resume import validation before saving

Goal: upload a file once and convert it into structured career evidence.

## V3 — Evidence Graph

Entities:

- Person
- Employer
- Role
- Project
- Responsibility
- Achievement
- Skill
- Tool
- Certification
- Education
- Metric

Each generated resume bullet should store:

- source evidence IDs
- confidence
- direct vs transferable classification
- target requirement IDs
- revision history

Goal: every AI claim is traceable.

## V4 — Advanced Job Intelligence

Build:

- job URL import
- job description parser
- must-have vs preferred classifier
- responsibility clustering
- seniority analysis
- years-of-experience extraction
- education / license / certification requirements
- tool and domain ontology
- salary/location metadata
- role-family matching

Goal: understand jobs semantically, not merely by keyword frequency.

## V5 — Resume Studio Pro

Build:

- job-specific resume generation
- before / after diff
- accept/reject each proposed change
- evidence trace attached to every bullet
- ATS-safe templates
- one-page / two-page modes
- PDF and DOCX export
- configurable Canadian / US / UK / India conventions
- quantified-achievement prompts when metrics are missing
- no-invention enforcement

Goal: create the strongest truthful tailored resume from verified evidence.

## V6 — ATS Simulation Lab

Build distinct checks rather than one fake universal ATS score:

- parser-safe text extraction
- section recognition
- contact parsing
- title/date parsing
- heading normalization
- keyword context
- acronym + expanded-form coverage
- hard-skill coverage
- requirement density
- repetition / stuffing detection
- chronology consistency
- formatting warnings

Goal: transparent ATS readiness, with each issue explainable.

## V7 — Recruiter Intelligence

Build:

- six-second scan simulation
- first-third-of-page relevance
- achievement density
- specificity score
- seniority consistency
- credibility / overclaim detection
- jargon detection
- repeated bullet detection
- role-story coherence
- transferable-skill clarity

Goal: optimize for humans and machines separately.

## V8 — Application Command Center

Build:

- company + role records
- job URL
- deadlines
- contacts
- follow-up dates
- application stages
- notes
- resume version attached to each application
- cover letter version
- interview rounds
- compensation
- offer comparison

Goal: one record of everything used for each application.

## V9 — Interview Intelligence

Build:

- predicted interview themes
- role-specific technical questions
- behavioral questions
- STAR evidence selector
- weak-answer detector
- answer scoring
- live practice mode
- follow-up-question generation
- interviewer question bank
- post-interview debrief

Goal: use the same evidence graph throughout the interview process.

## V10 — Job Discovery & Career Agent

Build:

- saved role targets
- job discovery feeds
- semantic job matching
- automatic fit triage
- duplicate job detection
- company preference filters
- location / remote rules
- compensation filters
- qualification-gap clustering

Goal: show which opportunities deserve attention before tailoring anything.

## V11 — Career Development Intelligence

Across many target jobs, calculate:

- recurring missing skills
- recurring certifications
- recurring tools
- recurring experience gaps
- highest-leverage learning actions
- role adjacency
- next-role pathways

Goal: answer, "What should I learn or do next to become more competitive?"

## V12 — Outcome Learning

Capture:

- applied
- rejected
- screening
- interview
- final round
- offer

Compare outcomes with:

- requirement match
- resume format
- skills
- job family
- company
- application source
- tailored bullet patterns

Goal: personalize recommendations using the user's own outcomes without pretending correlation proves causation.

## Architecture direction

Current static/Vercel-compatible frontend can evolve toward:

- Next.js / React frontend
- PostgreSQL
- pgvector
- object storage for resume files
- authenticated private user account
- OpenAI Responses API
- structured career evidence graph
- document generation service
- encrypted secrets
- audit/version history

For personal use, avoid unnecessary billing and multi-tenant complexity until the core workflow is excellent.

## Quality bar

Every major feature should satisfy:

1. Truth-preserving
2. Explainable
3. Reversible
4. Job-specific
5. Evidence-linked
6. Fast enough for repeated applications
7. Useful without pretending certainty
8. Mobile usable
9. Private by default
10. Better decision support, not just prettier text
