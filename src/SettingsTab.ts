import { App, PluginSettingTab, Setting } from "obsidian";
import type MemexChatPlugin from "./main";

export interface MemexChatSettings {
  apiKey: string;
  model: string;
  maxContextNotes: number;
  maxCharsPerNote: number;
  systemPrompt: string;
  autoRetrieveContext: boolean;
  showContextPreview: boolean;
  saveThreadsToVault: boolean;
  threadsFolder: string;
}

export const DEFAULT_SETTINGS: MemexChatSettings = {
  apiKey: "",
  model: "claude-opus-4-5-20251101",
  maxContextNotes: 6,
  maxCharsPerNote: 2500,
  systemPrompt: `Du bist ein hilfreicher Assistent mit Zugriff auf die persönliche Wissensdatenbank des Nutzers (Obsidian Vault).

Wenn du Fragen beantwortest:
- Nutze die bereitgestellten Notizen als primäre Wissensquelle
- Verweise auf relevante Notizen mit [[doppelten eckigen Klammern]]
- Antworte auf Deutsch, wenn die Frage auf Deutsch gestellt wird
- Wenn der Kontext unzureichend ist, sage das ehrlich und gib an, was noch fehlen könnte
- Verknüpfe Konzepte aus verschiedenen Notizen kreativ miteinander`,
  autoRetrieveContext: true,
  showContextPreview: true,
  saveThreadsToVault: true,
  threadsFolder: "Calendar/Chat",
};

export const MODELS = [
  { id: "claude-opus-4-5-20251101", name: "Claude Opus 4.5 (Stärkst)" },
  { id: "claude-sonnet-4-5-20250929", name: "Claude Sonnet 4.5 (Empfohlen)" },
  { id: "claude-haiku-4-5-20251001", name: "Claude Haiku 4.5 (Schnell)" },
  { id: "claude-opus-4-5-20251101", name: "Claude Opus 4.5" },
];

export class MemexChatSettingsTab extends PluginSettingTab {
  plugin: MemexChatPlugin;

  constructor(app: App, plugin: MemexChatPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Memex Chat Einstellungen" });

    // --- API ---
    containerEl.createEl("h3", { text: "Claude API" });

    new Setting(containerEl)
      .setName("API Key")
      .setDesc("Dein Anthropic API Key (sk-ant-...)")
      .addText((text) =>
        text
          .setPlaceholder("sk-ant-api03-...")
          .setValue(this.plugin.settings.apiKey)
          .onChange(async (value) => {
            this.plugin.settings.apiKey = value.trim();
            await this.plugin.saveSettings();
          })
      );

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

    // --- Context ---
    containerEl.createEl("h3", { text: "Kontext-Einstellungen" });

    new Setting(containerEl)
      .setName("Max. Kontext-Notizen")
      .setDesc("Wie viele Notizen werden automatisch als Kontext hinzugefügt? (1–15)")
      .addSlider((slider) =>
        slider
          .setLimits(1, 15, 1)
          .setValue(this.plugin.settings.maxContextNotes)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.maxContextNotes = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Max. Zeichen pro Notiz")
      .setDesc("Wie viele Zeichen einer Notiz in den Kontext einbezogen werden (1000–8000)")
      .addSlider((slider) =>
        slider
          .setLimits(1000, 8000, 500)
          .setValue(this.plugin.settings.maxCharsPerNote)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.maxCharsPerNote = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Automatischer Kontext-Abruf")
      .setDesc("Beim Senden automatisch relevante Notizen suchen und einbinden")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.autoRetrieveContext).onChange(async (value) => {
          this.plugin.settings.autoRetrieveContext = value;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Kontext-Vorschau anzeigen")
      .setDesc("Vor dem Senden zeigen, welche Notizen als Kontext verwendet werden")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.showContextPreview).onChange(async (value) => {
          this.plugin.settings.showContextPreview = value;
          await this.plugin.saveSettings();
        })
      );

    // --- Threads ---
    containerEl.createEl("h3", { text: "Thread-History" });

    new Setting(containerEl)
      .setName("Threads im Vault speichern")
      .setDesc("Chat-Threads als Markdown-Notizen im Vault ablegen")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.saveThreadsToVault).onChange(async (value) => {
          this.plugin.settings.saveThreadsToVault = value;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Threads-Ordner")
      .setDesc("Pfad im Vault, wo Chat-Threads gespeichert werden")
      .addText((text) =>
        text
          .setPlaceholder("Calendar/Chat")
          .setValue(this.plugin.settings.threadsFolder)
          .onChange(async (value) => {
            this.plugin.settings.threadsFolder = value;
            await this.plugin.saveSettings();
          })
      );

    // --- System Prompt ---
    containerEl.createEl("h3", { text: "System Prompt" });

    new Setting(containerEl)
      .setName("System Prompt")
      .setDesc("Instruktionen für Claude (wie soll er sich verhalten?)")
      .addTextArea((textarea) => {
        textarea
          .setValue(this.plugin.settings.systemPrompt)
          .onChange(async (value) => {
            this.plugin.settings.systemPrompt = value;
            await this.plugin.saveSettings();
          });
        textarea.inputEl.rows = 8;
        textarea.inputEl.style.width = "100%";
        textarea.inputEl.style.fontFamily = "monospace";
        textarea.inputEl.style.fontSize = "12px";
      });

    // --- Actions ---
    containerEl.createEl("h3", { text: "Aktionen" });

    new Setting(containerEl)
      .setName("Index neu aufbauen")
      .setDesc("Vault-Index für die Suche neu aufbauen (dauert je nach Vault-Größe einige Sekunden)")
      .addButton((btn) =>
        btn
          .setButtonText("Index neu aufbauen")
          .setCta()
          .onClick(async () => {
            btn.setButtonText("Indiziere…");
            btn.setDisabled(true);
            await this.plugin.rebuildIndex();
            btn.setButtonText("✓ Fertig!");
            setTimeout(() => {
              btn.setButtonText("Index neu aufbauen");
              btn.setDisabled(false);
            }, 2000);
          })
      );
  }
}
