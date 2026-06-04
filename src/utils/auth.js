const rawApiHost = import.meta.env.VITE_API_BASE_URL ?? "";
const apiHost = rawApiHost.replace(/\/$/, "");
export const AUTH_BASE_PATH = "/api";
export const AUTH_BASE_URL = apiHost
  ? `${apiHost}${AUTH_BASE_PATH}`
  : AUTH_BASE_PATH;

export const AUTH_ENDPOINTS = {
  login: `${AUTH_BASE_URL}/auth/login`,
  logout: `${AUTH_BASE_URL}/auth/logout`,
  refreshToken: `${AUTH_BASE_URL}/auth/refresh-token`,
  userProfile: `${AUTH_BASE_URL}/auth/me`,
};

const parseFilterColumns = (value) => {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // ignore
  }

  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

export const DEFAULT_EXCEL_FILTER_COLUMNS = parseFilterColumns(
  import.meta.env.VITE_EXCEL_FILTER_COLUMNS,
);
export const DEFAULT_EXCEL_UPLOAD_BY =
  import.meta.env.VITE_EXCEL_UPLOADED_BY ?? "string";

export const EXCEL_UPLOAD_ENDPOINT = `${AUTH_BASE_URL}/Excel/Upload`;

export function buildAuthUrl(endpoint) {
  return AUTH_ENDPOINTS[endpoint] ?? endpoint;
}

export function buildExcelUploadUrl(
  filterColumns = DEFAULT_EXCEL_FILTER_COLUMNS,
) {
  const params = new URLSearchParams();
  if (filterColumns.length > 0) {
    params.set("FilterColumns", JSON.stringify(filterColumns));
  }
  return `${EXCEL_UPLOAD_ENDPOINT}${params.toString() ? `?${params.toString()}` : ""}`;
}

export function getAccessToken() {
  return localStorage.getItem("accessToken");
}

export function setAccessToken(token) {
  localStorage.setItem("accessToken", token);
}

export function removeAccessToken() {
  localStorage.removeItem("accessToken");
}
