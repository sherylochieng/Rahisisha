# AI Audit Log — Rahisisha

One section per week. Every file that touches auth, money, or tenant isolation is listed with who wrote it and confirmation of a manual re-read before shipping.

AI usage ratio is stated at the top of each week's section.

## Week 27 — Architecture week (55% manual / 45% AI)

### What AI helped with
- Critiquing the schema draft ("here is my schema — what am I missing for multi-tenancy?")
- Comparing RLS vs schema-per-tenant trade-offs after I had already decided
- Scaffolding the initial repo folder structure after I chose the layout
- Reviewing the API spec for missing endpoints after I drafted all 30+ routes myself

### What AI was NOT allowed to touch
- The schema design — I drew every table on paper first
- The multi-tenancy pattern choice — I read the Mctaba notes and three external articles before deciding on shared tables + RLS
- The API endpoint URL shapes — designed by me, critiqued by AI afterward
- The milestone and roadmap decisions — what ships in which week is my call, not AI's
- The SPEC, ROADMAP, WILL_NOT_BUILD, and stories — all written in my own words

### Deliverables written manually (Day 1)
- `capstone/PICK.md` — vertical justification in my own words
- `capstone/SPEC.md` — one-page product spec
- `capstone/stories.md` — 15 user stories grouped by role
- `capstone/ROADMAP.md` — four-week day-by-day roadmap
- `capstone/WILL_NOT_BUILD.md` — 12 explicit exclusions

### No security-critical code was written this week
Week 27 is entirely design and documentation. No auth, money, or isolation code exists yet.