# Memex Chat — Obsidian Plugin

Chat with your Obsidian vault using Claude AI. Semantic context retrieval, `@` mentions, thread history.

## Features

- **Semantic vault search** — TF-IDF index over all your notes, no external API needed for retrieval
- **Auto context** — relevant notes are automatically found and sent to Claude as context
- **Context preview** — see and edit which notes are included before sending
- **`[[Note]]` mentions** — reference specific notes directly in your message
- **Thread history** — chats saved as Markdown in your vault (default: `Calendar/Chat/`)
- **Streaming responses** — Claude's answer appears token by token
- **Source links** — every answer shows which notes were used

## Installation

1. Download `main.js`, `manifest.json`, `styles.css`
2. Copy into `.obsidian/plugins/memex-chat/` in your vault
3. Enable in **Settings → Community Plugins → Memex Chat**
4. Add your [Anthropic API Key](https://console.anthropic.com/) in plugin settings

## Build from Source

```bash
npm install
npm run build
```

Requires Node 18+.

## Settings

| Setting | Default | Description |
|---|---|---|
| API Key | — | Your Anthropic API key |
| Model | claude-sonnet-4-5 | Which Claude model to use |
| Max context notes | 6 | How many notes to retrieve per query |
| Max chars per note | 2500 | How much of each note to include |
| Auto retrieve context | on | Automatically find relevant notes |
| Context preview | on | Show context before sending |
| Save threads to vault | on | Persist chats as Markdown |
| Threads folder | `Calendar/Chat` | Where to save thread files |

## Commands

| Command | Description |
|---|---|
| `Memex Chat öffnen` | Open the chat panel |
| `Memex Chat: Index neu aufbauen` | Rebuild the TF-IDF search index |
| `Memex Chat: Aktive Notiz als Kontext` | Ask Claude about the currently open note |

## License

MIT
