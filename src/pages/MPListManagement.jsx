import React, { useMemo, useState, useEffect, useCallback } from "react";
import Modal from "../components/Modal.jsx";
import { useI18n } from "../i18n.jsx";
import { mpManagementStaticData, sampleCompareRows } from "./static-data/MPListManagementData.js";
import { isStaticDataMode, isLoadTableDataOnload } from "../utils/staticDataMode.js";
import { APIcallGet, APIcallPost, APIcallDelete } from "../axios/apiCall.js";
import { pocEndPoints } from "../axios/endPoints.js";

function formatApiDate(dateStr) {
  if (!dateStr || typeof dateStr !== "string" || dateStr.startsWith("0001-01-01")) {
    return "";
  }
  return dateStr.replace("T", " ").slice(0, 19);
}

function parseChangedDataJson(raw, defaultAppliedCount = 0, defaultNotAppliedCount = 0) {
  let list = [];
  if (Array.isArray(raw)) {
    list = raw;
  } else if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        list = parsed;
      }
    } catch (e) {
      console.warn("[MPListManagement] Failed to parse changedDataJson string:", e);
    }
  }

  return list.map((item, index) => {
    let isApplicable = item.isApplicable;
    if (isApplicable === undefined) {
      if (item.isApplied !== undefined) {
        isApplicable = item.isApplied;
      } else if (item.applied !== undefined) {
        isApplicable = item.applied;
      } else if (defaultAppliedCount > 0) {
        isApplicable = index < defaultAppliedCount;
      } else {
        isApplicable = true;
      }
    }
    return {
      ...item,
      id: item.id || item.changeHistoryId || item.mpListId || index + 1,
      isApplicable: Boolean(isApplicable),
    };
  });
}

function extractVersionListFromResponse(responseData) {
  if (!responseData) return [];

  // Handle array wrapping a response object: [ { data: { dataList: [...] } } ]
  if (Array.isArray(responseData)) {
    for (const item of responseData) {
      if (Array.isArray(item?.data?.dataList)) return item.data.dataList;
      if (Array.isArray(item?.dataList)) return item.dataList;
      if (Array.isArray(item?.data?.mpVersionList)) return item.data.mpVersionList;
      if (Array.isArray(item?.mpVersionList)) return item.mpVersionList;
      if (Array.isArray(item?.data)) return item.data;
    }
    if (
      responseData.length > 0 &&
      (responseData[0]?.versionId !== undefined ||
        responseData[0]?.changedDataJson !== undefined ||
        responseData[0]?.id !== undefined)
    ) {
      return responseData;
    }
  }

  // Handle object response: { data: { dataList: [...] } }
  if (Array.isArray(responseData?.data?.dataList)) {
    return responseData.data.dataList;
  }
  if (Array.isArray(responseData?.dataList)) {
    return responseData.dataList;
  }
  if (Array.isArray(responseData?.data?.mpVersionList)) {
    return responseData.data.mpVersionList;
  }
  if (Array.isArray(responseData?.mpVersionList)) {
    return responseData.mpVersionList;
  }
  if (Array.isArray(responseData?.data)) {
    return responseData.data;
  }

  return [];
}

function normalizeText(value) {
  return String(value ?? "").trim();
}

function getRowValue(row, ...keys) {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(row ?? {}, key)) {
      const value = row?.[key];
      if (value !== undefined && value !== null && value !== "") {
        return value;
      }
    }
  }
  return "";
}

function getDateValue(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  return parsed.toISOString().slice(0, 10);
}

function getRowKey(row, index) {
  return [
    getRowValue(row, "process", "공정"),
    getRowValue(row, "maintGroup", "보전파트", "보전그룹"),
    getRowValue(row, "workedOn", "작업완료일"),
    getRowValue(row, "representativeWork", "대표작업명", "대표 작업명"),
    index,
  ].join("::");
}

function generateExpandedApplicableRows(count) {
  const sampleItems = [
    {
      repWork: "O ring Replacement",
      purpose: "Prevent oil leakage",
      hwBefore: "Standard Rubber O-Ring",
      hwAfter: "Fluororubber O-Ring",
      swBefore: "v1.0",
      swAfter: "v1.2",
      importance: "General",
      effect: "Others",
    },
    {
      repWork: "Main Roller Bearing Cleaning",
      purpose: "Maintain rotation",
      hwBefore: "Mineral Oil",
      hwAfter: "Synthetic Grease",
      swBefore: "—",
      swAfter: "—",
      importance: "Important",
      effect: "Productivity",
    },
    {
      repWork: "Laser Sensor Alignment",
      purpose: "Ensure measurement accuracy",
      hwBefore: "Aluminum Bracket",
      hwAfter: "Invar Bracket",
      swBefore: "v2.1",
      swAfter: "v2.3",
      importance: "Important",
      effect: "Quality",
    },
    {
      repWork: "Drive Belt Tension Adjustment",
      purpose: "Prevent slipping",
      hwBefore: "Standard Belt",
      hwAfter: "Timing Belt 500-5M",
      swBefore: "—",
      swAfter: "—",
      importance: "General",
      effect: "Productivity",
    },
  ];

  return Array.from({ length: count }, (_, i) => {
    const sample = sampleItems[i % sampleItems.length];
    return {
      no: i + 1,
      repWork: i < 4 ? sample.repWork : "—",
      purpose: i < 4 ? sample.purpose : "—",
      hwBefore: i < 4 ? sample.hwBefore : "—",
      hwAfter: i < 4 ? sample.hwAfter : "—",
      swBefore: i < 4 ? sample.swBefore : "—",
      swAfter: i < 4 ? sample.swAfter : "—",
      importance: sample.importance,
      effect: sample.effect,
    };
  });
}

function generateExpandedNotApplicableRows(count) {
  const sampleItems = [
    {
      repWork: "Pneumatic Valve Seal Inspection",
      purpose: "Prevent air leak",
      hwBefore: "NBR Seal",
      hwAfter: "Viton Seal",
      swBefore: "—",
      swAfter: "—",
      importance: "General",
      effect: "Others",
      reasoning: "Importance Average",
    },
    {
      repWork: "Motor Carbon Brush Replacement",
      purpose: "Ensure electrical contact",
      hwBefore: "Grade A Brush",
      hwAfter: "Grade S Brush",
      swBefore: "—",
      swAfter: "—",
      importance: "General",
      effect: "Others",
      reasoning: "Importance Average",
    },
  ];

  return Array.from({ length: count }, (_, i) => {
    const sample = sampleItems[i % sampleItems.length];
    return {
      no: i + 1,
      repWork: i < 2 ? sample.repWork : "—",
      purpose: i < 2 ? sample.purpose : "—",
      hwBefore: i < 2 ? sample.hwBefore : "—",
      hwAfter: i < 2 ? sample.hwAfter : "—",
      swBefore: i < 2 ? sample.swBefore : "—",
      swAfter: i < 2 ? sample.swAfter : "—",
      importance: sample.importance,
      effect: sample.effect,
      reasoning: sample.reasoning,
    };
  });
}

