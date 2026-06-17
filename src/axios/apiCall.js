import axios from "axios";
import Cookies from "js-cookie";
import { auth } from "./endPoints";
let endpoint = import.meta.env.VITE_API_BASE_URL || "";
const userCookie = import.meta.env.VITE_APP_ELM_PROFILE_TOKEN_NAME || "";
const devCookie = import.meta.env.VITE_APP_ELM_TOKEN_NAME || "";

if (!endpoint) {
  console.warn("ELM API is not configured.");
} else {
  if (!endpoint.endsWith("/")) {
    endpoint += "/";
  }
}

const { VITE_APP_ELM_AUTH_TOKEN, VITE_APP_ELM_REFRESH_TOKEN } = import.meta.env;

const getHeadersFromCookies = () => {
  const authToken = Cookies.get(VITE_APP_ELM_AUTH_TOKEN);
  return {
    "Content-Type": "application/json",
    Authorization: authToken ? `Bearer ${authToken}` : undefined,
  };
};

const getRefreshToken = async () => {
  try {
    const authToken = Cookies.get(VITE_APP_ELM_AUTH_TOKEN);
    const refreshToken = Cookies.get(VITE_APP_ELM_REFRESH_TOKEN);

    if (
      authToken === undefined ||
      authToken.length === 0 ||
      refreshToken === undefined ||
      refreshToken.length === 0
    ) {
      await clearCookies();
      return;
    }

    const reqBody = {
      token: authToken,
      refreshToken: refreshToken,
    };

    const response = await axios.post(`${endpoint}${auth.REFRESH_TOKEN}`, reqBody, {});
    if (response?.status === 200) {
      Cookies.set(VITE_APP_ELM_AUTH_TOKEN, response?.data.token);
      Cookies.set(VITE_APP_ELM_REFRESH_TOKEN, response?.data.refreshToken);
    } else {
      await clearCookies();
    }
  } catch (error) {
    const status = error.response?.status || 500;
    if (status === 400 || status === 401) {
      await clearCookies();
    }
  }
};

const clearCookies = async () => {
  Cookies.remove(userCookie);
  Cookies.remove(devCookie);
  Cookies.remove(VITE_APP_ELM_AUTH_TOKEN);
  Cookies.remove(VITE_APP_ELM_REFRESH_TOKEN);
};

const APIcallGet = async (url, headers = {}, callback, logoutOnTokenExpiry = false) => {
  try {
    const response = await axios.get(`${endpoint}${url}`, {
      headers: {
        ...getHeadersFromCookies(),
        ...headers,
      },
    });
    callback(response.data, response.status);
  } catch (error) {
    const status = error.response?.status || 500;
    const errorMessage = error.response?.data || error.message;
    if (401 === status) {
      if (logoutOnTokenExpiry) {
        await clearCookies();
      } else {
        await getRefreshToken();
        // Retry call after refreshing token.
        await APIcallGet(url, headers, callback, true);
      }
    } else {
      console.error(`GET ${url} failed:`, errorMessage);
      callback(errorMessage, status);
    }
  }
};

const APIcallPost = async (url, reqBody, headers = {}, callback, logoutOnTokenExpiry = false) => {
  try {
    const response = await axios.post(`${endpoint}${url}`, reqBody, {
      headers: {
        ...getHeadersFromCookies(),
        ...headers,
      },
    });
    callback(response.data, response.status);
  } catch (error) {
    const status = error.response?.status || 500;
    const errorMessage = error.response?.data || error.message;
    if (401 === status) {
      if (logoutOnTokenExpiry) {
        await clearCookies();
      } else {
        await getRefreshToken();
        // Retry call after refreshing token.
        await APIcallPost(url, reqBody, headers, callback, true);
      }
    } else {
      console.error(`POST ${url} failed:`, errorMessage);
      callback(errorMessage, status);
    }
  }
};

