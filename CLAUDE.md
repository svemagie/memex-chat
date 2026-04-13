# Memex Chat — CLAUDE.md

Obsidian plugin: Chat with your vault using Claude AI. Hybrid TF-IDF + embedding search (Reciprocal Rank Fusion), MemPalace external knowledge injection, `@Notizname` mentions, thread history, prompt extension buttons, streaming responses, related notes sidebar.

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
| `src/main.ts` | Plugin entry — `MemexChatPlugin extends Plugin`. Registers views, commands, settings tab. Wires index rebuild, layout-ready hook, sync wait, and embedding progress notices. |
| `src/ChatView.ts` | Main UI — `ChatView extends ItemView`. Thread management, sidebar history, context preview, mode buttons, streaming render, Copy/Save actions. View type: `memex-chat-view`. |
| `src/VaultSearch.ts` | TF-IDF search engine. Builds in-memory index over all vault markdown files. Frontmatter property boost (5×). `findSimilarByName()` for unresolved link hints. Exports `SearchResult` interface (includes optional `linked` field). |
| `src/EmbedSearch.ts` | Local semantic search via `@xenova/transformers` (ONNX, WASM). Caches per-note `.ajson` vectors under `<vault>/.memex-chat/embeddings/`. `searchSimilarToFile()` boosts scores by frontmatter property links (+0.15) and shared tags (+0.05/tag). |
| `src/HybridSearch.ts` | Combines TF-IDF and embedding search via Reciprocal Rank Fusion (RRF, k=60). Runs both engines in parallel; rank-merges results so neither score space needs normalization. TF-IDF excerpts are preserved in merged output. |
| `src/RelatedNotesView.ts` | Sidebar panel — `RelatedNotesView extends ItemView`. Shows semantically similar notes for the active file; refreshes on file-open. Displays similarity bar and "verknüpft" badge for property-linked notes. View type: `memex-related-notes`. |
| `src/ClaudeClient.ts` | Anthropic API client. `streamChat()` yields `ClaudeStreamChunk` via async generator using native `fetch` + SSE. `chat()` and `fetchModels()` use Obsidian `requestUrl` (no SDK). |
| `src/SettingsTab.ts` | `MemexChatSettingsTab` + `MemexChatSettings` interface + `DEFAULT_SETTINGS`. Exports `PromptButton` interface. Folder autocomplete via `attachFolderDropdown()` helper. |
| `styles.css` | All plugin styles. CSS classes prefixed `vc-` (e.g. `vc-root`, `vc-msg--assistant`, `vc-related-*`, `vc-folder-*`). |
| `manifest.json` | Obsidian plugin manifest. ID: `memex-chat`. Version: `1.0.1`. |
| `main.js` | Compiled output — do not edit manually, always rebuild. |
| `esbuild.config.mjs` | Build config with three plugins: `stubNativeModules` (stubs onnxruntime-node/sharp/canvas), `forceOnnxWeb` (patches ONNX backend detection), `forceOrtWebBrowserMode` (patches ort-web for Electron). |

## Key Patterns