export default function MPListManagement({ data = [], searchText = "" }) {
  const { t } = useI18n();

  // Row expansion state
  const [expandedRowIds, setExpandedRowIds] = useState(new Set(["101"]));

  const toggleExpandRow = (id) => {
    const key = String(id);
    setExpandedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Checkbox selection state (separate from row expansion)
  const [selectedRowIds, setSelectedRowIds] = useState(new Set());

  const toggleSelectRow = (id) => {
    const key = String(id);
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Compare modal states
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [compareV1, setCompareV1] = useState(null);
  const [compareV2, setCompareV2] = useState(null);



  // Edit modal states
  const [editingVersion, setEditingVersion] = useState(null);
  const [editEquipmentIds, setEditEquipmentIds] = useState([]);
  const [newEquipIdInput, setNewEquipIdInput] = useState("");
  const [editConsultations, setEditConsultations] = useState([]);
  const [newConsultDate, setNewConsultDate] = useState("2026-07-27");
  const [newConsultTitle, setNewConsultTitle] = useState("");
  const [newConsultAttendees, setNewConsultAttendees] = useState("");
  const [editApplicableRows, setEditApplicableRows] = useState([]);
  const [editNotApplicableRows, setEditNotApplicableRows] = useState([]);

  // Deletion modal state
  const [deletedRowIds, setDeletedRowIds] = useState(new Set());
  const [rowToDelete, setRowToDelete] = useState(null);

  const openEditModal = (v) => {
    setEditingVersion(v);
    setEditEquipmentIds(
      Array.isArray(v.equipmentIds) && v.equipmentIds.length > 0 && v.equipmentIds[0] !== "—"
        ? v.equipmentIds
        : [
            "E2300803",
            "E2300805",
            "E2201617",
            "E2300806",
            "E2101491",
            "E2300804",
            "E2101425",
            "E2101490",
            "E2101492",
          ],
    );
    setNewEquipIdInput("");
    setEditConsultations([]);
    setNewConsultTitle("");
    setNewConsultAttendees("");

    let appRows = [];
    let notAppRows = [];

    if (Array.isArray(v.applicableRows) && v.applicableRows.length > 0) {
      appRows = v.applicableRows;
    }
    if (Array.isArray(v.notApplicableRows) && v.notApplicableRows.length > 0) {
      notAppRows = v.notApplicableRows;
    }

    if (appRows.length === 0 && notAppRows.length === 0) {
      let rawList = [];
      if (Array.isArray(v.rows) && v.rows.length > 0) {
        rawList = v.rows;
      } else if (v.changedDataJson) {
        rawList = parseChangedDataJson(v.changedDataJson, v.appliedCount || 0, v.excludedCount || 0);
      } else if (Array.isArray(v.changeDataList) && v.changeDataList.length > 0) {
        rawList = v.changeDataList;
      }

      if (rawList.length > 0) {
        appRows = rawList.filter((r) => r.isApplicable !== false);
        notAppRows = rawList.filter((r) => r.isApplicable === false);
      } else {
        appRows = generateExpandedApplicableRows(v.appliedCount || 46);
        notAppRows = generateExpandedNotApplicableRows(v.excludedCount || 40);
      }
    }

    setEditApplicableRows(appRows);
    setEditNotApplicableRows(notAppRows);
  };

  const [apiRows, setApiRows] = useState([]);

  // Combine passed data with API data (no static fallback in dynamic mode)
  const combinedRows = useMemo(() => {
    const propRows = Array.isArray(data) ? data : [];
    if (apiRows.length > 0) {
      return [...apiRows, ...propRows];
    }
    if (isStaticDataMode) {
      return [...mpManagementStaticData, ...propRows];
    }
    return propRows;
  }, [data, apiRows]);

  const [filterPayload, setFilterPayload] = useState(null);

  useEffect(() => {
    if (!isStaticDataMode) {
      APIcallGet(`${pocEndPoints?.GET_FILTER_DATA}`, {}, (responseData, status) => {
        if (status === 200 && responseData) {
          setFilterPayload(responseData?.data || responseData);
        }
      });
    }
  }, []);

  // ── ID-based cascade filter (same as MPList.jsx) ──────────────────────────
  const processList = useMemo(() => {
    return (filterPayload?.process ?? []).filter((p) => p.isChangedData !== false);
  }, [filterPayload]);

  const [selectedProcessId, setSelectedProcessId] = useState(null);

  const maintenanceList = useMemo(() => {
    const eqTypes = filterPayload?.eqTypes;
    if (Array.isArray(eqTypes) && eqTypes.length > 0) {
      let list = eqTypes.filter((item) => item.isChangedData !== false);
      if (selectedProcessId !== null && selectedProcessId !== undefined) {
        list = list.filter((item) => Number(item.processId) === Number(selectedProcessId));
      }
      return list;
    }
    const all = (filterPayload?.maintenance ?? []).filter((m) => m.isChangedData !== false);
    if (selectedProcessId === null || selectedProcessId === undefined) return all;
    return all.filter((m) => Number(m.processId) === Number(selectedProcessId));
  }, [filterPayload, selectedProcessId]);

  const [selectedMaintenanceId, setSelectedMaintenanceId] = useState(null);

  // Reset maintenance selection when process changes (do not auto-select)
  useEffect(() => {
    setSelectedMaintenanceId(null);
  }, [selectedProcessId]);

  // Derived names for display
  const selectedProcess = processList.find((p) => p.id === selectedProcessId)?.processName || "";
  const selectedMaint =
    maintenanceList.find((m) => m.id === selectedMaintenanceId)?.equipmentTypeName ||
    maintenanceList.find((m) => m.id === selectedMaintenanceId)?.eqTypeName ||
    maintenanceList.find((m) => m.id === selectedMaintenanceId)?.maintenanceGroupName ||
    "";

  const [selectedVersion, setSelectedVersion] = useState(null);
  const [apiVersionList, setApiVersionList] = useState([]);

  const fetchMPList = useCallback((procId = 0, eqTypeId = 0) => {
    if (isStaticDataMode) return;

    const reqBody = {
      processId: Number(procId) || 0,
      equipmentTypeId: Number(eqTypeId) || 0,
      siteId: 0,
      division: 0,
      priority: [0],
      effectType: [0],
      fromDate: null,
      toDate: null,
    };

    APIcallPost(pocEndPoints.GET_MP_LIST, reqBody, {}, (responseData, status) => {
      if (status === 200 && responseData) {
        const records = extractVersionListFromResponse(responseData);
        setApiRows(records);
      }
    });
  }, []);

  const fetchMPVersion = useCallback((procId = 0, eqTypeId = 0) => {
    if (isStaticDataMode) return;

    const reqBody = {
      processId: Number(procId) || 0,
      equipmentTypeId: Number(eqTypeId) || 0,
    };

    APIcallPost(pocEndPoints.GET_MP_VERSION, reqBody, {}, (responseData, status) => {
      if (status === 200 && responseData) {
        const versions = extractVersionListFromResponse(responseData);
        setApiVersionList(versions);
      }
    });
  }, []);

  const handleCopyVersion = useCallback(
    (versionItem) => {
      const confirmMessage = t(
        "page.mpManagement.confirmCopy",
        "이 버전을 복사하여 새 버전으로 생성하시겠습니까?",
      );
      if (!window.confirm(confirmMessage)) return;

      const procId = Number(selectedProcessId) || 0;
      const eqTypeId = Number(selectedMaintenanceId) || 0;

      let rawRows = versionItem?.rows;
      if (!rawRows || !Array.isArray(rawRows) || rawRows.length === 0) {
        if (versionItem?.changedDataJson) {
          rawRows = parseChangedDataJson(
            versionItem.changedDataJson,
            versionItem.appliedCount || 0,
            versionItem.excludedCount || 0,
          );
        } else if (versionItem?.changeDataList) {
          rawRows = versionItem.changeDataList;
        } else {
          rawRows = apiRows || [];
        }
      }

      const changeDataList = (Array.isArray(rawRows) ? rawRows : []).map((r, idx) => {
        const changeHistoryId = Number(r.id || r.changeHistoryId || r.mpListId || idx + 1);
        let isApplicable = r.isApplicable;
        if (isApplicable === undefined) {
          if (r.isApplied !== undefined) isApplicable = r.isApplied;
          else if (r.applied !== undefined) isApplicable = r.applied;
          else isApplicable = true;
        }

        const reason = String(r.reason || r.unappliedReason || r.reasoning || r.memo || "");

        return {
          changeHistoryId,
          isApplicable: Boolean(isApplicable),
          reason,
        };
      });

      const payload = {
        id: 0,
        processId: procId,
        equipmentTypeId: eqTypeId,
        changeDataList,
      };

      if (isStaticDataMode) {
        alert(t("toast.copySuccess", "새 버전이 성공적으로 생성되었습니다."));
        return;
      }

      APIcallPost(pocEndPoints.SAVE_MP_VERSION, payload, {}, (responseData, status) => {
        if (status === 200 || status === 201) {
          fetchMPVersion(procId, eqTypeId);
          fetchMPList(procId, eqTypeId);
          alert(t("toast.copySuccess", "새 버전이 성공적으로 생성되었습니다."));
        } else {
          console.error("SaveMPVersion copy failed:", status, responseData);
          alert(t("toast.copyFailed", "버전 복사에 실패했습니다."));
        }
      });
    },
    [selectedProcessId, selectedMaintenanceId, apiRows, fetchMPVersion, fetchMPList, t],
  );

  useEffect(() => {
    if (!isStaticDataMode && filterPayload) {
      if (
        selectedProcessId !== null &&
        selectedMaintenanceId !== null &&
        Number(selectedProcessId) > 0 &&
        Number(selectedMaintenanceId) > 0
      ) {
        fetchMPList(selectedProcessId, selectedMaintenanceId);
        fetchMPVersion(selectedProcessId, selectedMaintenanceId);
      } else {
        setApiVersionList([]);
        setApiRows([]);
      }
    }
  }, [selectedProcessId, selectedMaintenanceId, filterPayload, fetchMPList, fetchMPVersion]);

  const filteredRows = useMemo(() => {
    const q = normalizeText(searchText).toLowerCase();
    const selProcessName = processList.find((p) => p.id === selectedProcessId)?.processName;
    const selMaintItem = maintenanceList.find((m) => m.id === selectedMaintenanceId);
    const selMaintName =
      selMaintItem?.equipmentTypeName ||
      selMaintItem?.eqTypeName ||
      selMaintItem?.maintenanceGroupName;

    return combinedRows.filter((row) => {
      const processName = normalizeText(getRowValue(row, "process", "공정"));
      const maintName = normalizeText(
        getRowValue(row, "maintGroup", "보전파트", "보전그룹", "equipmentType", "eqType"),
      );
      const combined = Object.values(row ?? {})
        .map((value) => String(value ?? ""))
        .join(" ")
        .toLowerCase();

      const matchesProcess = !selectedProcessId || processName === selProcessName;
      const matchesMaint = !selectedMaintenanceId || maintName === selMaintName;
      const matchesSearch = !q || combined.includes(q);

      return matchesProcess && matchesMaint && matchesSearch;
    });
  }, [
    combinedRows,
    searchText,
    selectedProcessId,
    selectedMaintenanceId,
    processList,
    maintenanceList,
  ]);

  const versionRows = useMemo(() => {
    if (filteredRows.length === 0) return [];

    // Group rows by version if present or create version entries
    const versions = [];
    filteredRows.forEach((row, idx) => {
      if (row.version) {
        const rawRows = row.changedDataJson || row.rows || [];
        const parsedRows = parseChangedDataJson(rawRows, row.appliedCount || 0, row.excludedCount || 0);
        const applicableRows = parsedRows.filter((r) => r.isApplicable !== false);
        const notApplicableRows = parsedRows.filter((r) => r.isApplicable === false);

        versions.push({
          id: row.id || idx,
          versionId: row.versionId || row.id || idx,
          version: row.version,
          period: row.period || "2025-07-09 ~ 2026-07-09",
          appliedCount: row.appliedCount ?? applicableRows.length,
          excludedCount: row.excludedCount ?? row.notAppliedCount ?? notApplicableRows.length,
          facilityId: row.facilityId ?? 2,
          consultation: row.consultation || "—",
          registeredBy: row.registeredBy || "admin",
          registeredAt: row.registeredAt || "2026-07-09 16:11:24",
          editedBy: row.editedBy || "admin",
          editedAt: row.editedAt || "2026-07-09 16:11:24",
          rows: parsedRows,
          applicableRows,
          notApplicableRows,
          equipmentIds: [row.facilityId ? String(row.facilityId) : "2"],
          reviewLabel: `${row.appliedCount ?? applicableRows.length} ${t("page.mpManagement.reviewCount", "건 협의 이력")}`,
        });
      }
    });

    if (versions.length > 0) return versions;

    // Fallback grouping
    const grouped = new Map();
    filteredRows.forEach((row) => {
      const date = getDateValue(getRowValue(row, "workedOn", "작업완료일"));
      const groupKey = `${selectedProcess}__${selectedMaint}__${date || "unknown"}`;
      const entry = grouped.get(groupKey) ?? {
        version: `v${grouped.size + 1}`,
        period: date || "2025-07-09 ~ 2026-07-09",
        rows: [],
        registeredBy: "admin",
        editedBy: "admin",
        registeredAt: date || "2026-07-09 16:11:24",
        editedAt: date || "2026-07-09 16:11:24",
      };

      entry.rows.push(row);
      grouped.set(groupKey, entry);
    });

    return [...grouped.values()].map((entry, index) => ({
      ...entry,
      id: index + 1,
      version: `v${index + 1}`,
      appliedCount: entry.rows.length,
      excludedCount: 0,
      facilityId: 9,
      consultation: "—",
      equipmentIds: [
        ...new Set(
          entry.rows
            .map((row) => normalizeText(getRowValue(row, "equipmentCode", "설비코드")))
            .filter(Boolean),
        ),
      ],
      reviewLabel: `${entry.rows.length} ${t("page.mpManagement.reviewCount", "건 협의 이력")}`,
    }));
  }, [filteredRows, selectedMaint, selectedProcess, t]);

  const displayVersionRows = useMemo(() => {
    let rowsToDisplay = [];
    if (apiVersionList.length > 0) {
      rowsToDisplay = apiVersionList
        .map((item, idx) => {
          const versionIdVal = item.versionId ?? item.id ?? item.mpVersionId ?? idx + 1;
          const appliedCountVal =
            item.appliedCount ?? item.applicableCount ?? item.applied_count ?? 0;
          const excludedCountVal =
            item.notAppliedCount ?? item.excludedCount ?? item.nonApplicableCount ?? item.excluded_count ?? 0;

          let rawRows = [];
          if (Array.isArray(item.changeDataList) && item.changeDataList.length > 0) {
            rawRows = item.changeDataList;
          } else if (item.changedDataJson) {
            rawRows = parseChangedDataJson(item.changedDataJson, appliedCountVal, excludedCountVal);
          } else if (Array.isArray(item.rows)) {
            rawRows = item.rows;
          } else {
            rawRows = filteredRows;
          }

          const parsedRows = parseChangedDataJson(rawRows, appliedCountVal, excludedCountVal);
          const applicableRows = parsedRows.filter((r) => r.isApplicable !== false);
          const notApplicableRows = parsedRows.filter((r) => r.isApplicable === false);

          const fromDateFormatted = formatApiDate(item.from || item.fromDate);
          const toDateFormatted = formatApiDate(item.to || item.toDate);
          const periodStr =
            item.period ||
            (fromDateFormatted && toDateFormatted
              ? `${fromDateFormatted.slice(0, 10)} ~ ${toDateFormatted.slice(0, 10)}`
              : "2025-08-07 ~ 2026-08-07");

          const regAt =
            formatApiDate(item.createdOn || item.registeredAt || item.createdAt) ||
            (item.registeredAt ?? "2026-08-07 07:41:25");
          const editAt =
            formatApiDate(item.modifiedOn || item.editedAt || item.updatedAt) || regAt;

          const regBy =
            item.createdBy !== undefined && item.createdBy !== null && item.createdBy !== 0
              ? String(item.createdBy)
              : item.registeredBy || "admin";
          const editBy =
            item.modifiedBy !== undefined && item.modifiedBy !== null && item.modifiedBy !== 0
              ? String(item.modifiedBy)
              : item.editedBy || regBy;

          const facId =
            item.facilityId ??
            (item.equipmentCount !== undefined && item.equipmentCount !== null
              ? item.equipmentCount
              : item.equipmentId ?? 0);

          return {
            id: versionIdVal,
            versionId: versionIdVal,
            version: item.versionName || item.version || `v${versionIdVal}`,
            period: periodStr,
            appliedCount: item.appliedCount ?? applicableRows.length,
            excludedCount: item.notAppliedCount ?? item.excludedCount ?? notApplicableRows.length,
            facilityId: facId,
            consultation: item.consultation ?? item.agreements ?? "—",
            registeredBy: regBy,
            registeredAt: regAt,
            editedBy: editBy,
            editedAt: editAt,
            rows: parsedRows,
            applicableRows,
            notApplicableRows,
            equipmentIds: [
              item.facilityId
                ? String(item.facilityId)
                : item.equipmentCount
                  ? String(item.equipmentCount)
                  : "—",
            ],
            reviewLabel: `${item.appliedCount ?? applicableRows.length} ${t("page.mpManagement.reviewCount", "건 협의 이력")}`,
          };
        })
        .filter((v) => !deletedRowIds.has(String(v.id || v.versionId || v.version)));
    } else {
      rowsToDisplay = versionRows.filter((v) => !deletedRowIds.has(String(v.id || v.version)));
    }

    const parseNum = (str, fallbackId) => {
      const match = String(str || "").match(/\d+/);
      if (match) return parseInt(match[0], 10);
      if (fallbackId && !isNaN(Number(fallbackId))) return Number(fallbackId);
      return 0;
    };

    return [...rowsToDisplay].sort((a, b) => {
      const numA = parseNum(a.version, a.versionId || a.id);
      const numB = parseNum(b.version, b.versionId || b.id);
      if (numA !== numB) return numB - numA;

      const dateA = new Date(a.registeredAt || a.editedAt || 0).getTime();
      const dateB = new Date(b.registeredAt || b.editedAt || 0).getTime();
      if (!isNaN(dateA) && !isNaN(dateB) && dateA !== dateB) {
        return dateB - dateA;
      }

      return Number(b.id || 0) - Number(a.id || 0);
    });
  }, [apiVersionList, versionRows, filteredRows, deletedRowIds, t]);

  const toggleSelectAll = () => {
    const top2Keys = displayVersionRows.slice(0, 2).map((v) => String(v.id || v.version));
    const isTop2Selected =
      top2Keys.length > 0 &&
      top2Keys.every((k) => selectedRowIds.has(k)) &&
      selectedRowIds.size === top2Keys.length;

    if (isTop2Selected) {
      setSelectedRowIds(new Set());
    } else {
      setSelectedRowIds(new Set(top2Keys));
    }
  };

  useEffect(() => {
    if (displayVersionRows.length > 0 && selectedRowIds.size === 0) {
      const top2Keys = displayVersionRows.slice(0, 2).map((v) => String(v.id || v.version));
      setSelectedRowIds(new Set(top2Keys));
    }
  }, [displayVersionRows]);

  const dynamicCompareData = useMemo(() => {
    if (!compareV1 || !compareV2) {
      return {
        v1Version: "v1",
        v2Version: "v2",
        v1Applied: 0,
        v1Excluded: 0,
        v1Total: 0,
        v2Applied: 0,
        v2Excluded: 0,
        v2Total: 0,
        rows: [],
      };
    }

    const rows1 = Array.isArray(compareV1.rows)
      ? compareV1.rows
      : Array.isArray(compareV1.applicableRows) || Array.isArray(compareV1.notApplicableRows)
        ? [...(compareV1.applicableRows || []), ...(compareV1.notApplicableRows || [])]
        : [];
    const rows2 = Array.isArray(compareV2.rows)
      ? compareV2.rows
      : Array.isArray(compareV2.applicableRows) || Array.isArray(compareV2.notApplicableRows)
        ? [...(compareV2.applicableRows || []), ...(compareV2.notApplicableRows || [])]
        : [];

    const getWorkName = (r) =>
      getRowValue(
        r,
        "representativeWork",
        "representative_work_name",
        "repWork",
        "work",
        "equipmentName",
      ) || "";

    const map1 = new Map();
    rows1.forEach((r) => {
      const name = getWorkName(r);
      if (name) map1.set(name.trim().toLowerCase(), r);
    });

    const map2 = new Map();
    rows2.forEach((r) => {
      const name = getWorkName(r);
      if (name) map2.set(name.trim().toLowerCase(), r);
    });

    const allKeys = new Set([...map1.keys(), ...map2.keys()]);
    const comparedRows = [];

    allKeys.forEach((key) => {
      const r1 = map1.get(key);
      const r2 = map2.get(key);
      const ref = r1 || r2;
      if (!ref) return;

      const repWork = getWorkName(ref);
      const purpose = getRowValue(ref, "purpose", "work") || "—";
      const problem = getRowValue(ref, "situation", "report", "problem") || "—";
      const cause = getRowValue(ref, "cause") || "—";
      const bom = getRowValue(ref, "bom", "BOM") || "—";
      const materialName = getRowValue(ref, "sparePart", "materialName", "material") || "—";
      const hwBefore = getRowValue(ref, "hwAsWas", "hwBefore") || "—";
      const importance = getRowValue(ref, "priority", "priorityName") || "일반";
      const effect = getRowValue(ref, "category", "categoryName") || "보전성";

      const v1Status = r1 ? (r1.isApplicable !== false ? "Applied" : "Not applied") : "Not applied";
      const v2Status = r2 ? (r2.isApplicable !== false ? "Applied" : "Not applied") : "Not applied";

      comparedRows.push({
        repWork,
        purpose,
        problem,
        cause,
        bom,
        materialName,
        hwBefore,
        importance,
        effect,
        v1Status,
        v2Status,
      });
    });

    const finalRows = comparedRows.length > 0 ? comparedRows : sampleCompareRows;

    const v1Applied = compareV1.appliedCount ?? rows1.filter((r) => r.isApplicable !== false).length;
    const v1Excluded = compareV1.excludedCount ?? rows1.filter((r) => r.isApplicable === false).length;
    const v2Applied = compareV2.appliedCount ?? rows2.filter((r) => r.isApplicable !== false).length;
    const v2Excluded = compareV2.excludedCount ?? rows2.filter((r) => r.isApplicable === false).length;

    return {
      v1Version: compareV1.version || "v1",
      v2Version: compareV2.version || "v2",
      v1Applied,
      v1Excluded,
      v1Total: v1Applied + v1Excluded,
      v2Applied,
      v2Excluded,
      v2Total: v2Applied + v2Excluded,
      rows: finalRows,
    };
  }, [compareV1, compareV2]);

  const showLanding = selectedProcessId === null || selectedMaintenanceId === null;

  return (
    <section className="flex flex-col h-full overflow-hidden space-y-4">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2.5">
            <i className="fas fa-list-check text-[#1745c2] text-xl md:text-[22px]" />
            <span>{t("page.mpManagement.title", "MP List Management")}</span>
          </h1>
          <p className="page-subtitle">
            {t(
              "page.mpManagement.desc",
              "Manage the stored MP lists for each process and maintenance part by version",
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {(() => {
            const selectedArray = displayVersionRows.filter((v) =>
              selectedRowIds.has(String(v.id || v.version)),
            );
            const v1 = selectedArray[0] || displayVersionRows[0];
            const v2 = selectedArray[1] || displayVersionRows[1];
            if (v1 && v2) {
              return (
                <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                  {v1.version} vs {v2.version} 비교
                </span>
              );
            }
            return null;
          })()}
          <button
            type="button"
            className="bg-[#1745c2] hover:bg-[#1239a5] text-white font-bold text-xs px-4 py-2 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer h-[38px]"
            onClick={() => {
              const selectedArray = displayVersionRows.filter((v) =>
                selectedRowIds.has(String(v.id || v.version)),
              );
              let v1 = selectedArray[0];
              let v2 = selectedArray[1];
              if (!v1) v1 = displayVersionRows[0] || { version: "v1", appliedCount: 46, excludedCount: 40 };
              if (!v2) v2 = displayVersionRows[1] || displayVersionRows[0] || { version: "v2", appliedCount: 20, excludedCount: 21 };
              setCompareV1(v1);
              setCompareV2(v2);
              setShowCompareModal(true);
            }}
          >
            <i className="fas fa-sync-alt text-xs" />
            <span>{t("page.mpManagement.compare", "MP Comparison")}</span>
          </button>
        </div>
      </div>

      {/* Filter Card */}
      <div className="mgmt-surface flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl shadow-xs">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-text-subtlest">
              {t("field.process", "Process")}
            </label>
            <select
              className="input-base text-xs font-semibold"
              style={{ width: 160, height: 38 }}
              value={selectedProcessId ?? ""}
              onChange={(event) => {
                const val = event.target.value;
                setSelectedProcessId(val === "" ? null : Number(val));
                setSelectedMaintenanceId(null);
              }}
            >
              <option value="">{t("app.choose", "Choose")}</option>
              {processList.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.processName}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-text-subtlest">
              {t("field.equipmentType", "Equipment Type")}
            </label>
            <select
              className="input-base text-xs font-semibold"
              style={{ width: 240, height: 38 }}
              value={selectedMaintenanceId ?? ""}
              onChange={(event) => {
                const val = event.target.value;
                setSelectedMaintenanceId(val === "" ? null : Number(val));
              }}
              disabled={selectedProcessId === null}
            >
              <option value="">{t("app.choose", "Choose")}</option>
              {maintenanceList.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.equipmentTypeName ||
                    item.eqTypeName ||
                    item.maintenanceGroupName ||
                    String(item.id)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Version Table / Landing state */}
      {showLanding ? (
        <div className="mgmt-surface flex flex-1 items-center justify-center rounded-2xl p-8">
          <div className="flex flex-col items-center px-6 py-10 text-center">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-900/30 text-4xl text-blue-600">
              <i className="fas fa-list-check" />
            </div>
            <h3 className="text-lg font-bold text-text-default">
              {t("page.mpManagement.emptyTitle", "Select process and equipment type")}
            </h3>
            <p className="mt-2 max-w-md text-sm text-text-subtle whitespace-pre-line">
              {t(
                "page.mpManagement.emptyDesc",
                "When you select Process and Equipment Type in the filter,\na list of saved MP List versions will be displayed.",
              )}
            </p>
          </div>
        </div>
      ) : (
        <div className="card mgmt-surface flex-1 min-h-0 flex flex-col overflow-hidden rounded-2xl shadow-xs">
          <div className="flex-1 overflow-auto custom-scrollbar">
            <table
              className="mgmt-table w-full text-left text-xs"
              style={{ borderCollapse: "separate", borderSpacing: 0 }}
            >
              <thead className="sticky top-0 z-30 text-[10px] font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3.5 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={(() => {
                        const top2Keys = displayVersionRows.slice(0, 2).map((v) => String(v.id || v.version));
                        return (
                          top2Keys.length > 0 &&
                          top2Keys.every((k) => selectedRowIds.has(k)) &&
                          selectedRowIds.size === top2Keys.length
                        );
                      })()}
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                  </th>
                  <th className="px-4 py-3.5 w-24">{t("page.mpManagement.headerVersion", "VERSION")}</th>
                  <th className="px-4 py-3.5">{t("page.mpManagement.headerPeriod", "PERIOD")}</th>
                  <th className="px-4 py-3.5 text-center">{t("page.mpManagement.headerApplication", "APPLICATION")}</th>
                  <th className="px-4 py-3.5 text-center">{t("page.mpManagement.headerNotApplied", "NOT APPLIED")}</th>
                  <th className="px-4 py-3.5 text-center">{t("page.mpManagement.headerFacilityId", "FACILITY ID")}</th>
                  <th className="px-4 py-3.5 text-center">{t("page.mpManagement.headerConsultation", "CONSULTATION")}</th>
                  <th className="px-4 py-3.5">{t("page.mpManagement.headerRegistrant", "REGISTRANT")}</th>
                  <th className="px-4 py-3.5">{t("page.mpManagement.headerRegistrationDate", "REGISTRATION DATE AND TIME")}</th>
                  <th className="px-4 py-3.5">{t("page.mpManagement.headerEditor", "EDITOR")}</th>
                  <th className="px-4 py-3.5">{t("page.mpManagement.headerEditingDate", "EDITING DATE AND TIME")}</th>
                  <th className="px-4 py-3.5 w-24 text-center">{t("page.mpManagement.headerActions", "ACTIONS")}</th>
                </tr>
              </thead>
              <tbody className="font-medium">
                {displayVersionRows.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="px-4 py-16 text-center text-text-subtle">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <i className="fas fa-inbox text-3xl text-gray-300 dark:text-gray-600 mb-1" />
                        <span className="text-sm font-semibold text-text-subtle">
                          {t("app.noDataAvailable", "No data available")}
                        </span>
                        <p className="text-xs text-text-subtlest">
                          {t(
                            "page.mpManagement.noDataDesc",
                            "There are no MP List records matching the selected process and equipment type.",
                          )}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  displayVersionRows.map((v) => {
                  const rowId = String(v.id || v.version);
                  const isExpanded = expandedRowIds.has(rowId);
                  const isChecked = selectedRowIds.has(rowId);

                  return (
                    <React.Fragment key={rowId}>
                      <tr
                        onClick={() => toggleExpandRow(rowId)}
                        className={`transition-colors cursor-pointer select-none ${isExpanded ? "bg-surface-brand" : ""}`}
                      >
                        <td
                          className="px-4 py-3.5 text-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSelectRow(rowId)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1.5 cursor-pointer">
                            <span className="badge badge-primary">{v.version}</span>
                            <i
                              className={`fas fa-chevron-${isExpanded ? "down" : "right"} text-[10px] text-gray-400`}
                            />
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-text-default font-semibold">{v.period}</td>
                        <td className="px-4 py-3.5 text-center">
                          <span className="badge badge-success">{v.appliedCount} cases</span>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span className="badge badge-danger">{v.excludedCount} cases</span>
                        </td>
                        <td className="px-4 py-3.5 text-center text-text-default">
                          {v.facilityId ?? 9}
                        </td>
                        <td className="px-4 py-3.5 text-center text-gray-400">
                          {v.consultation || "—"}
                        </td>
                        <td className="px-4 py-3.5 text-text-default">
                          {v.registeredBy || "admin"}
                        </td>
                        <td className="px-4 py-3.5 text-text-subtle">{v.registeredAt}</td>
                        <td className="px-4 py-3.5 text-text-default">{v.editedBy || "admin"}</td>
                        <td className="px-4 py-3.5 text-text-subtle">{v.editedAt}</td>
                        <td
                          className="px-4 py-3.5 text-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-center gap-2.5">
                            <button
                              type="button"
                              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 p-1 cursor-pointer transition-colors"
                              title={t("app.copy", "복사")}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopyVersion(v);
                              }}
                            >
                              <i className="fas fa-copy text-xs" />
                            </button>
                            <button
                              type="button"
                              className="text-gray-700 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400 p-1 cursor-pointer transition-colors"
                              title={t("app.edit", "편집")}
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditModal(v);
                              }}
                            >
                              <i className="fas fa-pen text-xs" />
                            </button>
                            <button
                              type="button"
                              className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-1 cursor-pointer transition-colors"
                              title={t("app.delete", "삭제")}
                              onClick={(e) => {
                                e.stopPropagation();
                                setRowToDelete(v);
                              }}
                            >
                              <i className="fas fa-trash-alt text-xs" />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Accordion Expanded Detail Row */}
                      {isExpanded && (
                        <tr
                          className="expanded-detail-row bg-surface-strong"
                          onClick={(e) => e.stopPropagation()}
                          onMouseEnter={(e) => e.stopPropagation()}
                          onMouseOver={(e) => e.stopPropagation()}
                        >
                          <td
                            colSpan={12}
                            className="px-6 py-4"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="space-y-6">
                              {/* Section 1: Applicable Items */}
                              <div>
                                <div className="flex items-center gap-2 mb-2.5">
                                  <i className="fas fa-check-circle text-emerald-500 text-xs" />
                                  <span className="text-xs font-bold text-text-default">
                                    {t("page.mpManagement.applicableItemsTitle", "Applicable Items")} ({v.appliedCount ?? 0} {t("page.mpManagement.itemsSuffix", "items")})
                                  </span>
                                </div>
                                <div className="mgmt-surface rounded-xl overflow-hidden shadow-2xs">
                                  <div className="max-h-72 overflow-y-auto custom-scrollbar">
                                    <table
                                      className="mgmt-table mgmt-nested-table w-full text-left text-xs"
                                      style={{ borderCollapse: "separate", borderSpacing: 0 }}
                                    >
                                      <thead className="sticky top-0 uppercase text-[9px] font-bold tracking-wider z-20 shadow-2xs">
                                        <tr>
                                          <th className="px-3 py-2 w-10 text-center">#</th>
                                          <th className="px-3 py-2">{t("page.mpManagement.headerRepWork", "REPRESENTATIVE WORK NAME")}</th>
                                          <th className="px-3 py-2">{t("page.mpManagement.headerPurpose", "PURPOSE OF THE WORK")}</th>
                                          <th className="px-3 py-2">
                                            {t("page.mpManagement.headerHwBefore", "BEFORE CHANGING THE HARDWARE")}
                                          </th>
                                          <th className="px-3 py-2">{t("page.mpManagement.headerHwAfter", "AFTER CHANGING THE HARDWARE")}</th>
                                          <th className="px-3 py-2">{t("page.mpManagement.headerSwBefore", "BEFORE SOFTWARE CHANGE")}</th>
                                          <th className="px-3 py-2">{t("page.mpManagement.headerSwAfter", "AFTER THE SOFTWARE CHANGE")}</th>
                                          <th className="px-3 py-2 text-center">{t("page.mpManagement.headerImportance", "IMPORTANCE")}</th>
                                          <th className="px-3 py-2 text-center">{t("page.mpManagement.headerEffectType", "TYPES OF EFFECT")}</th>
                                        </tr>
                                      </thead>
                                      <tbody className="font-normal text-text-subtle">
                                        {(Array.isArray(v.rows)
                                          ? v.rows.filter((r) => r.isApplicable !== false)
                                          : []
                                        ).map((item, idx) => {
                                          const repWorkVal =
                                            getRowValue(
                                              item,
                                              "representativeWork",
                                              "representative_work_name",
                                              "repWork",
                                            ) || "—";
                                          const purposeVal = getRowValue(item, "purpose", "work") || "—";
                                          const hwBeforeVal = getRowValue(item, "hwAsWas", "hwBefore") || "—";
                                          const hwAfterVal = getRowValue(item, "hwAsIs", "hwAfter") || "—";
                                          const swBeforeVal = getRowValue(item, "swAsWas", "swBefore") || "—";
                                          const swAfterVal = getRowValue(item, "swAsIs", "swAfter") || "—";
                                          const priorityVal =
                                            getRowValue(item, "priority", "priorityName") || "—";
                                          const categoryVal =
                                            getRowValue(item, "category", "categoryName") || "—";

                                          return (
                                            <tr
                                              key={`app-${item.changeHistoryId || item.id || idx}`}
                                              className="transition-colors border-b border-border-base/50"
                                            >
                                              <td className="px-3 py-2 text-center text-text-subtlest font-medium">
                                                {idx + 1}
                                              </td>
                                              <td
                                                className="px-3 py-2 font-semibold text-text-default max-w-[200px] truncate overflow-hidden text-ellipsis whitespace-nowrap"
                                                title={repWorkVal}
                                              >
                                                {repWorkVal}
                                              </td>
                                              <td
                                                className="px-3 py-2 max-w-[220px] truncate overflow-hidden text-ellipsis whitespace-nowrap"
                                                title={purposeVal}
                                              >
                                                {purposeVal}
                                              </td>
                                              <td
                                                className="px-3 py-2 max-w-[220px] truncate overflow-hidden text-ellipsis whitespace-nowrap"
                                                title={hwBeforeVal}
                                              >
                                                {hwBeforeVal}
                                              </td>
                                              <td
                                                className="px-3 py-2 max-w-[220px] truncate overflow-hidden text-ellipsis whitespace-nowrap"
                                                title={hwAfterVal}
                                              >
                                                {hwAfterVal}
                                              </td>
                                              <td
                                                className="px-3 py-2 max-w-[180px] truncate overflow-hidden text-ellipsis whitespace-nowrap"
                                                title={swBeforeVal}
                                              >
                                                {swBeforeVal}
                                              </td>
                                              <td
                                                className="px-3 py-2 max-w-[180px] truncate overflow-hidden text-ellipsis whitespace-nowrap"
                                                title={swAfterVal}
                                              >
                                                {swAfterVal}
                                              </td>
                                              <td className="px-3 py-2 text-center">
                                                <span
                                                  className={`px-2.5 py-0.5 text-xs font-semibold rounded-full inline-block ${
                                                    priorityVal === "중요" || priorityVal === "Important"
                                                      ? "bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400 border border-blue-200 dark:border-blue-800"
                                                      : "bg-white text-gray-700 dark:bg-gray-800 dark:text-gray-300 border border-gray-200 dark:border-gray-700 shadow-2xs"
                                                  }`}
                                                  title={priorityVal}
                                                >
                                                  {priorityVal}
                                                </span>
                                              </td>
                                              <td className="px-3 py-2 text-center">
                                                <span
                                                  className="px-2.5 py-0.5 text-xs font-medium rounded-full inline-block bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 shadow-2xs"
                                                  title={categoryVal}
                                                >
                                                  {categoryVal}
                                                </span>
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </div>

                              {/* Section 2: Not Applicable Items */}
                              <div>
                                <div className="flex items-center gap-2 mb-2.5">
                                  <i className="fas fa-times-circle text-red-500 text-xs" />
                                  <span className="text-xs font-bold text-text-default">
                                    {t("page.mpManagement.notApplicableItemsTitle", "Not Applicable Items")} ({v.excludedCount ?? 0} {t("page.mpManagement.itemsSuffix", "items")})
                                  </span>
                                </div>
                                <div className="mgmt-surface border border-red-200 rounded-xl overflow-hidden shadow-2xs">
                                  <div className="max-h-72 overflow-y-auto custom-scrollbar">
                                    <table
                                      className="mgmt-table mgmt-not-applied-table w-full text-left text-xs"
                                      style={{ borderCollapse: "separate", borderSpacing: 0 }}
                                    >
                                      <thead className="sticky top-0 uppercase text-[9px] font-bold tracking-wider z-20 shadow-2xs">
                                        <tr>
                                          <th className="px-3 py-2 w-10 text-center">#</th>
                                          <th className="px-3 py-2">{t("page.mpManagement.headerRepWork", "REPRESENTATIVE WORK NAME")}</th>
                                          <th className="px-3 py-2">{t("page.mpManagement.headerPurpose", "PURPOSE OF THE WORK")}</th>
                                          <th className="px-3 py-2">
                                            {t("page.mpManagement.headerHwBefore", "BEFORE CHANGING THE HARDWARE")}
                                          </th>
                                          <th className="px-3 py-2">{t("page.mpManagement.headerHwAfter", "AFTER CHANGING THE HARDWARE")}</th>
                                          <th className="px-3 py-2">{t("page.mpManagement.headerSwBefore", "BEFORE SOFTWARE CHANGE")}</th>
                                          <th className="px-3 py-2">{t("page.mpManagement.headerSwAfter", "AFTER THE SOFTWARE CHANGE")}</th>
                                          <th className="px-3 py-2 text-center">{t("page.mpManagement.headerImportance", "IMPORTANCE")}</th>
                                          <th className="px-3 py-2 text-center">{t("page.mpManagement.headerEffectType", "TYPES OF EFFECT")}</th>
                                          <th className="px-3 py-2">{t("page.mpManagement.headerReasoning", "REASONING")}</th>
                                        </tr>
                                      </thead>
                                      <tbody className="font-normal text-text-subtle">
                                        {(Array.isArray(v.rows)
                                          ? v.rows.filter((r) => r.isApplicable === false)
                                          : []
                                        ).map((item, idx) => {
                                          const repWorkVal =
                                            getRowValue(
                                              item,
                                              "representativeWork",
                                              "representative_work_name",
                                              "repWork",
                                            ) || "—";
                                          const purposeVal = getRowValue(item, "purpose", "work") || "—";
                                          const hwBeforeVal = getRowValue(item, "hwAsWas", "hwBefore") || "—";
                                          const hwAfterVal = getRowValue(item, "hwAsIs", "hwAfter") || "—";
                                          const swBeforeVal = getRowValue(item, "swAsWas", "swBefore") || "—";
                                          const swAfterVal = getRowValue(item, "swAsIs", "swAfter") || "—";
                                          const priorityVal =
                                            getRowValue(item, "priority", "priorityName") || "—";
                                          const categoryVal =
                                            getRowValue(item, "category", "categoryName") || "—";
                                          const reasonVal =
                                            getRowValue(item, "reason", "reasoning", "nonImplReason") || "";

                                          return (
                                            <tr
                                              key={`not-${item.changeHistoryId || item.id || idx}`}
                                              className="transition-colors border-b border-border-base/50"
                                            >
                                              <td className="px-3 py-2 text-center text-text-subtlest font-medium">
                                                {idx + 1}
                                              </td>
                                              <td
                                                className="px-3 py-2 font-semibold text-text-default max-w-[200px] truncate overflow-hidden text-ellipsis whitespace-nowrap"
                                                title={repWorkVal}
                                              >
                                                {repWorkVal}
                                              </td>
                                              <td
                                                className="px-3 py-2 max-w-[220px] truncate overflow-hidden text-ellipsis whitespace-nowrap"
                                                title={purposeVal}
                                              >
                                                {purposeVal}
                                              </td>
                                              <td
                                                className="px-3 py-2 max-w-[220px] truncate overflow-hidden text-ellipsis whitespace-nowrap"
                                                title={hwBeforeVal}
                                              >
                                                {hwBeforeVal}
                                              </td>
                                              <td
                                                className="px-3 py-2 max-w-[220px] truncate overflow-hidden text-ellipsis whitespace-nowrap"
                                                title={hwAfterVal}
                                              >
                                                {hwAfterVal}
                                              </td>
                                              <td
                                                className="px-3 py-2 max-w-[180px] truncate overflow-hidden text-ellipsis whitespace-nowrap"
                                                title={swBeforeVal}
                                              >
                                                {swBeforeVal}
                                              </td>
                                              <td
                                                className="px-3 py-2 max-w-[180px] truncate overflow-hidden text-ellipsis whitespace-nowrap"
                                                title={swAfterVal}
                                              >
                                                {swAfterVal}
                                              </td>
                                              <td className="px-3 py-2 text-center">
                                                <span
                                                  className={`px-2.5 py-0.5 text-xs font-semibold rounded-full inline-block ${
                                                    priorityVal === "중요" || priorityVal === "Important"
                                                      ? "bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400 border border-blue-200 dark:border-blue-800"
                                                      : "bg-white text-gray-700 dark:bg-gray-800 dark:text-gray-300 border border-gray-200 dark:border-gray-700 shadow-2xs"
                                                  }`}
                                                  title={priorityVal}
                                                >
                                                  {priorityVal}
                                                </span>
                                              </td>
                                              <td className="px-3 py-2 text-center">
                                                <span
                                                  className="px-2.5 py-0.5 text-xs font-medium rounded-full inline-block bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 shadow-2xs"
                                                  title={categoryVal}
                                                >
                                                  {categoryVal}
                                                </span>
                                              </td>
                                              <td
                                                className="px-3 py-2 max-w-[200px] truncate overflow-hidden text-ellipsis whitespace-nowrap font-semibold text-red-500"
                                                title={reasonVal || "—"}
                                              >
                                                {reasonVal || "—"}
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </div>

                              {/* Section 3: Row Metadata Summary Footer */}
                              <div className="pt-4 border-t border-border-base text-xs space-y-2">
                                {/* Line 1: Equipment ID */}
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-text-default flex items-center gap-1.5">
                                    <i className="fas fa-microchip text-gray-500 text-xs" />
                                    {t("field.equipmentId", "설비ID")}
                                  </span>
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    {Array.isArray(v.equipmentIds) && v.equipmentIds.length > 0 ? (
                                      v.equipmentIds.map((eqId, i) => (
                                        <span
                                          key={i}
                                          className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800"
                                        >
                                          {eqId}
                                        </span>
                                      ))
                                    ) : v.facilityId ? (
                                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                                        {String(v.facilityId)}
                                      </span>
                                    ) : (
                                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                                        A0912004
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Line 2: Registrant & Editor Info */}
                                <div className="flex flex-wrap items-center gap-6 text-xs text-text-subtle">
                                  <span className="flex items-center gap-1.5">
                                    <i className="fas fa-user-plus text-gray-500 text-[11px]" />
                                    <span className="font-medium text-text-subtle">
                                      {t("page.mpManagement.registeredByLabel", "등록")}:
                                    </span>
                                    <span className="font-medium text-text-default">
                                      {v.registeredBy || "admin"}
                                    </span>
                                    <span className="text-text-subtle">{v.registeredAt || "2026-08-11 23:48:50"}</span>
                                  </span>
                                  <span className="flex items-center gap-1.5">
                                    <i className="fas fa-user-edit text-gray-500 text-[11px]" />
                                    <span className="font-medium text-text-subtle">
                                      {t("page.mpManagement.editedByLabel", "편집")}:
                                    </span>
                                    <span className="font-medium text-text-default">
                                      {v.editedBy || "admin"}
                                    </span>
                                    <span className="text-text-subtle">{v.editedAt || "2026-08-12 12:17:12"}</span>
                                  </span>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                }))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        open={Boolean(selectedVersion)}
        onClose={() => setSelectedVersion(null)}
        title={t("page.mp.title", "MP List 조회")}
        description={`${selectedProcess} · ${selectedMaint}`}
        maxWidth="1100px"
        footer={
          <button
            type="button"
            className="btn-base bg-brand-60 text-white hover:bg-brand-70"
            onClick={() => setSelectedVersion(null)}
          >
            {t("app.close", "닫기")}
          </button>
        }
      >
        {selectedVersion && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="badge badge-primary">{selectedVersion.version}</span>
              <span className="text-sm text-text-subtle">
                {t("field.period", "기간")}: {selectedVersion.period}
              </span>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-border-base bg-surface-strong p-3">
                <div className="text-xs font-bold uppercase text-text-subtle">
                  {t("field.equipmentId", "설비 ID")}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedVersion.equipmentIds.length ? (
                    selectedVersion.equipmentIds.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-brand-10 px-3 py-1 text-xs font-semibold text-brand-60"
                      >
                        {tag}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-text-subtle">-</span>
                  )}
                </div>
              </div>
              <div className="rounded-xl border border-border-base bg-surface-strong p-3">
                <div className="text-xs font-bold uppercase text-text-subtle">
                  {t("page.mpManagement.reviewHistory", "협의 이력")}
                </div>
                <div className="mt-2 text-sm text-text-default">{selectedVersion.reviewLabel}</div>
              </div>
            </div>

            <div className="rounded-xl border border-border-base bg-surface-default">
              <table className="data-table" style={{ tableLayout: "fixed", width: "100%" }}>
                <thead>
                  <tr>
                    <th>{t("field.repWork", "대표 작업명")}</th>
                    <th>{t("field.work", "작업 목적")}</th>
                    <th>{t("field.hwBefore", "HW 변경 전")}</th>
                    <th>{t("field.hwAfter", "HW 변경 후")}</th>
                    <th>{t("field.swBefore", "SW 변경 전")}</th>
                    <th>{t("field.swAfter", "SW 변경 후")}</th>
                    <th>{t("field.workedOn", "작업완료일")}</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedVersion.rows.map((row, index) => (
                    <tr key={getRowKey(row, index)}>
                      <td>
                        {normalizeText(
                          getRowValue(row, "representativeWork", "대표작업명", "대표 작업명"),
                        ) || "-"}
                      </td>
                      <td>{normalizeText(getRowValue(row, "work", "작업목적")) || "-"}</td>
                      <td>{normalizeText(getRowValue(row, "hwAsWas", "HW 변경 전")) || "-"}</td>
                      <td>{normalizeText(getRowValue(row, "hwAsIs", "HW 변경 후")) || "-"}</td>
                      <td>{normalizeText(getRowValue(row, "swAsWas", "SW 변경 전")) || "-"}</td>
                      <td>{normalizeText(getRowValue(row, "swAsIs", "SW 변경 후")) || "-"}</td>
                      <td>{getDateValue(getRowValue(row, "workedOn", "작업완료일")) || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>

      {/* ── MP Comparison Modal ── */}
      {showCompareModal && (
        <div
          className="modal-overlay animate-fade-in overflow-y-auto"
          onClick={() => setShowCompareModal(false)}
        >
          <div
            className="modal-panel modal-panel-3xl relative my-6 flex flex-col animate-scale-up !w-[94vw] !max-w-[1480px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header shrink-0">
              <div className="flex items-start gap-3 min-w-0">
                <div className="modal-icon-wrap">
                  <i className="fas fa-right-left text-sm" />
                </div>
                <div className="min-w-0">
                  <h3 className="modal-title">
                    {dynamicCompareData.v1Version} vs {dynamicCompareData.v2Version} comparison
                  </h3>
                  <p className="modal-description">
                    {t("page.mpManagement.compareDesc", "Compare the two versions of MP List")}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn shrink-0"
                onClick={() => setShowCompareModal(false)}
              >
                <i className="fas fa-times text-xs" />
              </button>
            </div>

            <div className="modal-body space-y-6">
              {/* Top Version Comparison Summary Card */}
              <div className="bg-surface-strong rounded-2xl p-5 flex items-center justify-between mb-6 border border-border-base">
                <div className="flex-1 text-center">
                  <div className="text-xs font-semibold text-text-subtlest">
                    {dynamicCompareData.v1Version}
                  </div>
                  <div className="text-2xl font-extrabold text-text-default my-1">
                    {dynamicCompareData.v1Total} cases
                  </div>
                  <div className="text-xs font-medium text-text-subtlest">
                    Applied / {dynamicCompareData.v1Excluded} cases Not applied
                  </div>
                </div>

                <div className="px-6 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <i className="fas fa-right-left text-lg font-bold" />
                </div>

                <div className="flex-1 text-center">
                  <div className="text-xs font-semibold text-text-subtlest">
                    {dynamicCompareData.v2Version}
                  </div>
                  <div className="text-2xl font-extrabold text-text-default my-1">
                    {dynamicCompareData.v2Total} cases
                  </div>
                  <div className="text-xs font-medium text-text-subtlest">
                    Applied / {dynamicCompareData.v2Excluded} cases Not applied
                  </div>
                </div>
              </div>

              {/* Detailed Comparison Table */}
              <div className="border border-border-base rounded-2xl overflow-hidden bg-surface-default shadow-2xs">
                <div className="overflow-x-auto max-h-80 custom-scrollbar">
                  <table
                    className="w-full text-left text-xs"
                    style={{ borderCollapse: "separate", borderSpacing: 0 }}
                  >
                    <thead className="sticky top-0 bg-gray-50/90 dark:bg-gray-700/80 text-gray-400 dark:text-gray-300 uppercase text-[10px] font-bold tracking-wider z-10 border-b border-border-base">
                      <tr>
                        <th className="px-3 py-3 font-bold">{t("page.mpManagement.headerRepWork", "REPRESENTATIVE WORK NAME")}</th>
                        <th className="px-3 py-3 font-bold">{t("page.mpManagement.headerPurpose", "PURPOSE OF THE WORK")}</th>
                        <th className="px-3 py-3 font-bold">{t("field.situation", "PROBLEM PHENOMENON")}</th>
                        <th className="px-3 py-3 font-bold">{t("field.cause", "CAUSE OF THE ISSUE")}</th>
                        <th className="px-3 py-3 font-bold">BOM</th>
                        <th className="px-3 py-3 font-bold">{t("field.materialName", "MATERIAL NAME")}</th>
                        <th className="px-3 py-3 font-bold">{t("page.mpManagement.headerHwBefore", "BEFORE CHANGING HARDWARE")}</th>
                        <th className="px-3 py-3 font-bold text-center">{t("page.mpManagement.headerImportance", "IMPORTANCE")}</th>
                        <th className="px-3 py-3 font-bold text-center">{t("page.mpManagement.headerEffectType", "EFFECT")}</th>
                        <th className="px-3 py-3 font-bold text-center uppercase">
                          {dynamicCompareData.v1Version}
                        </th>
                        <th className="px-3 py-3 font-bold text-center uppercase">
                          {dynamicCompareData.v2Version}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="font-medium">
                      {dynamicCompareData.rows.map((row, idx) => (
                        <tr
                          key={idx}
                          className="hover:bg-blue-50/20 dark:hover:bg-blue-900/10 transition-colors"
                        >
                          <td className="px-3 py-2.5 text-gray-900 dark:text-white font-semibold max-w-[140px] truncate">
                            {row.repWork}
                          </td>
                          <td className="px-3 py-2.5 text-text-subtle max-w-[130px] truncate">
                            {row.purpose}
                          </td>
                          <td className="px-3 py-2.5 text-text-subtlest max-w-[130px] truncate">
                            {row.problem}
                          </td>
                          <td className="px-3 py-2.5 text-text-subtlest max-w-[130px] truncate">
                            {row.cause}
                          </td>
                          <td className="px-3 py-2.5 text-text-subtle">{row.bom}</td>
                          <td className="px-3 py-2.5 text-text-subtle max-w-[120px] truncate">
                            {row.materialName}
                          </td>
                          <td className="px-3 py-2.5 text-text-subtle max-w-[120px] truncate">
                            {row.hwBefore}
                          </td>
                          <td className="px-3 py-2.5 text-center text-text-subtle">
                            {row.importance}
                          </td>
                          <td className="px-3 py-2.5 text-center text-text-subtle">{row.effect}</td>
                          <td className="px-3 py-2.5 text-center">
                            <span
                              className={`px-2 py-0.5 text-[10px] font-bold rounded-md ${
                                row.v1Status === "Applied"
                                  ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400 border border-emerald-100"
                                  : "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
                              }`}
                            >
                              {row.v1Status === "Applied" ? t("page.mp.applied", "Applied") : t("page.mp.notApplied", "Not applied")}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <span
                              className={`px-2 py-0.5 text-[10px] font-bold rounded-md ${
                                row.v2Status === "Applied"
                                  ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400 border border-emerald-100"
                                  : "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
                              }`}
                            >
                              {row.v2Status === "Applied" ? t("page.mp.applied", "Applied") : t("page.mp.notApplied", "Not applied")}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="modal-footer justify-center shrink-0">
              <button
                type="button"
                className="modal-cancel-btn"
                onClick={() => setShowCompareModal(false)}
              >
                {t("app.close", "Close")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MP List Inquiry / Edit Modal ── */}
      {editingVersion && (
        <div
          className="modal-overlay animate-fade-in overflow-y-auto"
          onClick={() => setEditingVersion(null)}
        >
          <div
            className="modal-panel modal-panel-3xl relative my-6 max-h-[92vh] flex flex-col animate-scale-up !w-[94vw] !max-w-[1480px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="modal-icon-wrap">
                  <i className="fas fa-edit text-sm" />
                </div>
                <div className="flex items-center gap-2 min-w-0">
                  <h3 className="modal-title">
                    {t("page.mp.inquiryModalTitle", "MP List Inquiry")}
                  </h3>
                  <span className="badge badge-primary">{editingVersion.version || "v1"}</span>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn shrink-0"
                onClick={() => setEditingVersion(null)}
              >
                <i className="fas fa-times text-xs" />
              </button>
            </div>

            <div className="modal-body flex-1 overflow-y-auto space-y-6 custom-scrollbar">
              {/* Section 1: Equipment ID Tags & Add */}
              <div>
                <label className="modal-field-label">
                  {t("field.equipmentId", "Equipment ID")}
                </label>
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  {editEquipmentIds.map((tag, idx) => (
                    <span
                      key={`tag-${idx}`}
                      className="badge badge-primary inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full"
                    >
                      <span>{tag}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setEditEquipmentIds(editEquipmentIds.filter((_, i) => i !== idx))
                        }
                        className="w-3.5 h-3.5 rounded-full hover:bg-brand-10 flex items-center justify-center text-[10px] cursor-pointer transition-colors"
                      >
                        <i className="fas fa-times" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-2 max-w-xs">
                  <input
                    type="text"
                    placeholder={t("page.mp.addFacilityId", "Facility ID added")}
                    value={newEquipIdInput}
                    onChange={(e) => setNewEquipIdInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newEquipIdInput.trim()) {
                        e.preventDefault();
                        setEditEquipmentIds([...editEquipmentIds, newEquipIdInput.trim()]);
                        setNewEquipIdInput("");
                      }
                    }}
                    className="modal-input text-xs flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newEquipIdInput.trim()) {
                        setEditEquipmentIds([...editEquipmentIds, newEquipIdInput.trim()]);
                        setNewEquipIdInput("");
                      }
                    }}
                    className="btn-base btn-secondary !w-8 !h-8 !p-0 flex items-center justify-center shrink-0"
                  >
                    <i className="fas fa-plus text-xs" />
                  </button>
                </div>
              </div>

              {/* Section 2: Additional Consultation */}
              <div className="modal-section">
                <h4 className="modal-field-label mb-3">
                  {t("page.mp.additionalConsultation", "Additional Consultation")}
                </h4>
                <div className="flex flex-wrap md:flex-nowrap gap-3 items-end">
                  <div className="w-full md:w-44 shrink-0">
                    <label className="modal-field-label !text-[10px] !mb-1 whitespace-nowrap">Date</label>
                    <input
                      type="date"
                      value={newConsultDate}
                      onChange={(e) => setNewConsultDate(e.target.value)}
                      className="modal-input text-xs w-full"
                    />
                  </div>
                  <div className="w-full md:flex-1 min-w-[200px]">
                    <label className="modal-field-label !text-[10px] !mb-1 whitespace-nowrap">Title</label>
                    <input
                      type="text"
                      placeholder="Consultation Title"
                      value={newConsultTitle}
                      onChange={(e) => setNewConsultTitle(e.target.value)}
                      className="modal-input text-xs w-full"
                    />
                  </div>
                  <div className="w-full md:flex-1 min-w-[240px]">
                    <label className="modal-field-label !text-[10px] !mb-1 whitespace-nowrap">
                      Attendees (comma separation)
                    </label>
                    <input
                      type="text"
                      placeholder="Hong Gil-dong, Yi Sun-sin"
                      value={newConsultAttendees}
                      onChange={(e) => setNewConsultAttendees(e.target.value)}
                      className="modal-input text-xs w-full"
                    />
                  </div>
                  <div className="shrink-0 pb-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        if (newConsultTitle.trim()) {
                          setEditConsultations([
                            ...editConsultations,
                            {
                              date: newConsultDate,
                              title: newConsultTitle.trim(),
                              attendees: newConsultAttendees.trim(),
                            },
                          ]);
                          setNewConsultTitle("");
                          setNewConsultAttendees("");
                        }
                      }}
                      className="btn-base btn-secondary !w-9 !h-9 !p-0 flex items-center justify-center shrink-0"
                    >
                      <i className="fas fa-plus text-xs" />
                    </button>
                  </div>
                </div>

                {/* Consultation List */}
                {editConsultations.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {editConsultations.map((c, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-2.5 rounded-xl border border-border-base bg-surface-default text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-brand-60">{c.date}</span>
                          <span className="font-semibold text-text-default">{c.title}</span>
                          <span className="text-text-subtlest">
                            ({c.attendees || "No attendees"})
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setEditConsultations(editConsultations.filter((_, idx) => idx !== i))
                          }
                          className="text-text-subtlest hover:text-red-500 cursor-pointer"
                        >
                          <i className="fas fa-times text-xs" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Section 3: Applicable Items */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <h4 className="text-sm font-bold text-text-default">
                    {t("page.mp.applicableItems", "Applicable Items")}
                  </h4>
                  <span className="badge badge-success">
                    {editApplicableRows.length} {t("app.cases", "cases")}
                  </span>
                </div>

                <div className="mgmt-surface rounded-xl overflow-hidden shadow-2xs border-l-4 border-l-emerald-500">
                  <div className="max-h-60 overflow-y-auto custom-scrollbar">
                    <table
                      className="mgmt-table mgmt-nested-table w-full text-left text-xs"
                      style={{ borderCollapse: "separate", borderSpacing: 0 }}
                    >
                      <thead className="sticky top-0 uppercase text-[9px] font-bold tracking-wider z-20 shadow-2xs">
                        <tr>
                          <th className="px-3 py-2.5 w-8 text-center">#</th>
                          <th className="px-3 py-2.5">
                            {t("field.repWork", "REPRESENTATIVE WORK NAME")}
                          </th>
                          <th className="px-3 py-2.5">
                            {t("field.purpose", "PURPOSE OF THE WORK")}
                          </th>
                          <th className="px-3 py-2.5">
                            {t("field.hwBefore", "BEFORE CHANGING THE HARDWARE")}
                          </th>
                          <th className="px-3 py-2.5">
                            {t("field.hwAfter", "AFTER CHANGING THE HARDWARE")}
                          </th>
                          <th className="px-3 py-2.5">
                            {t("field.swBefore", "BEFORE SOFTWARE CHANGE")}
                          </th>
                          <th className="px-3 py-2.5">
                            {t("field.swAfter", "AFTER THE SOFTWARE CHANGE")}
                          </th>
                          <th className="px-3 py-2.5 w-24 text-center">
                            {t("field.priority", "IMPORTANCE")}
                          </th>
                          <th className="px-3 py-2.5 w-24 text-center">
                            {t("field.category", "TYPES OF EFFECT")}
                          </th>
                          <th className="px-3 py-2.5 w-12 text-center"></th>
                        </tr>
                      </thead>
                      <tbody className="font-normal text-text-subtle">
                        {editApplicableRows.map((row, idx) => (
                          <tr key={`edit-app-${idx}`} className="transition-colors">
                            <td className="px-3 py-2 text-center text-text-subtlest font-medium">
                              {idx + 1}
                            </td>
                            <td className="px-3 py-2 font-semibold text-text-default max-w-[150px] truncate">
                              {getRowValue(row, "representativeWork", "equipmentName", "repWork", "work") || "—"}
                            </td>
                            <td className="px-3 py-2 max-w-[140px] truncate">
                              {getRowValue(row, "purpose", "work") || "—"}
                            </td>
                            <td className="px-3 py-2 max-w-[130px] truncate">
                              {getRowValue(row, "hwAsWas", "hwBefore") || "—"}
                            </td>
                            <td className="px-3 py-2 max-w-[130px] truncate">
                              {getRowValue(row, "hwAsIs", "hwAfter") || "—"}
                            </td>
                            <td className="px-3 py-2 max-w-[120px] truncate">
                              {getRowValue(row, "swAsWas", "swBefore") || "—"}
                            </td>
                            <td className="px-3 py-2 max-w-[120px] truncate">
                              {getRowValue(row, "swAsIs", "swAfter") || "—"}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <span className="px-2 py-0.5 text-[10px] font-medium text-text-subtle bg-surface-strong rounded-md">
                                {getRowValue(row, "priority", "priorityName", "importance") || "General"}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-center">
                              <span className="px-2 py-0.5 text-[10px] font-medium text-text-subtle bg-surface-strong rounded-md">
                                {getRowValue(row, "category", "categoryName", "effect") || "Others"}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-center">
                              <button
                                type="button"
                                title="Move to Not Applicable"
                                onClick={() => {
                                  setEditApplicableRows(
                                    editApplicableRows.filter((_, i) => i !== idx),
                                  );
                                  setEditNotApplicableRows([
                                    ...editNotApplicableRows,
                                    { ...row, reasoning: "Importance Average" },
                                  ]);
                                }}
                                className="w-6 h-6 rounded-md border border-border-base bg-surface-strong text-text-subtle hover:bg-fill-active flex items-center justify-center cursor-pointer transition-colors"
                              >
                                <i className="fas fa-arrow-down text-[10px]" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Section 4: Not Applicable */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <h4 className="text-sm font-bold text-red-600">
                    {t("page.mp.notApplicable", "Not Applicable")}
                  </h4>
                  <span className="badge badge-danger">
                    {editNotApplicableRows.length} {t("app.cases", "cases")}
                  </span>
                </div>
                <div className="mgmt-surface border border-red-200 rounded-xl overflow-hidden shadow-2xs border-l-4 border-l-red-500">
                  <div className="max-h-60 overflow-y-auto custom-scrollbar">
                    <table
                      className="mgmt-table mgmt-not-applied-table w-full text-left text-xs"
                      style={{ borderCollapse: "separate", borderSpacing: 0 }}
                    >
                      <thead className="sticky top-0 uppercase text-[9px] font-bold tracking-wider z-20 shadow-2xs">
                        <tr>
                          <th className="px-3 py-2.5 w-8 text-center">#</th>
                          <th className="px-3 py-2.5">
                            {t("field.repWork", "REPRESENTATIVE WORK NAME")}
                          </th>
                          <th className="px-3 py-2.5">
                            {t("field.purpose", "PURPOSE OF THE WORK")}
                          </th>
                          <th className="px-3 py-2.5">
                            {t("field.hwBefore", "BEFORE CHANGING THE HARDWARE")}
                          </th>
                          <th className="px-3 py-2.5">
                            {t("field.hwAfter", "AFTER CHANGING THE HARDWARE")}
                          </th>
                          <th className="px-3 py-2.5">
                            {t("field.swBefore", "BEFORE SOFTWARE CHANGE")}
                          </th>
                          <th className="px-3 py-2.5">
                            {t("field.swAfter", "AFTER THE SOFTWARE CHANGE")}
                          </th>
                          <th className="px-3 py-2.5 w-20 text-center">
                            {t("field.priority", "IMPORTANCE")}
                          </th>
                          <th className="px-3 py-2.5 w-20 text-center">
                            {t("field.category", "TYPES OF EFFECT")}
                          </th>
                          <th className="px-3 py-2.5">{t("field.nonImplReason", "REASONING")}</th>
                          <th className="px-3 py-2.5 w-12 text-center"></th>
                        </tr>
                      </thead>
                      <tbody className="font-normal text-text-subtle">
                        {editNotApplicableRows.map((row, idx) => (
                          <tr key={`edit-not-${idx}`} className="transition-colors">
                            <td className="px-3 py-2 text-center text-text-subtlest font-medium">
                              {idx + 1}
                            </td>
                            <td className="px-3 py-2 font-semibold text-text-default max-w-[130px] truncate">
                              {getRowValue(row, "representativeWork", "equipmentName", "repWork", "work") || "—"}
                            </td>
                            <td className="px-3 py-2 max-w-[120px] truncate">
                              {getRowValue(row, "purpose", "work") || "—"}
                            </td>
                            <td className="px-3 py-2 max-w-[110px] truncate">
                              {getRowValue(row, "hwAsWas", "hwBefore") || "—"}
                            </td>
                            <td className="px-3 py-2 max-w-[110px] truncate">
                              {getRowValue(row, "hwAsIs", "hwAfter") || "—"}
                            </td>
                            <td className="px-3 py-2 max-w-[100px] truncate">
                              {getRowValue(row, "swAsWas", "swBefore") || "—"}
                            </td>
                            <td className="px-3 py-2 max-w-[100px] truncate">
                              {getRowValue(row, "swAsIs", "swAfter") || "—"}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <span className="px-2 py-0.5 text-[10px] font-medium text-text-subtle bg-surface-strong rounded-md">
                                {getRowValue(row, "priority", "priorityName", "importance") || "General"}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-center">
                              <span className="px-2 py-0.5 text-[10px] font-medium text-text-subtle bg-surface-strong rounded-md">
                                {getRowValue(row, "category", "categoryName", "effect") || "Others"}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              <textarea
                                rows={2}
                                value={getRowValue(row, "reason", "reasoning", "nonImplReason") || ""}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setEditNotApplicableRows(
                                    editNotApplicableRows.map((r, i) =>
                                      i === idx ? { ...r, reasoning: val, reason: val, nonImplReason: val } : r,
                                    ),
                                  );
                                }}
                                className="w-full min-w-[180px] p-2 text-xs border border-red-300 rounded-xl bg-surface-default text-red-600 font-semibold focus:outline-none focus:ring-1 focus:ring-red-400 shadow-2xs resize-y"
                              />
                            </td>
                            <td className="px-3 py-2 text-center">
                              <button
                                type="button"
                                title="Restore to Applicable"
                                onClick={() => {
                                  setEditNotApplicableRows(
                                    editNotApplicableRows.filter((_, i) => i !== idx),
                                  );
                                  setEditApplicableRows([...editApplicableRows, row]);
                                }}
                                className="w-6 h-6 rounded-md border border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 flex items-center justify-center cursor-pointer transition-colors"
                              >
                                <i className="fas fa-arrow-up text-[10px]" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer shrink-0">
              <button
                type="button"
                className="modal-cancel-btn"
                onClick={() => setEditingVersion(null)}
              >
                {t("app.cancellation", "cancellation")}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!editingVersion) return;
                  const versionId = Number(
                    editingVersion.id ||
                      editingVersion.mpVersionId ||
                      editingVersion.versionId ||
                      0,
                  );

                  const changeDataList = [
                    ...editApplicableRows.map((r) => ({
                      changeHistoryId: Number(r.id || r.changeHistoryId || r.mpListId || 0),
                      isApplicable: true,
                      reason: "",
                    })),
                    ...editNotApplicableRows.map((r) => ({
                      changeHistoryId: Number(r.id || r.changeHistoryId || r.mpListId || 0),
                      isApplicable: false,
                      reason: r.reasoning || r.nonImplReason || r.reason || "",
                    })),
                  ];

                  const equipmentIds = editEquipmentIds
                    .map((id) => Number(id) || 0)
                    .filter((id) => id > 0);

                  const actionItems = editConsultations.map((c) => ({
                    date: c.date ? new Date(c.date).toISOString() : new Date().toISOString(),
                    title: c.title || "",
                    attendees: c.attendees || "",
                  }));

                  const reqPayload = {
                    versionId,
                    changeDataList,
                    equipmentIds,
                    actionItems,
                  };

                  if (isStaticDataMode) {
                    setEditingVersion(null);
                    return;
                  }

                  APIcallPost(
                    pocEndPoints.EDIT_MP_VERSION,
                    reqPayload,
                    {},
                    (responseData, status) => {
                      if (status >= 200 && status < 300) {
                        setEditingVersion(null);
                        fetchMPVersion(selectedProcessId ?? 0, selectedMaintenanceId ?? 0);
                        fetchMPList(selectedProcessId ?? 0, selectedMaintenanceId ?? 0);
                      } else {
                        console.error("EditMPVersion failed:", status, responseData);
                      }
                    },
                  );
                }}
                className="btn-base btn-primary text-xs px-8 py-2.5 rounded-xl flex items-center gap-2 cursor-pointer"
              >
                <i className="fas fa-check text-xs" />
                <span>{t("app.save", "Save")}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ── */}
      {rowToDelete && (
        <div className="modal-overlay animate-fade-in" onClick={() => setRowToDelete(null)}>
          <div
            className="modal-panel modal-panel-sm relative animate-scale-up w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header shrink-0">
              <div className="flex items-start gap-3 min-w-0 mx-auto">
                <div className="modal-icon-wrap !bg-red-50 !text-red-500">
                  <i className="fas fa-trash-alt text-sm" />
                </div>
                <div className="min-w-0 text-left">
                  <h3 className="modal-title">
                    {t("page.mp.deleteModalTitle", "Delete Confirmation")}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn shrink-0"
                onClick={() => setRowToDelete(null)}
              >
                <i className="fas fa-times text-xs" />
              </button>
            </div>

            <div className="modal-body text-center">
              <p className="text-xs text-text-subtlest leading-relaxed">
                {t("page.mp.deleteModalDesc", "Are you sure you want to delete version")}{" "}
                <strong className="text-text-default">({rowToDelete.version})</strong>
                ?
                <br />
                {t("page.mp.deleteWarning", "This action cannot be undone.")}
              </p>
            </div>

            <div className="modal-footer shrink-0">
              <button
                type="button"
                className="modal-cancel-btn flex-1 py-2.5"
                onClick={() => setRowToDelete(null)}
              >
                {t("app.cancellation", "Cancel")}
              </button>
              <button
                type="button"
                className="btn-base flex-1 py-2.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-md transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                onClick={() => {
                  if (!rowToDelete) return;
                  const targetId = Number(
                    rowToDelete.id || rowToDelete.mpVersionId || rowToDelete.versionId || 0,
                  );
                  const key = String(targetId || rowToDelete.version || "");

                  if (key) {
                    setDeletedRowIds((prev) => new Set([...prev, key]));
                  }

                  if (isStaticDataMode || !targetId || targetId <= 0) {
                    setRowToDelete(null);
                    return;
                  }

                  const url = `${pocEndPoints.DELETE_MP_LIST_ITEM}/${targetId}`;
                  APIcallDelete(url, {}, (responseData, status) => {
                    setRowToDelete(null);
                    if (status >= 200 && status < 300) {
                      fetchMPVersion(selectedProcessId ?? 0, selectedMaintenanceId ?? 0);
                      fetchMPList(selectedProcessId ?? 0, selectedMaintenanceId ?? 0);
                    } else {
                      console.error("DeleteMpListItem failed:", status, responseData);
                    }
                  });
                }}
              >
                <i className="fas fa-trash-alt text-xs" />
                <span>{t("app.delete", "Delete")}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
