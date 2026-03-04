# Memex Chat — CLAUDE.md

Obsidian plugin: Chat with your vault using Claude AI. Semantic TF-IDF context retrieval, `[[Note]]` mentions, thread history, streaming responses.

## Build

```bash
npm install
npm run build   # production build → main.js
npm run dev     # watch mode with inline sourcemaps
```

Entry: `src/main.ts` → bundled to `main.js` via esbuild (CJS, ES2018 target).
`obsidian` and all `@codemirror/*` / `@lezer/*` packages are external (provided by Obsidian).

## Architecture

| File | Role |
|---|---|
| `src/main.ts` | Plugin entry — `MemexChatPlugin extends Plugin`. Registers view, commands, settings tab. |
| `src/ChatView.ts` | Main UI — `ChatView extends ItemView`. Thread management, context preview, streaming render. View type: `memex-chat-view`. |
| `src/VaultSearch.ts` | TF-IDF search engine. Builds in-memory index over all vault markdown files. No external API. |
| `src/ClaudeClient.ts` | Anthropic API client. `streamChat()` yields `ClaudeStreamChunk` via async generator. Uses `fetch` directly (no SDK). |
| `src/SettingsTab.ts` | `MemexChatSettingsTab` + `MemexChatSettings` interface + `DEFAULT_SETTINGS`. |
| `styles.css` | All plugin styles. CSS classes prefixed `vc-` (e.g. `vc-root`, `vc-msg--assistant`). |
| `manifest.json` | Obsidian plugin manifest. ID: `memex-chat`. |
| `main.js` | Compiled output — do not edit manually, always rebuild. |

## Key Patterns

- **Data persistence**: `this.saveData(this.data)` / `this.loadData()` — single object `{ settings, threads }`.
- **Streaming**: `ClaudeClient.streamChat()` is an async generator; `ChatView` iterates it and calls `updateLastMessage()` per chunk.
- **Context flow**: Query → `VaultSearch.search()` → context preview → user confirms → `sendMessage()` injects note content into the Claude prompt.
- **Thread storage**: Optionally saved as Markdown to vault folder (default `Calendar/Chat/`).
- **CSS prefix**: `vc-` for all plugin DOM classes. Do not use Obsidian internal class names.
- **TypeScript**: `strictNullChecks` on, `moduleResolution: bundler`. No tests currently.

## Deployment (Manual)

Copy `main.js`, `manifest.json`, `styles.css` into `.obsidian/plugins/memex-chat/` in the target vault.

## Models (SettingsTab.ts)

Default: `claude-opus-4-5-20251101`. Update `MODELS` array and `DEFAULT_SETTINGS.model` when adding new model IDs.
