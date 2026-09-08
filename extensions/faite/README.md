# Faite for Raycast

Capture, find and triage your [Faite](https://myfaite.app) to-dos without leaving Raycast.

## Connecting your account

Run **Connect Faite Account**. It opens Faite in your browser, and once you sign in Raycast is handed an API key automatically — nothing to copy or paste.

If you would rather manage the key yourself, mint one in Faite under **Settings → API Keys** with **Write** enabled, and put it in this extension's preferences. A pasted key always takes precedence over a connected account, so it doubles as an override.

Either way the key is scoped to `read` and `write` on Faite's public API. It cannot reach the sync transport or Faite's Google Places integration.

## Preferences

| Preference | Purpose |
| --- | --- |
| **API Key** | Optional. Use a key you minted yourself instead of connecting in the browser. |
| **API Host** | Only change this if you are running Faite locally. |
