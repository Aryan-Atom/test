const redirection = {
  ELM_DASHBOARD: "/",
};

const aiPipelineServer = (
  import.meta.env.VITE_APP_AI_POC_PIPELINE_SERVER || ""
).replace(/\/+$/, "");

const pocEndPoints = {
  UPLOAD_EXCEL: "api/Excel/Upload",
  GET_FILTER_DATA: "api/ChangeData/GetMasterData",
  GET_MASTER_DATA: "api/ChangeData/GetMasterData",
  GET_CHANGED_DATA: "api/ChangeData/GetChangedData",
  CHANGE_DATA_COLUMNS: "api/CommonData/GetAllChangeDataColumns",
  SAVE_DATA_CHANGES: "api/ChangeData/SaveChangedData",
  DELETE_CHANGE_DATA: "api/ChangeData/DeleteChangeData",
  GET_MATRIX_DATA: "api/MatrixInquiry/GetMatrixData",
  GET_CHANGE_MATRIX: "api/MatrixInquiry/GetChangeMatrix",
  GET_SPEC_DATA: "api/SpecData/GetSpecData",
  SAVE_SPEC_DATA: "api/SpecData",
  UPDATE_REPRESENTATIVE_WORK: "api/CommonData/UpdateRepresentativeWork",
  RESET_DATA: "api/CommonData/ResetData",
  GET_COMMON_DATA_COUNTS: "api/CommonData/GetCommonDataCounts",
  GET_MP_LIST: "api/MPData/GetMPList",
  GET_MP_VERSION: "api/MPData/GetMPVersion",
  SAVE_MP_VERSION: "api/MPData/SaveMPVersion",
  EDIT_MP_VERSION: "api/MPData/EditMPVersion",
  DELETE_MP_LIST_ITEM: "api/MPData/DeleteMpListItem",
  GET_MP_ROW_VERSION_DATA: "api/MPData/GetMPRowVersionData",
  SAVE_VOC: "api/ChangeData/SaveVoc",
  CHANGE_HISTORY_DATA: "data-management/change-history-data",
  GET_EQUIPMENT_STATUS: "api/MatrixInquiry/GetequipmentStatus",
  GET_EQUIPMENT_STATUS_COUNT: "api/MatrixInquiry/GetequipmentStatusCount",
  SAVE_MATRIX_INQUIRY: "api/MatrixInquiry/Save",
  SAVE_IMAGE: "api/MatrixInquiry/SaveImage",
  EXPORT_ZIP: "api/ChangeData/ExportZip",
  AI_PIPELINE_UPLOAD: `${aiPipelineServer}/api/uploads/auto`,
  AI_PIPELINE_GET_JOBS: `${aiPipelineServer}/api/jobs?limit=50`,
};

const auth = {
  LOGOUT: "api/Login/Logout",
  SSO_LOGIN: "api/Login/SSOLogin",
  REFRESH_TOKEN: "api/Login/RefreshToken",
};
export { redirection, pocEndPoints, auth };