- **Data persistence**: `this.saveData(this.data)` / `this.loadData()` — single object `{ settings, threads }`. Settings merge on load preserves new fields via per-entry spread for `promptButtons`.
- **Streaming**: `ClaudeClient.streamChat()` is an async generator using native `fetch` with `stream: true` and SSE parsing (`content_block_delta` events). `ChatView` iterates it and calls `updateLastMessage()` per chunk. `chat()` and `fetchModels()` use `requestUrl` (buffered, fine for non-streaming calls).
- **Context flow**: Query → `VaultSearch.search()` or `HybridSearch.search()` → context preview → user confirms → `sendMessage()` injects note content into the Claude prompt. If `useMempalace` is enabled, `queryMempalace()` runs first and its results are prepended (highest priority, closest to query). Auto-retrieve skipped when prompt extension buttons are active.
- **Active search engine**: `plugin.activeSearch` returns `HybridSearch` when embeddings are ready, else `VaultSearch`.
- **MemPalace context**: `ChatView.queryMempalace(query)` calls `/usr/local/bin/mempalace search <query> --results N` via `execFile` with a 10 s timeout. Returns `""` silently if the binary is absent, errors, or times out. Results are labeled `MemPalace (Wissens-Archiv):` and prepended before vault context.
- **System prompt layering**: base system prompt → optional `systemContextFile` → active `promptButtons` extension files (each appended with `\n\n---\n`).
- **@mention syntax**: `@Notizname` — autocomplete triggers after 2 chars, inserts full basename. Parsing in `handleSend` matches vault filenames directly (handles spaces & special chars).
- **Prompt buttons**: `activeExtensions: Set<string>` tracks active button file paths. Mode hint panel shows `helpText` above input; hidden after send. Date-search buttons parse month from query and filter files by `getFileDate()`.
- **Thread sidebar**: Inline rename (double-click title). Collapsible "Verlauf" section loads vault chat files not in active threads via `parseThreadFromVault()`.
- **Thread storage**: Optionally saved as Markdown to `threadsFolder` (default `Calendar/Chat/`). Filename: `YYYYMMDDHHmmss Title.md`. Frontmatter includes `id:` for dedup on re-import.
- **Message actions**: Copy (clipboard) and "Als Notiz" (save to Obsidian's default new-note folder) appear on hover for finished assistant messages.
- **Unresolved links**: `is-unresolved` class + inline "Ähnliche Notiz: X" hint via `findSimilarByName()`.
- **History cap**: Last 10 messages sent to API per request.
- **CSS prefix**: `vc-` for all plugin DOM classes. Do not use Obsidian internal class names.
- **Event listeners**: Use `this.registerDomEvent()` for permanent listeners (auto-cleanup on view close). Inline `onclick` / `addEventListener` acceptable for dynamic elements that are re-created.
- **TypeScript**: `strictNullChecks` on, `moduleResolution: bundler`. No tests currently.

## EmbedSearch

- Model: `TaylorAI/bge-micro-v2` (default) — 384-dim, quantized ONNX, WASM backend via CDN (`cdn.jsdelivr.net/npm/onnxruntime-web@1.14.0/dist/`)
- Cache: `<vault>/.memex-chat/embeddings/<note-path>.ajson` — `{ mtime, vec }`. Manifest at `.manifest.json`.
- Models stored in `<vault>/.memex-chat/models/` (env.cacheDir).
- Incremental flush every 100 embeds; final prune of stale files on completion.
- Per-embed timeout: 13 s (120 s for first call while WASM/model loads).
- `reembedFile(TFile)`: debounced 2 s re-embed on vault `modify` events.
- `searchSimilarToFile(file, topK=10)`: cosine similarity with property/tag boosting (see below).
- `excludeFolders: string[]` — vault folder prefixes skipped during indexing.
- `contextProperties: string[]` — frontmatter keys whose wikilink values get +0.15 score boost; shared tags get +0.05 each (max 3). Scores capped at 1.0.
- Obsidian Sync wait: `waitForSyncIdle()` monitors vault events (5 s probe, 15 s quiet) before starting `buildIndex`.
- esbuild patches required: `stubNativeModules`, `forceOnnxWeb`, `forceOrtWebBrowserMode`. `import.meta.url` defined as a constant string.

## HybridSearch

- Combines `VaultSearch` (TF-IDF) and `EmbedSearch` (ONNX embeddings) via Reciprocal Rank Fusion.
- `RRF_K = 60` — standard constant; score = `1/(K + rank_tfidf + 1) + 1/(K + rank_embed + 1)`.
- Runs both engines in parallel (`Promise.all`), fetches `topK * 3` candidates from each.
- TF-IDF excerpts preserved in merged output; embedding results fill in where TF-IDF has no match.
- `plugin.hybridSearch` is set after `embedSearch.buildIndex()` completes; `plugin.activeSearch` returns it over `VaultSearch`.

## MemPalace Integration

- Requires `/usr/local/bin/mempalace` CLI installed on the host machine.
- `ChatView.queryMempalace(query)`: calls `mempalace search <query> --results N` via Node `execFile`, 10 s timeout.
- Silent no-op if binary missing, process errors, or stdout empty — never throws.
- Output section header: `MemPalace (Wissens-Archiv):`, prepended before vault context so it sits closest to the query in the prompt.
- Controlled by `settings.useMempalace` (toggle) and `settings.mempalaceResults` (1–10, default 3).
- Status indicator "MemPalace wird abgefragt…" shown during the CLI call.

## RelatedNotesView

- Opens in right sidebar leaf via `plugin.activateRelatedView()` or sparkles ribbon icon.
- Refreshes on `active-leaf-change` and `file-open` (400 ms debounce).
- `onIndexReady()` called by plugin after `buildIndex` completes.
- Shows: note title, folder path (dimmed), similarity bar + percentage.
- "verknüpft" badge (accent colour) for notes boosted by a property link.

## Settings (MemexChatSettings)

| Field | Default | Description |
|---|---|---|
| `apiKey` | `""` | Anthropic API key |
| `model` | `claude-opus-4-6` | Claude model ID |
| `maxTokens` | `8192` | Max output tokens (1024–16000) |
| `maxContextNotes` | `6` | TF-IDF/embedding context notes per query |
| `maxCharsPerNote` | `2500` | Characters per context note |
| `systemPrompt` | (German default) | Base system instructions |
| `systemContextFile` | `""` | Optional vault note appended to system prompt |
| `autoRetrieveContext` | `true` | Auto-search on send |
| `showContextPreview` | `true` | Show context confirm step |
| `saveThreadsToVault` | `true` | Save chats as vault markdown files |
| `threadsFolder` | `Calendar/Chat` | Folder for saved threads |
| `sendOnEnter` | `false` | Enter sends (vs. Cmd+Enter) |
| `contextProperties` | `[collection, related, up, tags]` | Frontmatter props boosted 5× in TF-IDF; also used for +0.15 score boost in EmbedSearch |
| `useEmbeddings` | `false` | Enable local semantic embeddings |
| `embeddingModel` | `TaylorAI/bge-micro-v2` | ONNX embedding model ID |
| `embedExcludeFolders` | `[]` | Vault folders excluded from embedding |
| `useMempalace` | `false` | Inject MemPalace CLI search results as additional context |
| `mempalaceResults` | `3` | Number of MemPalace results per query (1–10) |
| `promptButtons` | Draft Check, Monthly Check | Header mode buttons with system prompt extension |

## Prompt Buttons (PromptButton interface)

```typescript
interface PromptButton {
  label: string;
  filePath: string;        // vault path to prompt note (without .md)
  searchMode?: "date";     // enables date-based file search
  searchFolders?: string[]; // restrict date search to these folders
  helpText?: string;       // shown above input when button is active
}
```

## Folder Autocomplete

`attachFolderDropdown(wrap, input, getExcluded, onPick)` helper in `SettingsTab.ts` applied to:
- `embedExcludeFolders` (chip-tag list)
- prompt button `searchFolders` (chip-tag list)
- `threadsFolder` (single value)

CSS classes: `vc-folder-search-wrap`, `vc-folder-dropdown`, `vc-folder-item`.

## Deployment (Manual)

Copy `main.js`, `manifest.json`, `styles.css` into `.obsidian/plugins/memex-chat/` in the target vault.

## Models (SettingsTab.ts)

Static `MODELS` array (fallback / initial dropdown population):

| ID | Label |
|---|---|
| `claude-opus-4-6` | Claude Opus 4.6 (Stärkste) |
| `claude-sonnet-4-6` | Claude Sonnet 4.6 (Empfohlen) |
| `claude-haiku-4-5-20251001` | Claude Haiku 4.5 (Schnell) |

Default: `claude-opus-4-6`.

**"Aktualisieren" button**: calls `ClaudeClient.fetchModels(apiKey)` to fetch the live model list from the Anthropic API and repopulate the dropdown dynamically. This supersedes the static array at runtime. Update `MODELS` and `DEFAULT_SETTINGS.model` only when changing the compile-time fallback.

## Embedding Models (EmbedSearch.ts)

`EMBEDDING_MODELS` array exported from `EmbedSearch.ts` and used to populate the embedding model dropdown in settings:

| ID | Description |
|---|---|
| `TaylorAI/bge-micro-v2` | BGE Micro v2 — default, 384-dim, fastest |
| `Xenova/all-MiniLM-L6-v2` | MiniLM L6 v2 — 384-dim |
| `Xenova/multilingual-e5-small` | Multilingual E5 Small — DE/EN |
| `Xenova/paraphrase-multilingual-MiniLM-L12-v2` | Multilingual MiniLM L12 |
