# Agent Operating Contract

> This project uses the [`dam0/agent-harness`](https://github.com/dam0/agent-harness)
> board-driven workflow. The canonical contract lives at:
>
> **`/Users/damo/.agents/harness/AGENTS.md`**
>
> The helper script is at:
> **`/Users/damo/.agents/harness/scripts/board.sh`**
>
> Substitute that path wherever the canonical contract references `scripts/board.sh`.

## Quick reference

```bash
HARNESS=/Users/damo/.agents/harness

# List all approved, ready-to-work items
bash "$HARNESS/scripts/board.sh" list dam0/wildlife-spot TODO

# Claim a task
bash "$HARNESS/scripts/board.sh" set-status dam0/wildlife-spot "$ISSUE_URL" "In Progress"

# PR is open, tests pass, awaiting human review
bash "$HARNESS/scripts/board.sh" set-status dam0/wildlife-spot "$ISSUE_URL" "Review"

# File a new idea/bug and put it in the Backlog
gh issue create --title "..." --body "..."
bash "$HARNESS/scripts/board.sh" add dam0/wildlife-spot "$ISSUE_URL" Backlog
```

## Board columns

| Column | Meaning | Who moves it here |
| --- | --- | --- |
| `Backlog` | Idea / bug report / suggested change — not approved | agent or human (new issues land here) |
| `TODO` | Approved — ready for the agent to work on | **human only** (approval) |
| `In Progress` | Agent is actively working on it | agent |
| `Review` | Tests pass and the PR is open, awaiting human review/merge | agent (when the PR opens) |
| `Done` | Merged and closed | automation (when the issue closes) |

## Rules

1. **Only work on `TODO`.** Never start work from `Backlog`, `In Progress`, `Review`, or `Done`.
2. **One issue = one task.** Every commit and PR references its issue.
3. **Suggest, don't decide.** New ideas are filed as issues in `Backlog`. The human approves by moving to `TODO`.
4. **Track state visibly.** Move the card to `In Progress` before starting, `Review` when the PR opens.
5. **Test and self-review before `Review`.**
6. **Branch and PR conventions.** Branch: `issue/<n>-<short-slug>`, PR body contains `Closes #<n>`.
