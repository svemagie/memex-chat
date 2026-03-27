# Fetch Models Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "Aktualisieren" button next to the model dropdown in settings that fetches the 3 newest Claude models from the Anthropic API and repopulates the dropdown.

**Architecture:** `ClaudeClient` gains a `fetchModels()` method (reusing existing `requestUrl`/`headers` patterns). `SettingsTab` captures the `DropdownComponent` and `ButtonComponent` references, wires the button to call `fetchModels`, and rebuilds the dropdown on success.

**Tech Stack:** TypeScript, Obsidian plugin API (`requestUrl`, `Setting`, `DropdownComponent`, `ButtonComponent`, `Notice`), Anthropic Models API (`GET /v1/models`)

---

## File Map

| File | Change |
|---|---|
| `src/ClaudeClient.ts` | Add `fetchModels(apiKey)` method |
| `src/SettingsTab.ts` | Update imports; refactor "Modell" `Setting` to capture dropdown + add button |

---

### Task 1: Add `fetchModels` to `ClaudeClient`

**Files:**
- Modify: `src/ClaudeClient.ts`

- [ ] **Step 1: Add the method after the `chat()` method**

In `src/ClaudeClient.ts`, add after line 86 (after `chat()`'s closing brace):

```typescript
  /** Fetch the 3 newest Claude models from the Anthropic Models API. */
  async fetchModels(apiKey: string): Promise<{ id: string; name: string }[]> {
    const response = await requestUrl({
      url: "https://api.anthropic.com/v1/models",
      method: "GET",
      headers: this.headers(apiKey),
      throw: false,
    });

    if (response.status >= 400) {
      throw new Error(`API Error ${response.status}: ${response.text}`);
    }

    const data: { id: string; created: number }[] = response.json.data ?? [];
    if (data.length === 0) {
      throw new Error("No models returned");
    }

    return data
      .sort((a, b) => b.created - a.created)
      .slice(0, 3)
      .map((m) => ({ id: m.id, name: m.id }));
  }
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build
```

Expected: no TypeScript errors, `main.js` written successfully.

- [ ] **Step 3: Commit**

```bash
git add src/ClaudeClient.ts
git commit -m "feat: add fetchModels to ClaudeClient"
```

---

### Task 2: Update SettingsTab — imports and model setting

**Files:**
- Modify: `src/SettingsTab.ts:1` (import line)
- Modify: `src/SettingsTab.ts:151-160` (the "Modell" Setting block)

- [ ] **Step 1: Extend the import from `"obsidian"`**

Replace the current import line 1:

```typescript
import { App, PluginSettingTab, Setting } from "obsidian";
```

With:

```typescript
import { App, ButtonComponent, DropdownComponent, Notice, PluginSettingTab, Setting } from "obsidian";
```

- [ ] **Step 2: Replace the "Modell" Setting block**

Replace lines 151–160:

```typescript
    new Setting(containerEl)
      .setName("Modell")
      .setDesc("Welches Claude-Modell verwenden?")
      .addDropdown((drop) => {
        for (const m of MODELS) drop.addOption(m.id, m.name);
        drop.setValue(this.plugin.settings.model).onChange(async (value) => {
          this.plugin.settings.model = value;
          await this.plugin.saveSettings();
        });
      });
```

With:

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
        btn.setButtonText("Aktualisieren").onClick(async () => {
          const prev = modelDrop.getValue();
          refreshBtn.setDisabled(true);
          refreshBtn.setButtonText("...");
          try {
            const models = await this.plugin.claude.fetchModels(this.plugin.settings.apiKey);
            modelDrop.selectEl.empty();
            for (const m of models) modelDrop.addOption(m.id, m.name);
            modelDrop.setValue(prev);
            this.plugin.settings.model = modelDrop.getValue();
            await this.plugin.saveSettings();
          } catch (err) {
            new Notice("Modelle konnten nicht geladen werden: " + (err as Error).message);
          } finally {
            refreshBtn.setDisabled(false);
            refreshBtn.setButtonText("Aktualisieren");
          }
        });
      });
```

- [ ] **Step 3: Verify build passes**

```bash
npm run build
```

Expected: no TypeScript errors, `main.js` written successfully.

- [ ] **Step 4: Manual smoke test in Obsidian**

1. Copy `main.js`, `manifest.json`, `styles.css` to `.obsidian/plugins/memex-chat/` in your vault
2. Reload the plugin (or restart Obsidian)
3. Open Settings → Memex Chat
4. Confirm the "Modell" row has a dropdown and an "Aktualisieren" button
5. With a valid API key set, click "Aktualisieren" — button should show "...", then restore; dropdown should show 3 model IDs
6. With no API key, click "Aktualisieren" — a Notice should appear with an error message; dropdown should be unchanged

- [ ] **Step 5: Commit**

```bash
git add src/SettingsTab.ts
git commit -m "feat: add Aktualisieren button to fetch models from API"
```
