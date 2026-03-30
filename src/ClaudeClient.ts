import { requestUrl } from "obsidian";

export interface ClaudeMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ClaudeOptions {
  apiKey: string;
  model: string;
  maxTokens?: number;
  systemPrompt: string;
}

export interface ClaudeStreamChunk {
  type: "text" | "done" | "error";
  text?: string;
  error?: string;
}

/** Minimal Claude API client. streamChat uses fetch+SSE; other methods use requestUrl. */
export class ClaudeClient {
  private baseUrl = "https://api.anthropic.com/v1/messages";

  private headers(apiKey: string): Record<string, string> {
    return {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    };
  }

  /** Stream a chat completion via fetch + SSE, yielding text chunks as they arrive. */
  async *streamChat(
    messages: ClaudeMessage[],
    options: ClaudeOptions
  ): AsyncGenerator<ClaudeStreamChunk> {
    let response: Response;
    try {
      response = await fetch(this.baseUrl, {
        method: "POST",
        headers: this.headers(options.apiKey),
        body: JSON.stringify({
          model: options.model,
          max_tokens: options.maxTokens ?? 8192,
          system: options.systemPrompt,
          messages,
          stream: true,
        }),
      });
    } catch (e) {
      yield { type: "error", error: (e as Error).message };
      return;
    }

    if (!response.ok) {
      const text = await response.text();
      yield { type: "error", error: `API Error ${response.status}: ${text}` };
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      yield { type: "error", error: "No response body" };
      return;
    }

    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") { yield { type: "done" }; return; }
          try {
            const event = JSON.parse(data);
            if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
              yield { type: "text", text: event.delta.text };
            }
          } catch {
            // skip malformed SSE lines
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    yield { type: "done" };
  }

  /** Non-streaming convenience wrapper */
  async chat(messages: ClaudeMessage[], options: ClaudeOptions): Promise<string> {
    const response = await requestUrl({
      url: this.baseUrl,
      method: "POST",
      headers: this.headers(options.apiKey),
      body: JSON.stringify({
        model: options.model,
        max_tokens: options.maxTokens ?? 8192,
        system: options.systemPrompt,
        messages,
      }),
      throw: false,
    });

    if (response.status >= 400) {
      throw new Error(`API Error ${response.status}: ${response.text}`);
    }

    return response.json.content?.[0]?.text ?? "";
  }

  /**
   * Fetch Claude models from the Anthropic Models API.
   * Returns the 2 newest versions of each family (opus, sonnet, haiku), in that order.
   */
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

    const sorted = data.sort((a, b) => b.created - a.created);
    const families = ["opus", "sonnet", "haiku"] as const;
    return families.flatMap((family) =>
      sorted
        .filter((m) => m.id.includes(family))
        .slice(0, 2)
        .map((m) => ({ id: m.id, name: m.id }))
    );
  }
}
