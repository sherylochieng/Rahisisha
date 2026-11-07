# Isolation Proof (pointer)

The full proof lives with the tests it describes:

**`apps/api/docs/tests/isolation-proof.md`**

It contains:

- **Evidence A**: the query that shows RLS is enabled and forced on every tenant table (16 tables).
- **Evidence B**: the query that shows each table's rule (17 rules, after migration 022).
- **Evidence C**: the isolation test run, from `apps/api/tests/isolation.test.js` (attacks all 16 tables with read, update and delete).
- The tables that have no RLS, and why.
- Known limitations.

To repeat the proof:

    cd apps/api
    npm run test:isolation