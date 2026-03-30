# Memex Chat — Obsidian Plugin

Chat with your Obsidian vault using Claude AI. Ask questions about your notes, get context-aware answers, and explore semantic connections — all without leaving Obsidian.

## Features

- **Vault search** — TF-IDF index by default; enable local embeddings for hybrid mode (TF-IDF + semantic merged via RRF), fully offline after first model download
- **Related notes sidebar** — panel showing the most similar notes to whatever you have open, ranked by semantic similarity + frontmatter links + shared tags
- **Auto context** — relevant notes are automatically found and sent to Claude as context
- **Context preview** — see which notes are included before sending, or dismiss to send without context
- **`@mention` autocomplete** — pin specific notes into context directly from the input field
- **Thread history** — chats saved as Markdown in your vault (default: `Calendar/Chat/`)
- **Source links** — every answer shows which notes were used as context
- **Prompt buttons** — header mode buttons that extend Claude's system prompt (e.g. draft check, monthly review)

## Installation

1. Download `main.js`, `manifest.json`, `styles.css` from the [latest release](../../releases/latest)
2. Copy into `.obsidian/plugins/memex-chat/` in your vault
3. Enable in **Settings → Community Plugins → Memex Chat**
4. Add your [Anthropic API key](https://console.anthropic.com/) in plugin settings

## Build from Source

```bash
npm install
npm run build
```

Requires Node 18+.

## Usage

### Basic workflow

1. Open the chat panel via the ribbon icon or the **Memex Chat öffnen** command
2. Type your question and press **Cmd+Enter** (or Enter if configured)
3. If **Auto retrieve context** is on, relevant notes are found automatically and shown in a preview
4. Confirm or dismiss the context, then your message is sent to Claude with the note content injected

### @mentions

Type `@` followed by at least 2 characters to trigger autocomplete for note names. Selecting a note adds it to the explicit context for that message, regardless of search results.

### Context preview

When **Show context preview** is on, a list of notes appears above the input before each send. You can dismiss it to send without context, or confirm to proceed. The notes used are shown as source links below the assistant's reply.

### Thread management

- Threads are listed in the sidebar of the chat panel under **Verlauf**
- Double-click a thread title to rename it inline
- Each thread is saved as a Markdown file in your configured threads folder, with a frontmatter `id:` field used for deduplication on re-import
- Vault chat files not already in active threads are loaded on demand from the sidebar

### Message actions

Hover over a finished assistant message to reveal two actions:
- **Copy** — copies the message text to the clipboard
- **Als Notiz** — saves the message as a new note in Obsidian's default new-note location

### Prompt buttons

Header buttons that activate a mode by extending Claude's system prompt with the contents of a vault note. Multiple buttons can be active at once.

When a button is active:
- The file at its configured vault path is appended to the system prompt
- An optional hint is shown above the input
- If `searchMode: "date"` is set, context retrieval switches to date-based file lookup (useful for monthly review modes)
- Auto context retrieval is skipped

Configure prompt buttons in **Settings → Prompt Buttons**.

### System context file

In settings you can specify a vault note to always append to the system prompt (after the base prompt, before any active prompt buttons). Useful for personal context like your name, current projects, or standing instructions.

## Commands

| Command | Description |
|---|---|
| `Memex Chat öffnen` | Open the chat panel |
| `Verwandte Notizen` | Open the related notes sidebar |
| `Memex Chat: Index neu aufbauen` | Rebuild the search index |
| `Memex Chat: Aktive Notiz als Kontext` | Ask Claude about the currently open note |

## Related Notes Sidebar

Requires embeddings to be enabled. Opens in the right sidebar and automatically shows the top 10 most similar notes to the currently active file. Similarity is computed from:

1. **Semantic embedding similarity** (cosine similarity on 384-dim vectors)
2. **+0.15 boost** for notes linked via `contextProperties` frontmatter fields (e.g. `related: [[Note]]`)
3. **+0.05 per shared tag** (up to +0.15)

Notes boosted by a frontmatter link are marked with a **verknüpft** badge.

## Settings

### General

| Setting | Default | Description |
|---|---|---|
| API Key | — | Your Anthropic API key |
| Model | `claude-opus-4-6` | Which Claude model to use. Click **Aktualisieren** to fetch the live model list from the Anthropic API. |
| Max tokens | 8192 | Maximum output tokens per response |
| Max context notes | 6 | How many notes to retrieve per query |
| Max chars per note | 2500 | How much of each note to include |
| System prompt | (German default) | Base instructions sent to Claude on every request |
| System context file | — | Optional vault note appended to system prompt |
| Auto retrieve context | on | Automatically find relevant notes on send |
| Context preview | on | Show context before sending |
| Save threads to vault | on | Persist chats as Markdown files |
| Threads folder | `Calendar/Chat` | Where to save thread files |
| Send on Enter | off | Enter sends (vs. Cmd+Enter) |
| Context properties | `collection, related, up, tags` | Frontmatter properties whose wikilink values boost search ranking |

### Embeddings (optional)

| Setting | Default | Description |
|---|---|---|
| Use embeddings | off | Enable hybrid search (TF-IDF + semantic, merged via RRF) |
| Embedding model | BGE Micro v2 | ONNX model for local inference |
| Exclude folders | — | Vault folders skipped during embedding |

| Model | Notes |
|---|---|
| `TaylorAI/bge-micro-v2` | Default — fastest, 384-dim |
| `Xenova/all-MiniLM-L6-v2` | 384-dim |
| `Xenova/multilingual-e5-small` | German + English |
| `Xenova/paraphrase-multilingual-MiniLM-L12-v2` | German + English, larger |

Embeddings are computed locally (no API call) and cached in `<vault>/.memex-chat/embeddings/`. The model (~22 MB) is downloaded once to `<vault>/.memex-chat/models/`. Indexing progress is shown as an Obsidian notice. Obsidian Sync activity is detected automatically — indexing waits until sync is idle before starting.

Once indexing completes, context retrieval switches to **hybrid mode**: TF-IDF and semantic results are fetched independently then rank-merged via Reciprocal Rank Fusion. Notes that score well in both engines rise to the top; notes found by only one are still included if their rank is strong enough. This catches paraphrased queries that TF-IDF misses and avoids the over-broadness of embeddings alone.

## License

MIT
