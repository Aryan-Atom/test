import axios from "axios";
import Cookies from "js-cookie";
import { auth } from "../axios/endPoints.js";

const COOKIE_REMOVE_OPTIONS = { path: "/" };

export function clearAllAuthCookies() {
  const {
    VITE_APP_ELM_PROFILE_TOKEN_NAME,
    VITE_APP_ELM_TOKEN_NAME,
    VITE_APP_ELM_AUTH_TOKEN,
    VITE_APP_ELM_REFRESH_TOKEN,
  } = import.meta.env;

  [
    VITE_APP_ELM_PROFILE_TOKEN_NAME,
    VITE_APP_ELM_TOKEN_NAME,
    VITE_APP_ELM_AUTH_TOKEN,
    VITE_APP_ELM_REFRESH_TOKEN,
  ]
    .filter(Boolean)
    .forEach((cookieName) => {
      Cookies.remove(cookieName, COOKIE_REMOVE_OPTIONS);
    });
}

export async function performLogout() {
  const { VITE_APP_ELM_API_SERVER, VITE_APP_ELM_AUTH_TOKEN } = import.meta.env;
  const authToken = Cookies.get(VITE_APP_ELM_AUTH_TOKEN);

  if (authToken && VITE_APP_ELM_API_SERVER) {
    const baseUrl = VITE_APP_ELM_API_SERVER.endsWith("/")
      ? VITE_APP_ELM_API_SERVER
      : `${VITE_APP_ELM_API_SERVER}/`;

    try {
      await axios.post(
        `${baseUrl}${auth.LOGOUT}`,
        {},
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
        },
      );
    } catch {
      // Continue with local cookie cleanup even if the server logout fails.
    }
  }

  clearAllAuthCookies();
  window.location.href = "/";
}
