---
name: walkthrough
description: "Walk the reviewer through a pull request, one screen at a time, as its author: a map of the change that points at lines and tests, never a substitute for the reviewer's own verification. Arguments: <repo> <number>, the repo as its slug after cocoon- (ai, ml, relations, ai-records)."
---

# Assisted PR review

The author guides the reviewer through a PR in manageable chunks, in the order that makes the change easiest to verify. This is the author's map; the reviewer's floor is `pr-review`, run by the reviewer, and nothing here replaces it. Every claim the map makes points at a line, a test or a measurement, never at itself, so the map cannot steer: it can only make the reading faster.

Invoked as `/walkthrough <repo> <number>` by the PR's author, after the self-review and once the reviewer says they are reading. `<repo>` is the slug after `cocoon-`: `ai`, `ml`, `relations`, `ai-records`.

## The pace

A chunk is one screen: about thirty lines of prose, or one snippet with its one-paragraph explanation. Every chunk ends with the name of the next chunk and nothing else; the reviewer says when to continue, asks, or stops. A section bigger than a chunk is split; it never spills. A section the reviewer says they have already covered is skipped, not summarised: the reviewer names the next chunk they want. The reviewer's reading time is the cost, so nothing is said twice and nothing is padded.

## The sections, in order

1. **The change in brief.** What it is for, in a few sentences; the relevant files, and signatures where a signature says more than a name. For a refactor, what moved and what stayed, in one line each.
2. **What to read hardest.** Before any code: the compromises, the debt, the declared gaps, and any security consequence, from the PR body's self-review, each with the file and line to look at. The reviewer should know what the author is least sure of before reading, because that is where to read hardest.
3. **Files by category.** Architectural choices first, the highest level first, the last file in the stack last; files of one shape bulked together. For each, one or two sentences: what it does, and for a refactor, what changed and where it fits. This is the table of contents for the chunks that follow.
4. **The code, main things only.** Snippets of what matters: the effect that does something particular, not the state it reads; the function's main logic or its idiosyncratic syntax, not its plumbing. New syntax is explained once, in a line, the first time it appears, and assumed after. Each snippet is its own chunk.
5. **The demo, together.** How to run it, in the exact commands or the exact page; then what to look out for while it runs, specific to the change: edge behaviour, frame rate, what a wrong result would look like. The demo of a browser-tested component is the page the harness drives.

## Rules the author keeps

- The map follows the code's shape, not the author's story: a reviewer reading only the map and the diff would land on the same places as one reading the diff alone, sooner.
- A number in the map is a measured one, with its date and machine, or it is not in the map.
- The reviewer's questions are answered in place, and the answer is the whole message: a question gets its answer and nothing after it, never a chunk appended. The next chunk goes out only when the reviewer says to. The reviewer reads as they go, and a chunk under an answer is output they did not ask for, which they then have to scroll past or ask to see again (Izzy, 2026-10-07).
- A change the walkthrough calls for is made and pushed to the PR as it comes up, with the map saying so, so no second review round is needed and any issue with the change shows at once (Izzy, 2026-10-07).
- When the walkthrough ends, the author says so and stops; the review and the decision are the reviewer's.
