# Orbit Workspace

Use Orbit, the self-hosted workspace for tasks, docs and chat, from Raycast: search and update tasks, read and write docs, read chat, and see your open tasks in the menu bar. It works with Orbit Cloud and with a self-hosted Orbit.

## Setup

1. In Orbit, open **Settings → API tokens** (workspace owners and administrators).
2. Create a token. For all features, set **Tasks: Write**, **Docs: Write** and **Chat: Read**, and select the projects (or **All projects**).
3. In Raycast, enter:
   - **Orbit URL**: the address you open Orbit at, for example `https://orbit.example.com`.
   - **API Token**: the token, which starts with `orb_`.

A personal token acts as you. A service-account token can use tasks only, and has no "my tasks".

## Commands

| Command | What it does | Permission |
| --- | --- | --- |
| Search Tasks | Search by title, description or identifier (`SWY-12`). Filter by project, "my tasks" and "hide done". Change status, priority and assignee, add comments, move to trash. | Tasks: Read (Write to change) |
| Create Task | Project, title, Markdown description, status, priority, assignees, labels and due date. | Tasks: Write |
| Task Views | Saved task filters: project, status (or open, done, all), assignee, priority, label, text and sort. Open a view, edit, reorder or delete it, and turn it into a Raycast quicklink. Save the current search as a view with ⌘⇧S. | Tasks: Read |
| Search Docs | Find docs by title, read them in the side panel, copy their Markdown, add text to the end of a doc. | Docs: Read (Write to add) |
| Create Doc | Create a doc in the default teamspace, in your private space, or inside another doc. | Docs: Write |
| Browse Chat | Channels and direct messages, their messages and threads. | Chat: Read |
| Search Messages | Search all messages, or the messages of one conversation. | Chat: Read |
| Orbit Tasks | Menu bar: the number of open tasks, the tasks that are due soon, and quick links. Its **Show** preference picks **Assigned to Me** (default) or **All Open Tasks**. | Tasks: Read |

## Limits

These come from Orbit's API for tokens:

- Chat is read-only. You cannot send messages from Raycast.
- Doc search uses titles only, not the content.
- Create Doc cannot choose a teamspace other than the default one.
- Images in docs and chat files open in Orbit, not in Raycast.

## AI

Mention `@orbit-workspace` in Raycast AI Chat (or use "Ask Orbit Workspace" in root search). For example:

- "What are my open tasks?"
- "What's in progress in DBM?" or "Open my DBM Open view"
- "Summarize DBM-12 and its comments"
- "Create a task in DBM to update the roster screen, assign it to me, due Friday"
- "Mark DBM-12 as done" or "Comment on DBM-12 that the fix is deployed"
- "Find my notes about the draft order" or "Add 'Trade deadline is March 1' to the Draft order rules doc"
- "What was said in #general today?"

The AI uses the same token and permissions as the commands. Raycast asks before every change (create, update, comment, delete, new doc, add to doc) and shows what will change. Chat stays read-only.

## Task Views

Views are stored in Raycast on this Mac, not in Orbit, because Orbit's API tokens cannot read Orbit's own saved views. A quicklink holds the whole view, so it keeps working after you delete the view, and on another Mac with the same Orbit.

## Self-hosted Orbit

- Use the same address as the server's public origin (`ORBIT_PUBLIC_ORIGIN`). Chat uses Orbit's MCP endpoint, which refuses other addresses.
- The server needs a certificate that macOS trusts. Self-signed certificates do not work.
