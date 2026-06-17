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
  Cookies?.remove(userInfo);
};
const removeUserToken = () => {
  Cookies?.remove(userToken);
};

export { getToken, getUserInfo, removeUserInfo, removeUserToken };
