# Fetch Models Design

**Date:** 2026-03-27
**Status:** Approved

## Summary

Add an "Aktualisieren" button to the Model setting in the settings tab. When clicked, it fetches the 3 newest Claude models from the Anthropic Models API and updates the dropdown. Falls back to the hardcoded `MODELS` list if the request fails or returns no models.

## ClaudeClient changes

Add a new method `fetchModels(apiKey: string): Promise<{id: string, name: string}[]>` to `ClaudeClient`.

- URL: `"https://api.anthropic.com/v1/models"` — inline string or a separate private constant; **do not use or modify `baseUrl`** (which points to `/v1/messages`)
- Call `requestUrl` with `throw: false` (same pattern as `streamChat`/`chat`) and `this.headers(apiKey)`
- Response shape: `{ data: [{ id: string, created: number, display_name: string, ... }] }`
- Throw on `response.status >= 400` with the response text
- If `data` is empty, throw an error ("No models returned") — do not return an empty array
- Sort `data` descending by `created`, take top 3
- Return `{ id, name: id }` for each — use `id` as the display name (not `display_name`). Note: fetched entries will show raw IDs (e.g. `claude-opus-4-6`) while hardcoded `MODELS` show human-friendly names (e.g. `"Claude Opus 4.6 (Stärkste)"`). This is intentional — keeps the implementation simple and avoids relying on API-provided display strings.

## SettingsTab changes

**Import addition:** Add `Notice, ButtonComponent, DropdownComponent` to the `import { ... } from "obsidian"` line.

Convert the existing "Modell" `Setting` to capture both the `DropdownComponent` and `ButtonComponent` references by chaining `addDropdown()` and `addButton()` on the same `Setting` instance:

```typescript
let modelDrop: DropdownComponent;
let refreshBtn: ButtonComponent;

new Setting(containerEl)
  .setName("Modell")
  .setDesc("Welches Claude-Modell verwenden?")
  .addDropdown((drop) => {
    modelDrop = drop;
    for (const m of MODELS) drop.addOption(m.id, m.name);
    drop.setValue(this.plugin.settings.model).onChange(async (value) => {
      this.plugin.settings.model = value;
      await this.plugin.saveSettings();
    });
  })
  .addButton((btn) => {
    refreshBtn = btn;
    btn.setButtonText("Aktualisieren").onClick(async () => { /* see click flow */ });
  });
```

**Click flow:**
1. Capture current value: `const prev = modelDrop.getValue()`
2. `refreshBtn.setDisabled(true)` and `refreshBtn.setButtonText("...")`
3. In a try/catch/finally:
   - **try:** Call `this.plugin.claude.fetchModels(this.plugin.settings.apiKey)`
   - On success: clear dropdown with `modelDrop.selectEl.empty()`, repopulate via `modelDrop.addOption(id, name)` for each fetched model, then set value to `prev` if it exists among the fetched ids, otherwise the first fetched id; save via `this.plugin.settings.model = modelDrop.getValue(); await this.plugin.saveSettings()`
   - **catch:** `new Notice("Modelle konnten nicht geladen werden: " + err.message)` — dropdown is **not** modified on error (hardcoded options remain)
   - **finally:** `refreshBtn.setDisabled(false)` and `refreshBtn.setButtonText("Aktualisieren")`

**Fallback:** The hardcoded `MODELS` array in `SettingsTab.ts` is unchanged and remains the initial population of the dropdown on every settings open.

## Data flow

```
[Aktualisieren button click]
  → capture prev = modelDrop.getValue()
  → disable button, show "..."
  → this.plugin.claude.fetchModels(apiKey)  [throw: false, separate URL]
    → throw if status >= 400 or data empty
    → sort by created desc, take 3
    → return [{id, name: id}]
  → clear selectEl, repopulate, restore selection
  → save model to settings
  → finally: restore button
```

## Error handling

| Scenario | Behaviour |
|---|---|
| No API key (401) | Notice shown; dropdown unchanged |
| Network failure | Notice shown; dropdown unchanged |
| Empty `data` array | Treated as error; Notice shown; dropdown unchanged |
| Fewer than 3 models returned | Take all returned (no error) |

## Out of scope

- Persisting fetched models across restarts
- Auto-fetching on settings open or plugin startup
- Configurable count of models to show
- Updating `DEFAULT_SETTINGS.model` after a fetch
