import axios from "axios";
import Cookies from "js-cookie";
import { auth } from "./endPoints";
let endpoint = import.meta.env.VITE_APP_ELM_API_SERVER || "";
let rnEndpoint = import.meta.env.VITE_APP_RN_API_SERVER || "";
const userCookie = import.meta.env.VITE_APP_ELM_PROFILE_TOKEN_NAME || "";
const devCookie = import.meta.env.VITE_APP_ELM_TOKEN_NAME || "";

if (!endpoint) {
  console.warn("ELM API is not configured.");
} else {
  if (!endpoint.endsWith("/")) {
    endpoint += "/";
  }
}

if (!rnEndpoint) {
  console.warn("R&D Note API is not configured.");
} else {
  if (!rnEndpoint.endsWith("/")) {
    rnEndpoint += "/";
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

const ELMAPIcallGet = async (url, headers = {}, callback, logoutOnTokenExpiry = false) => {
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
        await ELMAPIcallGet(url, headers, callback, true);
      }
    } else {
      console.error(`GET ${url} failed:`, errorMessage);
      callback(errorMessage, status);
    }
  }
};

const RNAPIcallGet = async (url, headers = {}, callback, logoutOnTokenExpiry = false) => {
  try {
    const response = await axios.get(`${rnEndpoint}${url}`, {
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
        await RNAPIcallGet(url, headers, callback, true);
      }
    } else {
      console.error(`GET ${url} failed:`, errorMessage);
      callback(errorMessage, status);
    }
  }
};

const ELMAPIcallPost = async (
  url,
  reqBody,
  headers = {},
  callback,
  logoutOnTokenExpiry = false,
) => {
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
        await ELMAPIcallPost(url, reqBody, headers, callback, true);
      }
    } else {
      console.error(`POST ${url} failed:`, errorMessage);
      callback(errorMessage, status);
    }
  }
};

const RNAPIcallPost = async (url, reqBody, headers = {}, callback, logoutOnTokenExpiry = false) => {
  try {
    const response = await axios.post(`${rnEndpoint}${url}`, reqBody, {
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
        await RNAPIcallPost(url, reqBody, headers, callback, true);
      }
    } else {
      console.error(`POST ${url} failed:`, errorMessage);
      callback(errorMessage, status);
    }
  }
};

const RNAPIcallPatch = async (
  url,
  reqBody,
  headers = {},
  callback,
  logoutOnTokenExpiry = false,
) => {
  try {
    const response = await axios.patch(`${rnEndpoint}${url}`, reqBody, {
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
        await RNAPIcallPatch(url, reqBody, headers, callback, true);
      }
    } else {
      console.error(`POST ${url} failed:`, errorMessage);
      callback(errorMessage, status);
    }
  }
};
const RNAPIcallDelete = async (
  url,
  headers = {},
  callback,
  logoutOnTokenExpiry = false,
  data = {},
) => {
  try {
    const response = await axios.delete(`${rnEndpoint}${url}`, {
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
        await RNAPIcallDelete(url, headers, callback, true);
      }
    } else {
      console.error(`DELETE ${url} failed:`, errorMessage);
      callback(errorMessage, status);
    }
  }
};
const ELMAPIcallPatch = async (
  url,
  reqBody,
  headers = {},
  callback,
  logoutOnTokenExpiry = false,
) => {
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
        await ELMAPIcallPut(url, reqBody, headers, callback, true);
      }
    } else {
      console.error(`PUT ${url} failed:`, errorMessage);
      callback(errorMessage, status);
    }
  }
};
const ELMAPIcallPut = async (url, reqBody, headers = {}, callback, logoutOnTokenExpiry = false) => {
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
        await ELMAPIcallPut(url, reqBody, headers, callback, true);
      }
    } else {
      console.error(`PUT ${url} failed:`, errorMessage);
      callback(errorMessage, status);
    }
  }
};

const ELMAPIcallDelete = async (
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
        await ELMAPIcallDelete(url, headers, callback, true);
      }
    } else {
      console.error(`DELETE ${url} failed:`, errorMessage);
      callback(errorMessage, status);
    }
  }
};

const ELMAPIcallPostFile = async (
  url,
  reqBody,
  headers = {},
  callback,
  logoutOnTokenExpiry = false,
) => {
  try {
    const response = await axios.post(`${endpoint}${url}`, reqBody, {
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
        await ELMAPIcallPostFile(url, reqBody, headers, callback, true);
      }
    } else {
      console.error(`POST ${url} failed:`, errorMessage);
      callback(errorMessage, status);
    }
  }
};

const ELMAPIcallGetFile = async (url, headers = {}, callback, logoutOnTokenExpiry = false) => {
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
        await ELMAPIcallGetFile(url, headers, callback, true);
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
  ELMAPIcallGet,
  ELMAPIcallPost,
  ELMAPIcallDelete,
  ELMAPIcallPut,
  ELMAPIcallPostFile,
  ELMAPIcallGetFile,
  ELMAPIcallPatch,
  RNAPIcallPost,
  RNAPIcallGet,
  RNAPIcallDelete,
  RNAPIcallPatch,
  getAuthorizationToken,
};
