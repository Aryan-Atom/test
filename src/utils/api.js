import axios from "axios";
import { AUTH_BASE_URL, buildExcelUploadUrl, DEFAULT_EXCEL_UPLOAD_BY } from "./auth.js";
import { getUserInfo } from "./cookieUtils.js";

const apiClient = axios.create({
  baseURL: AUTH_BASE_URL || undefined,
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
    ...headers,
  };

  if (!(body instanceof FormData) && body != null) {
    requestHeaders["Content-Type"] = requestHeaders["Content-Type"] || "application/json";
  }

  if (body instanceof FormData) {
    delete requestHeaders["Content-Type"];
    delete requestHeaders["content-type"];
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

export function uploadExcel(file, options = {}) {
  const { headers = {}, filterColumns, uploadedBy = DEFAULT_EXCEL_UPLOAD_BY, authToken } = options;
  const url = buildExcelUploadUrl(filterColumns);
  const formData = new FormData();
  formData.append("UploadedBy", getUserInfo()?.name);
  formData.append("File", file);

  return request("POST", url, formData, {
    headers,
    authToken,
  });
}

export const APIcallGet = async (url, headers = {}, callback, logoutOnTokenExpiry = false) => {
  try {
    const response = await apiClient.get(url, {
      headers: {
        ...headers,
      },
    });
    callback(response.data, response.status);
  } catch (error) {
    const status = error.response?.status || 500;
    const errorMessage = error.response?.data || error.message;
    if (status === 401) {
      if (logoutOnTokenExpiry) {
        console.error("Token expired, logging out.");
      } else {
        await APIcallGet(url, headers, callback, true);
      }
    } else {
      console.error(`GET ${url} failed:`, errorMessage);
      callback(errorMessage, status);
    }
  }
};

export const APIcallPost = async (
  url,
  reqBody,
  headers = {},
  callback,
  logoutOnTokenExpiry = false,
) => {
  try {
    const response = await apiClient.post(`${url}`, reqBody, {
      headers: {
        ...headers,
      },
    });
    callback(response.data, response.status);
  } catch (error) {
    const status = error.response?.status || 500;
    const errorMessage = error.response?.data || error.message;
    if (401 === status) {
      if (logoutOnTokenExpiry) {
      } else {
        await APIcallPost(url, reqBody, headers, callback, true);
      }
    } else {
      console.error(`POST ${url} failed:`, errorMessage);
      callback(errorMessage, status);
    }
  }
};
