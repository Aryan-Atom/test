import { pocEndPoints } from "../axios/endPoints.js";

export const promptApi = {
  /**
   * Fetch list of prompts directly from API
   * GET /api/prompts
   */
  async prompts() {
    const url = pocEndPoints.AI_PIPELINE_PROMPTS || "http://107.108.32.188:8001/api/prompts";
    const res = await fetch(url, {
      headers: {
        accept: "application/json",
      },
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(
        errData.detail || errData.message || `Failed to fetch prompts (status: ${res.status})`
      );
    }

    return await res.json();
  },

  /**
   * Save edited prompt segments
   * PUT /api/prompts/{name} with { segments: [{ text, locked }] }
   * @param {string} name
   * @param {Array<{ text: string, locked: boolean }>} segments
   */
  async savePrompt(name, segments) {
    const url = pocEndPoints.AI_PIPELINE_SAVE_PROMPT(name);

    const rawList = Array.isArray(segments)
      ? segments
      : Array.isArray(segments?.segments)
        ? segments.segments
        : [];

    const cleanSegments = rawList.map((s) => ({
      text: String(s.text ?? ""),
      locked: Boolean(s.locked),
    }));

    const res = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({ segments: cleanSegments }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(
        errData.detail || errData.message || `Failed to save prompt (status: ${res.status})`
      );
    }

    return await res.json();
  },

  /**
   * Reset prompt to original built-in wording
   * @param {string} name
   */
  async resetPrompt(name) {
    const url = pocEndPoints.AI_PIPELINE_RESET_PROMPT(name);
    let res = await fetch(url, {
      method: "POST",
      headers: { accept: "application/json" },
    });

    // If POST /reset is 404 or 405, fallback to DELETE /api/prompts/{name}
    if (!res.ok && (res.status === 404 || res.status === 405)) {
      const deleteUrl = pocEndPoints.AI_PIPELINE_SAVE_PROMPT(name);
      res = await fetch(deleteUrl, {
        method: "DELETE",
        headers: { accept: "application/json" },
      });
    }

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(
        errData.detail || errData.message || `Failed to reset prompt (status: ${res.status})`
      );
    }

    return await res.json();
  },
};
