# Git Submodule Notes

Week 27 Day 5 · Sheryl Ochieng · Mctaba Labs Capstone

---

## What does a submodule pin?

A git submodule pins a specific **commit** of another repository - not a branch.
When you add a submodule, git records the exact commit hash of that external repo.
Everyone who clones your repo gets that exact version of the submodule, no matter
what has changed in the external repo since. This makes builds reproducible.

## Why is onboarding harder with submodules?

A new developer cloning the repo must run two extra commands:
```
git clone <repo-url>
git submodule init
git submodule update
```
Without those extra commands, the submodule folders exist but are empty. This is
a common source of confusion for developers who have not worked with submodules
before - the folder is there, the files are not.

## When is an npm workspace better?

An npm workspace is better when the shared code is JavaScript/Node.js and is
actively developed alongside the main project. With workspaces, changes to the
shared package are immediately visible to all services without committing and
updating a submodule. Submodules are better for pinning an external dependency
that you do not own or update frequently - for example, a shared design system
owned by another team.

## What is the main risk of a moving branch?

Never point a submodule at a branch (e.g. `main`). If you do, the pinned commit
stays fixed even as the branch moves forward - until someone manually runs
`git submodule update --remote`. This creates silent drift: your main repo says
it uses commit `abc123` of the submodule, but the actual branch has moved to
`def456`. Two developers cloning the repo at different times get different
versions of the shared code. Always pin to a specific tagged release commit,
not a branch.