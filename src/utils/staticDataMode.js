export const isStaticDataMode =
  String(import.meta.env.VITE_APP_STATIC_DATA ?? "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .toLowerCase() === "true";

