import Cookies from "js-cookie";

const userInfo = import.meta.env.VITE_APP_ELM_PROFILE_TOKEN_NAME;
const userToken = import.meta.env.VITE_APP_ELM_TOKEN_NAME;
const equipFilters = "filters";
const projectFilters = "project_filters";
const spaceId = "spaceId";

const getToken = () => {
  return Cookies?.get(userToken);
};

const getUserInfo = () => {
  const userDetails = Cookies?.get(userInfo);
  return userDetails !== undefined ? JSON?.parse(userDetails) : null;
};

const removeUserInfo = () => {
  Cookies?.remove(userInfo, { path: "/" });
};
const removeUserToken = () => {
  Cookies?.remove(userToken, { path: "/" });
};

const getUserDisplayName = (profile = getUserInfo()) => {
  if (!profile) return "";
  return (
    profile.name ??
    profile.userName ??
    profile.username ??
    profile.displayName ??
    profile.employeeName ??
    profile.knoxUserId ??
    profile.mailId ??
    profile.email ??
    ""
  );
};

const getUserEmail = (profile = getUserInfo()) => {
  if (!profile) return "";
  return profile.mailId ?? profile.email ?? "";
};

export {
  getToken,
  getUserInfo,
  getUserDisplayName,
  getUserEmail,
  removeUserInfo,
  removeUserToken,
};
