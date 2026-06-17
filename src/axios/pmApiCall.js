import axios from "axios";
import Cookies from "js-cookie";
import { auth } from "./endPoints";
const userCookie = import.meta.env.VITE_APP_ELM_PROFILE_TOKEN_NAME || "";
const devCookie = import.meta.env.VITE_APP_ELM_TOKEN_NAME || "";
let pmEndpoint = import.meta.env.VITE_APP_PM_API_SERVER || "";

if (!pmEndpoint) {
  console.warn("PM API is not configured.");
} else {
  if (!pmEndpoint.endsWith("/")) {
    pmEndpoint += "/";
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

const PMAPIcallGet = async (url, headers = {}, callback, logoutOnTokenExpiry = false) => {
  try {
    const response = await axios.get(`${pmEndpoint}${url}`, {
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
        await PMAPIcallGet(url, headers, callback, true);
      }
    } else {
      console.error(`GET ${url} failed:`, errorMessage);
      callback(errorMessage, status);
    }
  }
};

const PMAPIStream = async (url, headers = {}, onMessage, onError, controller) => {
  try {
    const response = await fetch(`${pmEndpoint}${url}`, {
      method: "GET",
      headers: {
        ...getHeadersFromCookies(),
        ...headers,
      },
      signal: controller?.signal,
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop();

      events.forEach((event) => {
        if (event.startsWith("data:")) {
          const jsonString = event.replace("data:", "").trim();
          try {
            const parsed = JSON.parse(jsonString);
            onMessage(parsed);
          } catch {}
        }
      });
    }
  } catch (error) {
    if (error.name === "AbortError") {
      // console.log("Stream aborted");
    } else {
      console.error("Stream error:", error);
      onError && onError(error);
    }
  }
};

const PMAPIcallPost = async (url, reqBody, headers = {}, callback, logoutOnTokenExpiry = false) => {
  try {
    const response = await axios.post(`${pmEndpoint}${url}`, reqBody, {
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
        await PMAPIcallPost(url, reqBody, headers, callback, true);
      }
    } else {
      console.error(`POST ${url} failed:`, errorMessage);
      callback(errorMessage, status);
    }
  }
};

const PMAPIcallPatch = async (
  url,
  reqBody,
  headers = {},
  callback,
  logoutOnTokenExpiry = false,
) => {
  try {
    const response = await axios.patch(`${pmEndpoint}${url}`, reqBody, {
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
        await PMAPIcallPatch(url, reqBody, headers, callback, true);
      }
    } else {
      console.error(`PUT ${url} failed:`, errorMessage);
      callback(errorMessage, status);
    }
  }
};

const PMAPIcallPut = async (url, reqBody, headers = {}, callback, logoutOnTokenExpiry = false) => {
  try {
    const response = await axios.put(`${pmEndpoint}${url}`, reqBody, {
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
        await PMAPIcallPut(url, reqBody, headers, callback, true);
      }
    } else {
      console.error(`PUT ${url} failed:`, errorMessage);
      callback(errorMessage, status);
    }
  }
};

const PMAPIcallDelete = async (
  url,
  headers = {},
  callback,
  logoutOnTokenExpiry = false,
  data = {},
) => {
  try {
    const response = await axios.delete(`${pmEndpoint}${url}`, {
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
        await PMAPIcallDelete(url, headers, callback, true);
      }
    } else {
      console.error(`DELETE ${url} failed:`, errorMessage);
      callback(errorMessage, status);
    }
  }
};

const PMAPIcallPostFile = async (
  url,
  reqBody,
  headers = {},
  callback,
  logoutOnTokenExpiry = false,
) => {
  try {
    const response = await axios.post(`${pmEndpoint}${url}`, reqBody, {
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
        await PMAPIcallPostFile(url, reqBody, headers, callback, true);
      }
    } else {
      console.error(`POST ${url} failed:`, errorMessage);
      callback(errorMessage, status);
    }
  }
};

const PMAPIcallGetFile = async (url, headers = {}, callback, logoutOnTokenExpiry = false) => {
  try {
    const response = await axios.get(`${pmEndpoint}${url}`, {
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
        await PMAPIcallGetFile(url, headers, callback, true);
      }
    } else {
      console.error(`GET ${url} failed:`, errorMessage);
      callback(errorMessage, status);
    }
  }
};

export {
  PMAPIcallGet,
  PMAPIcallPost,
  PMAPIcallPatch,
  PMAPIcallPut,
  PMAPIcallDelete,
  PMAPIcallPostFile,
  PMAPIcallGetFile,
  PMAPIStream,
};
