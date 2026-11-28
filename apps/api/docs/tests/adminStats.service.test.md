# adminStats.service.test.js (guide)

**File:** `apps/api/tests/adminStats.service.test.js`

## What it proves
The overview numbers are right against the real database, and deleted shops never count.

## How it works (testing by difference)
The test database may already hold other shops, so we never assert absolute numbers. We take a reading **before**, add our own shops, take a reading **after**, and check the **difference**.

Our shops: fresh-a (active), fresh-b (active, verified), fresh-c (suspended), old (active, joined 30 days ago), gone (deleted), gone-verified (deleted and still carrying a verified stamp).

Expected change: total +4, active +3, suspended +1, verified +1, newThisWeek +3.

## The four checks
1. Each number moves by exactly the right amount, and deleted shops count for nothing.
2. The answer is exactly five real integers (no text like "12").
3. Nothing about any one shop or person is in the answer.
4. Active plus suspended equals total.

## Mutation checks I ran
- Verified counting deleted shops: check 1 failed.
- The seven-day window changed to sixty days: check 1 failed.

## Cleanup
`afterAll` deletes only its own receipts, shops and admin.
