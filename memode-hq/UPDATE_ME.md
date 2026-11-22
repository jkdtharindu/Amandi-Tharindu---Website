# Update Me

Triggers: "update the md files", "update the markdown", "sync the docs". Runs any time, not just at session end. It is the light version of `SESSION_END_PROMPT.md`.

## Method
1. Read back through **this chat** for: decisions made, things deferred, scope changes, new risks, new assumptions, HITL answers.
2. Check the folder (`git status` and `git diff --stat` if it is a git repo) so what you write matches what really exists.
3. Write only what the chat and the files agree on. If they disagree, flag it. Do not record it as fact.

## Where each thing goes
- Approved decision → `DECISIONS.md` (and `STRATEGY.md` if it changes the approved list)
- New belief or number we cannot prove → `ASSUMPTIONS.md`
- Schedule or status change → `TIMELINE.md`
- Next actions → `TASKS.md`
- New risk → `RISKS.md`
- New term → `GLOSSARY.md`
- Something real was built or finished → one line in `HISTORY.md` (verify against the actual files first)

## Size check (every update)
Count words in the always-read files (limits in `CLAUDE.md`). If over, archive old entries to `ARCHIVE/`.

If nothing changed, say so. Do not force entries.

---

## Project update (trigger: "Project update")
Give these 10 points, in plain English, from `TIMELINE.md`:
1. Current phase
2. Overall progress (only if the weighting method is approved. Otherwise say "method not yet approved")
3. Completed milestones
4. Active activities
5. Upcoming milestones
6. Overdue tasks
7. Critical dependencies
8. Current risks (top 3 from `RISKS.md`)
9. Founder decisions needed
10. Recommended next actions

Save longer reports in `REPORTS/` with the date in the filename.
