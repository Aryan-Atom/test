import axios from "axios";
import {
  AUTH_BASE_URL,
  buildExcelUploadUrl,
  DEFAULT_EXCEL_UPLOAD_BY,
} from "./auth.js";

const defaultHeaders = {
  "Content-Type": "application/json",
};

const apiClient = axios.create({
  baseURL: AUTH_BASE_URL || undefined,
  headers: defaultHeaders,
});

function buildUrl(url, params) {
  if (!params || Object.keys(params).length === 0) {
    return url;
  }
  const query = new URLSearchParams(params).toString();
  return `${url}${url.includes("?") ? "&" : "?"}${query}`;
}

async function request(method, url, body = null, options = {}) {
  const { headers = {}, params, authToken, responseType } = options;
  const requestUrl = buildUrl(url, params);
  const requestHeaders = {
    ...defaultHeaders,
    ...headers,
  };

  if (body instanceof FormData) {
    delete requestHeaders["Content-Type"];
  }

  if (authToken) {
    requestHeaders.Authorization = `Bearer ${authToken}`;
  }

  try {
    const response = await apiClient({
      method,
      url: requestUrl,
      headers: requestHeaders,
      data: body != null ? body : undefined,
      responseType,
    });

    return response.data;
  } catch (error) {
    if (error.response) {
      const err = new Error(error.response.data?.message || error.message);
      err.status = error.response.status;
      err.response = error.response.data;
      throw err;
    }
    throw error;
  }
}

export function apiGet(url, options) {
  return request("GET", url, null, options);
}

export function apiPost(url, body, options) {
  return request("POST", url, body, options);
}

export function apiDelete(url, options) {
  return request("DELETE", url, null, options);
}

export function apiRequest(method, url, body, options) {
  return request(method, url, body, options);
}

export function uploadExcel(file, options = {}) {
  const {
    headers = {},
    filterColumns,
    uploadedBy = DEFAULT_EXCEL_UPLOAD_BY,
    authToken,
  } = options;
  const url = buildExcelUploadUrl(filterColumns);
  const formData = new FormData();
  formData.append("UploadedBy", uploadedBy);
  formData.append("File", file);

  return request("POST", url, formData, {
    headers,
    authToken,
  });
}
