const redirection = {
  ELM_DASHBOARD: "/",
};

const pocEndPoints = {
  UPLOAD_EXCEL: "api/Excel/Upload",
  GET_FILTER_DATA: "api/ChangeData/GetChangedData",
  CHANGE_DATA_COLUMNS: "api/CommonData/GetAllChangeDataColumns",
  SAVE_DATA_CHANGES: "api/ChangeData",
  GET_SPEC_DATA: "api/SpecData/GetSpecData",
  SAVE_SPEC_DATA: "api/SpecData",
  UPDATE_REPRESENTATIVE_WORK: "api/CommonData/UpdateRepresentativeWork",
};

const auth = {
  LOGOUT: "api/Login/Logout",
  SSO_LOGIN: "api/Login/SSOLogin",
  REFRESH_TOKEN: "api/Login/RefreshToken",
};
export { redirection, pocEndPoints, auth };
