export const isStaticDataMode =
  String(import.meta.env.VITE_APP_STATIC_DATA ?? "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .toLowerCase() === "true";

export const staticAppRole = String(import.meta.env.VITE_APP_ROLE ?? "USER")
  .trim()
  .replace(/^["']|["']$/g, "")
  .toUpperCase();

export const isStaticAdminRole = staticAppRole === "ADMIN";

export const isLoadTableDataOnload =
  // !isStaticDataMode &&
  String(import.meta.env.VITE_LOAD_TABLE_DATA_ONLOAD ?? "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .toLowerCase() === "true";
