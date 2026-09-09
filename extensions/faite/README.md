# Faite for Raycast

Capture, find and triage your [Faite](https://myfaite.app) to-dos without leaving Raycast.

## Commands

| Command | What it does |
| --- | --- |
| **Quick Add To-Do** | Capture a to-do from anywhere. Understands "buy milk tomorrow" and files it for you. |
| **Today** | The day's to-dos — complete, reschedule, move or edit them. |
| **Overflow** | Triage what slipped past its scheduled day. |
| **Search To-Dos** | Search everything by title, list or label. |
| **Browse Lists** | Browse your lists and drill into one. |
| **Day Note** | Write the Markdown note for a day. |
| **Faite Menu Bar** | Today's count in the menu bar. Off by default. |

## Connecting your account

Run any command. Raycast will offer to sign you in, open Faite in your browser, and store the key for you — nothing to copy or paste. Once you are signed in, this extension's settings show a **Logged into Faite** row with a Logout button.

If you would rather manage the key yourself, mint one in Faite under **Settings → API Keys** with **Write** enabled, and put it in this extension's preferences. A pasted key always takes precedence over a signed-in session, so it doubles as an override.

Either way the key is scoped to `read` and `write` on Faite's public API. It cannot reach the sync transport or Faite's Google Places integration.

## Using Faite with Raycast AI

Once connected, you can talk to Faite directly:

- `@faite what's on my plate today?`
- `@faite add buy milk to my errands list`
- `@faite what have I let slip?`
- `@faite turn the action items from my last Granola note into to-dos`

Faite's lists each carry a description of what belongs in them, and the AI reads it when deciding where a new to-do should go — so filling those in makes filing noticeably better.

## Using Faite from other MCP clients

Faite also runs its own MCP server, which you can add to Raycast so that **any** MCP client reaching through Raycast can use it.

Add it manually under **Raycast Settings → AI → MCP Servers**:

| Field | Value |
| --- | --- |
| Transport | **HTTP** |
| URL | `https://myfaite.app/mcp` |
| Header | `Authorization: Bearer faite_…` |

Use a key from Faite's **Settings → API Keys** with **Write** enabled.

> **Why this is manual.** Raycast's programmatic `Action.InstallMCPServer` only offers the legacy **SSE** transport, which opens with a `GET` to the server. Faite's `/mcp` speaks **Streamable HTTP** and answers `GET` with `405` by design — it never pushes server-initiated messages, so a client waiting on one would hang rather than fail fast. Raycast's own MCP settings UI does support Streamable HTTP, so adding it there works; a one-click button would not. This is worth revisiting if Raycast adds an HTTP transport to that action.

The extension's own AI tools and this MCP server overlap on purpose — they serve different clients, and you do not need both.

## Preferences

| Preference | Purpose |
| --- | --- |
| **API Key** | Optional. Use a key you minted yourself instead of connecting in the browser. |
| **API Host** | Only change this if you are running Faite locally. |
