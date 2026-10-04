# API Versioning Notes (capstone/api-versioning.md)

Week 27 Day 4 · Sheryl Ochieng · Mctaba Labs Capstone

---

## Why /v1/ from day zero?

Every endpoint in Rahisisha starts with `/v1/` even though there is only one
version right now and there may never be a `/v2/`. The reason is simple: if
you ship without versioning and later need to make a breaking change, you have
to either break every existing client or create versioning infrastructure under
pressure, in production, with real users affected. Starting with `/v1/` costs
nothing today .... it is just a prefix ..... but it means a breaking change tomorrow
is a clean `/v2/` addition alongside the existing `/v1/`, not an emergency.

## When do you go to /v2/?

You introduce `/v2/` only when you need to make a **breaking change** - a
change that would cause an existing client to break or return wrong data if
they did not update their code. The threshold for creating `/v2/` is high on
purpose. Breaking changes are expensive: every client that calls the API must
update, test, and redeploy. Creating a new version is the last resort, not
the first response to wanting a cleaner design.

## What does "additive only" mean?

"Additive only" means the only changes allowed to an existing versioned API
are additions - new endpoints, new optional fields in responses, new optional
parameters in requests. Nothing is removed, renamed, or changed in type.
This is the golden rule of API evolution: clients only read the fields they
know about and ignore the rest. A new field in the response does not break any
client that was not expecting it. But a missing field, a renamed field, or a
field whose type changed from string to integer — all of these break clients
silently and are never done inside an existing version.

## When is removing a response field a breaking change? Always.

Removing any field from an API response is always a breaking change, with no
exceptions. It does not matter how small the field is, how rarely it seems to
be used, or whether the documentation says it is optional. Any client that
reads that field will break when it disappears. This is why deprecation exists:
mark the field as deprecated in documentation, add a deprecation header to
responses, give clients 90 days minimum to stop reading it, then remove it in
the next major version. Skipping deprecation and removing directly is the
fastest way to break production systems you do not control.

## The practical rule for Rahisisha

During the capstone build, any change to an existing endpoint stays additive.
New fields can be added freely. If a breaking change is genuinely needed, a
note is added to `DECISIONS.md` with the reason, and the affected endpoint
moves to `/v2/` in a separate migration - never edited in place.