const APIcallPatch = async (url, reqBody, headers = {}, callback, logoutOnTokenExpiry = false) => {
  try {
    const response = await axios.patch(`${endpoint}${url}`, reqBody, {
      headers: {
        ...getHeadersFromCookies(),
        ...headers,
      },
    });
    callback(response.data, response.status);
  } catch (error) {
    const status = error.response?.status || 500;
    const errorMessage = error.response?.data || error.message;
    if (401 === status) {
      if (logoutOnTokenExpiry) {
        await clearCookies();
      } else {
        await getRefreshToken();
        // Retry call after refreshing token.
        await APIcallPut(url, reqBody, headers, callback, true);
      }
    } else {
      console.error(`PUT ${url} failed:`, errorMessage);
      callback(errorMessage, status);
    }
  }
};
const APIcallPut = async (url, reqBody, headers = {}, callback, logoutOnTokenExpiry = false) => {
  try {
    const response = await axios.put(`${endpoint}${url}`, reqBody, {
      headers: {
        ...getHeadersFromCookies(),
        ...headers,
      },
    });
    callback(response.data, response.status);
  } catch (error) {
    const status = error.response?.status || 500;
    const errorMessage = error.response?.data || error.message;
    if (401 === status) {
      if (logoutOnTokenExpiry) {
        await clearCookies();
      } else {
        await getRefreshToken();
        // Retry call after refreshing token.
        await APIcallPut(url, reqBody, headers, callback, true);
      }
    } else {
      console.error(`PUT ${url} failed:`, errorMessage);
      callback(errorMessage, status);
    }
  }
};

const APIcallDelete = async (
  url,
  headers = {},
  callback,
  logoutOnTokenExpiry = false,
  data = {},
) => {
  try {
    const response = await axios.delete(`${endpoint}${url}`, {
      headers: {
        ...getHeadersFromCookies(),
        ...headers,
      },
      data: data,
    });
    callback(response.data, response.status);
  } catch (error) {
    const status = error.response?.status || 500;
    const errorMessage = error.response?.data || error.message;
    if (401 === status) {
      if (logoutOnTokenExpiry) {
        await clearCookies();
      } else {
        await getRefreshToken();
        // Retry call after refreshing token.
        await APIcallDelete(url, headers, callback, true);
      }
    } else {
      console.error(`DELETE ${url} failed:`, errorMessage);
      callback(errorMessage, status);
    }
  }
};

const APIcallPostFile = async (
  url,
  reqBody,
  headers = {},
  callback,
  logoutOnTokenExpiry = false,
) => {
  try {
    const isFormData = reqBody instanceof FormData;

    const finalHeaders = {
      ...getHeadersFromCookies(),
      ...headers,
    };

    // Very important: browser should set multipart boundary automatically
    if (isFormData) {
      delete finalHeaders["Content-Type"];
      delete finalHeaders["content-type"];
    }

    const response = await axios.post(`${endpoint}${url}`, reqBody, {
      headers: finalHeaders,
    });

    callback(response.data, response.status);
  } catch (error) {
    const status = error.response?.status || 500;
    const errorMessage = error.response?.data || error.message;

    if (status === 401) {
      if (logoutOnTokenExpiry) {
        await clearCookies();
      } else {
        await getRefreshToken();
        await APIcallPostFile(url, reqBody, headers, callback, true);
      }
    } else {
      console.error(`POST ${url} failed:`, errorMessage);
      callback(errorMessage, status);
    }
  }
};

const APIcallGetFile = async (url, headers = {}, callback, logoutOnTokenExpiry = false) => {
  try {
    const response = await axios.get(`${endpoint}${url}`, {
      headers: {
        ...getHeadersFromCookies(),
        ...headers,
      },
      responseType: "blob",
    });
    callback(response.data, response.status);
  } catch (error) {
    const status = error.response?.status || 500;
    const errorMessage = error.response?.data || error.message;
    if (401 === status) {
      if (logoutOnTokenExpiry) {
        await clearCookies();
      } else {
        await getRefreshToken();
        // Retry call after refreshing token.
        await APIcallGetFile(url, headers, callback, true);
      }
    } else {
      console.error(`GET ${url} failed:`, errorMessage);
      callback(errorMessage, status);
    }
  }
};

const getAuthorizationToken = () => {
  const authToken = Cookies.get(VITE_APP_ELM_AUTH_TOKEN);
  return {
    "Content-Type": "application/json",
    Authorization: authToken ? `Bearer ${authToken}` : undefined,
  };
};

export {
  APIcallGet,
  APIcallPost,
  APIcallDelete,
  APIcallPut,
  APIcallPostFile,
  APIcallGetFile,
  APIcallPatch,
  getAuthorizationToken,
};
