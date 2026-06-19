import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { APIcallGet, APIcallPost } from "../axios/apiCall";
import { pocEndPoints } from "../axios/endPoints";
import { useI18n } from "../i18n.jsx";
import { isStaticDataMode } from "../utils/staticDataMode.js";
import { changeFilterDataAndTableData } from "./static-data/ChangeHistoryData.js";

// Reusable MultiSelect Dropdown Component with Checkboxes
function MultiSelect({ options, selectedValues, onChange, placeholder, t, disabled }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleToggleOption = (value) => {
    if (disabled) return;
    let next;
    if (selectedValues.includes(value)) {
      next = selectedValues.filter((v) => v !== value);
    } else {
      next = [...selectedValues, value];
    }
    onChange(next);
  };

  const isAllSelected = selectedValues.length === options.length || selectedValues.length === 0;

  let displayText = placeholder || t("app.all", "전체");
  if (!isAllSelected) {
    if (selectedValues.length === 1) {
      displayText = selectedValues[0];
    } else {
      displayText = `${selectedValues.length}${t("app.selectedCount", "개 선택")}`;
    }
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        disabled={disabled}
        className="input-base flex w-full items-center justify-between text-left font-semibold text-text-default"
        style={{
          height: "38px",
          cursor: disabled ? "not-allowed" : "pointer",
          background: disabled ? "var(--surface-strong, #f8f9fb)" : "var(--surface-default, #ffffff)",
          opacity: disabled ? 0.6 : 1,
          border: "1px solid var(--border-base, #e6e9ef)",
          borderRadius: "10px",
          padding: "8px 14px",
          width: "100%",
          textAlign: "left",
          marginTop: "0px"
        }}
      >
        <span className="truncate">{displayText}</span>
        <i
          className={`fas fa-chevron-down text-[10px] text-text-subtle transition-transform duration-200 ${
            isOpen && !disabled ? "rotate-180" : ""
          }`}
          style={{ marginLeft: "8px" }}
        />
      </button>

      {isOpen && !disabled && (
        <div
          className="absolute left-0 right-0 z-[100] mt-1 max-h-[220px] overflow-y-auto rounded-lg border border-border-base bg-surface-default py-1 shadow-lg"
          style={{
            borderColor: "var(--border-base, #e6e9ef)",
            backgroundColor: "var(--surface-default, #ffffff)"
          }}
        >
          {options.map((opt) => {
            const isChecked = selectedValues.includes(opt.value);
            return (
              <label
                key={opt.value}
                className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-text-default hover:bg-surface-strong cursor-pointer"
                style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 12px", cursor: "pointer" }}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  disabled={disabled}
                  onChange={() => handleToggleOption(opt.value)}
                  className="rounded border-border-base text-brand-60 focus:ring-brand-50"
                  style={{ accentColor: "var(--brand-60, #0f62fe)", cursor: disabled ? "not-allowed" : "pointer" }}
                />
                <span className="truncate" style={{ fontSize: "13px" }}>{opt.label}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

function excelSerialToDate(serial) {
  if (serial === null || serial === undefined || serial === "") return "";
  if (typeof serial === "string" && serial.includes("-")) return serial;
  const num = Number(serial);
  if (isNaN(num) || num <= 0) return "";
  const ms = Math.round((num - 25569) * 86400 * 1000);
  const date = new Date(ms);
  if (isNaN(date.getTime())) return "";
  return date.toISOString().split("T")[0];
}

function getFormattedDateString(raw) {
  if (!raw) return "";
  const dateStr = excelSerialToDate(raw);
  if (!dateStr) return "";
  return dateStr.slice(0, 10);
}

function normalizeName(value) {
  return String(value ?? "").trim().toLowerCase();
}

function hexToRgba(hex, alpha = 0.14) {
  const value = String(hex ?? "").trim();
  const match = value.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!match) return `rgba(15, 98, 254, ${alpha})`;
  const [, r, g, b] = match;
  return `rgba(${parseInt(r, 16)}, ${parseInt(g, 16)}, ${parseInt(b, 16)}, ${alpha})`;
}

function getContrastColor(hex) {
  const value = String(hex ?? "").trim();
  const match = value.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!match) return "#0f62fe";
  const [, r, g, b] = match.map((part) => parseInt(part, 16));
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.58 ? "#111827" : "#ffffff";
}

function getColValue(row, col) {
  if (!row) return "";
  if (col === "representativeWork") {
    return row.representativeWork ?? row["대표작업명"] ?? row["대표 작업명"] ?? row["ëŒ€í‘œì ‘ì—…ëª…"] ?? row["ëŒ€í‘œ ì ‘ì—…ëª…"] ?? "";
  }
  if (col === "work") {
    return row.work ?? row.purpose ?? row["작업 목적"] ?? row["작업목적"] ?? "";
  }
  if (col === "situation") {
    return row.situation ?? row["문제 현상"] ?? "";
  }
  if (col === "cause") {
    return row.cause ?? row["문제 원인"] ?? "";
  }
  if (col === "bom") {
    return row.bom ?? row["BOM"] ?? "";
  }
  if (col === "sparePart") {
    return row.sparePart ?? row["자재명"] ?? "";
  }
  if (col === "hwAsWas") {
    return row.hwAsWas ?? row.hwBefore ?? row["HW 변경 전"] ?? "";
  }
  if (col === "hwAsIs") {
    return row.hwAsIs ?? row.hwAfter ?? row["HW 변경 후"] ?? "";
  }
  if (col === "swAsWas") {
    return row.swAsWas ?? row.swBefore ?? row["SW 변경 전"] ?? "";
  }
  if (col === "swAsIs") {
    return row.swAsIs ?? row.swAfter ?? row["SW 변경 후"] ?? "";
  }
  if (col === "priority") {
    return row.priority ?? row["중요도"] ?? row["ì¤‘ìš”ë „"] ?? "";
  }
  if (col === "category") {
    return row.category ?? row["효과 유형"] ?? row["효과유형"] ?? row["íš¨ê³¼ ìœ í˜•"] ?? row["íš¨ê³¼ìœ í˜•"] ?? "";
  }
  if (col === "wOCode") {
    return row.wOCode ?? row.woCode ?? row["W/O코드"] ?? "";
  }
  if (col === "workedOn") {
    return row.workedOn ?? row["작업완료일"] ?? "";
  }
  if (col === "process") {
    return row.process ?? row["공정"] ?? row["ê³µì •"] ?? "";
  }
  if (col === "maintGroup") {
    return row.maintGroup ?? row["보전파트"] ?? row["보전그룹"] ?? row["유지보수 그룹"] ?? row["유지보수그룹"] ?? row.equipment ?? row["ë³´ì „íŒŒíŠ¸"] ?? row["ë³´ì „ê·¸ë£¹"] ?? row["ìœ ì§€ë³´ìˆ˜ ê·¸ë£¹"] ?? "";
  }
  if (col === "site") {
    return row.site ?? row["법인"] ?? row["사이트"] ?? "";
  }
  if (col === "equipmentCode") {
    return row.equipmentCode ?? row["설비코드"] ?? "";
  }
  if (col === "equipmentName") {
    return row.equipmentName ?? row["설비명"] ?? "";
  }
  return row[col] ?? "";
}

export default function Matrix({ data, onOpenDetail, onUpload, searchText }) {
  const { t } = useI18n();
  const [mode, setMode] = useState("date");
  const [filterData, setFilterData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Filters State
  const [selectedProcess, setSelectedProcess] = useState("전체");
  const [selectedMaintenance, setSelectedMaintenance] = useState("전체");
  const [selectedSite, setSelectedSite] = useState("전체");
  const [selectedRepWork, setSelectedRepWork] = useState("전체");
  const [selectedPriorities, setSelectedPriorities] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [hoveredEquipmentKey, setHoveredEquipmentKey] = useState(null);

  // Records State
  const [allRecords, setAllRecords] = useState([]);
  const [changedDataId, setChangedDataId] = useState(0);

  // Find & Replace Modal State
  const [showReplaceModal, setShowReplaceModal] = useState(false);
  const [replaceTargetTask, setReplaceTargetTask] = useState("");
  const [replaceTargetTasksList, setReplaceTargetTasksList] = useState([]);
  const [newRepresentativeWork, setNewRepresentativeWork] = useState("");
  const [newPriority, setNewPriority] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [replacing, setReplacing] = useState(false);
  const [clickedRecord, setClickedRecord] = useState(null);

  const getFilterData = useCallback(() => {
    if (isStaticDataMode) {
      try {
        const payload = changeFilterDataAndTableData;
        const parsedChanges = (payload?.changedDataJson ?? []).flatMap((item) => {
          try {
            return typeof item.content === "string" ? JSON.parse(item.content) : item.content;
          } catch {
            return [];
          }
        });
        setAllRecords(parsedChanges);
        if (Array.isArray(payload?.changedDataJson) && payload.changedDataJson.length > 0) {
          setChangedDataId(payload.changedDataJson[0].id ?? 0);
        } else {
          setChangedDataId(0);
        }
        setFilterData(changeFilterDataAndTableData);
      } catch (e) {
        console.error("Matrix static data load error:", e);
      } finally {
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    APIcallGet(`${pocEndPoints?.GET_FILTER_DATA}`, {}, (responseData, status) => {
      try {
        if (status === 200 && responseData) {
          const raw = responseData?.data ?? responseData;
          const parsedChanges = (raw.changedDataJson ?? []).flatMap((item) => {
            try {
              return typeof item.content === "string" ? JSON.parse(item.content) : item.content;
            } catch {
              return [];
            }
          });
          setAllRecords(parsedChanges);
          if (Array.isArray(raw.changedDataJson) && raw.changedDataJson.length > 0) {
            setChangedDataId(raw.changedDataJson[0].id ?? 0);
          } else {
            setChangedDataId(0);
          }
          setFilterData(raw);
        }
      } catch (e) {
        console.error("Matrix filter data error:", e);
      } finally {
        setLoading(false);
      }
    });
  }, [pocEndPoints, APIcallGet]);

  useEffect(() => {
    getFilterData();
  }, [getFilterData]);

  // Extract Cascade options dynamically from allRecords
  const processOptions = useMemo(() => {
    return [...new Set(allRecords.map(r => getColValue(r, "process")).filter(Boolean))].sort();
  }, [allRecords]);

  const maintenanceOptions = useMemo(() => {
    if (selectedProcess === "전체") return [];
    return [...new Set(allRecords.filter(r => getColValue(r, "process") === selectedProcess).map(r => getColValue(r, "maintGroup")).filter(Boolean))].sort();
  }, [allRecords, selectedProcess]);

  const siteOptions = useMemo(() => {
    return [...new Set(allRecords.filter(r => 
      (selectedProcess === "전체" || getColValue(r, "process") === selectedProcess) &&
      (selectedMaintenance === "전체" || getColValue(r, "maintGroup") === selectedMaintenance)
    ).map(r => getColValue(r, "site")).filter(Boolean))].sort();
  }, [allRecords, selectedProcess, selectedMaintenance]);

  const repWorkOptions = useMemo(() => {
    const reps = filterData?.representations ?? [];
    return [...new Set(reps.map(r => r.representativeWorkName).filter(Boolean))].sort();
  }, [filterData]);

  const priorityOptions = useMemo(() => {
    const rawList = [...new Set((filterData?.priority ?? []).map((p) => p.priorityName).filter(Boolean))];
    if (rawList.length === 0) {
      return ["중요", "일반"];
    }
    return rawList;
  }, [filterData]);

  const categoryOptions = useMemo(() => {
    const rawList = [...new Set((filterData?.category ?? []).map((c) => c.categoryName).filter(Boolean))];
    if (rawList.length === 0) {
      return ["생산성", "품질", "보전성", "기타"];
    }
    return rawList;
  }, [filterData]);

  const representativeColorMap = useMemo(() => {
    const map = new Map();
    (filterData?.representations ?? []).forEach((item) => {
      if (item?.representativeWorkName && item?.colorCode) {
        map.set(normalizeName(item.representativeWorkName), item.colorCode);
      }
    });
    return map;
  }, [filterData]);

  const getRepresentativeColor = useCallback(
    (workName) => representativeColorMap.get(normalizeName(workName)) || "#0f62fe",
    [representativeColorMap],
  );

  // Cascade Option Handlers
  const handleProcessChange = (e) => {
    const proc = e.target.value;
    setSelectedProcess(proc);

    if (proc === "전체") {
      setSelectedMaintenance("전체");
      setSelectedSite("전체");
      setSelectedRepWork("전체");
    } else {
      const parts = [...new Set(allRecords.filter(r => getColValue(r, "process") === proc).map(r => getColValue(r, "maintGroup")).filter(Boolean))].sort();
      if (parts.length === 1) {
        setSelectedMaintenance(parts[0]);
        const sites = [...new Set(allRecords.filter(r => getColValue(r, "process") === proc && getColValue(r, "maintGroup") === parts[0]).map(r => getColValue(r, "site")).filter(Boolean))].sort();
        if (sites.length === 1) {
          setSelectedSite(sites[0]);
        } else {
          setSelectedSite("전체");
        }
      } else {
        setSelectedMaintenance("전체");
        setSelectedSite("전체");
      }
      setSelectedRepWork("전체");
    }
  };

  const handleMaintenanceChange = (e) => {
    const part = e.target.value;
    setSelectedMaintenance(part);

    if (part === "전체") {
      setSelectedSite("전체");
      setSelectedRepWork("전체");
    } else {
      const sites = [...new Set(allRecords.filter(r => 
        (selectedProcess === "전체" || getColValue(r, "process") === selectedProcess) &&
        getColValue(r, "maintGroup") === part
      ).map(r => getColValue(r, "site")).filter(Boolean))].sort();
      if (sites.length === 1) {
        setSelectedSite(sites[0]);
      } else {
        setSelectedSite("전체");
      }
      setSelectedRepWork("전체");
    }
  };

  const handleSiteChange = (e) => {
    const site = e.target.value;
    setSelectedSite(site);
    setSelectedRepWork("전체");
  };

  const handleResetDates = () => {
    setStartDate("");
    setEndDate("");
  };

  // Filtered rows for the matrix table
  const filtered = useMemo(() => {
    return allRecords.filter((item) => {
      const itemProc = getColValue(item, "process");
      if (selectedProcess !== "전체" && itemProc !== selectedProcess) return false;

      const itemMaint = getColValue(item, "maintGroup");
      if (selectedMaintenance !== "전체" && itemMaint !== selectedMaintenance) return false;

      const itemSite = getColValue(item, "site");
      if (selectedSite !== "전체" && itemSite !== selectedSite) return false;

      const itemRepWork = getColValue(item, "representativeWork");
      if (selectedRepWork !== "전체" && itemRepWork !== selectedRepWork) return false;

      const itemPriority = getColValue(item, "priority");
      if (selectedPriorities.length > 0 && !selectedPriorities.includes(itemPriority)) return false;

      const itemCategory = getColValue(item, "category");
      if (selectedCategories.length > 0 && !selectedCategories.includes(itemCategory)) return false;

      const dateStr = getFormattedDateString(getColValue(item, "workedOn"));
      if (dateStr) {
        if (startDate && dateStr < startDate) return false;
        if (endDate && dateStr > endDate) return false;
      } else if (startDate || endDate) {
        return false;
      }

      if (searchText) {
        const text = Object.values(item)
          .map((v) => String(v ?? ""))
          .join(" ")
          .toLowerCase();
        if (!text.includes(searchText.toLowerCase())) return false;
      }

      return true;
    });
  }, [
    allRecords,
    selectedProcess,
    selectedMaintenance,
    selectedSite,
    selectedRepWork,
    selectedPriorities,
    selectedCategories,
    startDate,
    endDate,
    searchText,
  ]);

  // Determine X-axis headers (columns) and Y-axis rows (equipment)
  const { columns, equipmentRows } = useMemo(() => {
    if (filtered.length === 0) return { columns: [], equipmentRows: [] };

    // Unique equipment mapping
    const eqMap = new Map();
    filtered.forEach((item) => {
      const scode = getColValue(item, "equipmentCode");
      const sname = getColValue(item, "equipmentName");
      const k = scode + "|" + sname;
      if (!eqMap.has(k)) {
        eqMap.set(k, { equipmentCode: scode, equipmentName: sname });
      }
    });
    const equipmentRows = [...eqMap.values()].sort((a, b) => a.equipmentName.localeCompare(b.equipmentName));

    // Columns (X axis values)
    let columns = [];
    if (mode === "date") {
      columns = [...new Set(filtered.map(d => getFormattedDateString(getColValue(d, "workedOn"))).filter(Boolean))].sort();
    } else {
      // Sort representative tasks by latest date in descending order
      const repLatest = {};
      filtered.forEach((item) => {
        const rep = getColValue(item, "representativeWork");
        const dt = getFormattedDateString(getColValue(item, "workedOn"));
        if (rep && dt) {
          if (!repLatest[rep] || dt > repLatest[rep]) {
            repLatest[rep] = dt;
          }
        }
      });
      columns = Object.entries(repLatest)
        .sort((a, b) => b[1].localeCompare(a[1]))
        .map((e) => e[0]);
    }

    return { columns, equipmentRows };
  }, [filtered, mode]);

  // Task Mode completion rates
  const { colCompletion } = useMemo(() => {
    if (filtered.length === 0 || mode !== "task") return { colCompletion: {} };

    const totalEqs = equipmentRows.length || 1;
    const colCompletion = {};
    columns.forEach((col) => {
      let count = 0;
      equipmentRows.forEach((eq) => {
        const hasTask = filtered.some(d => 
          getColValue(d, "equipmentCode") === eq.equipmentCode && 
          getColValue(d, "equipmentName") === eq.equipmentName && 
          getColValue(d, "representativeWork") === col
        );
        if (hasTask) count++;
      });
      colCompletion[col] = (count / totalEqs) * 100;
    });

    return { colCompletion };
  }, [filtered, mode, columns, equipmentRows]);

  // Open replace modal prefilled
  const openReplaceModal = (taskName, colKey, record = null) => {
    if (selectedProcess === "전체" || selectedMaintenance === "전체") {
      alert(t("page.matrix.selectWarning", "공정과 보전파트를 먼저 선택하세요."));
      return;
    }
    
    setClickedRecord(record);
    
    const currentMaintRecords = allRecords.filter(r => 
      getColValue(r, "process") === selectedProcess && 
      getColValue(r, "maintGroup") === selectedMaintenance
    );
    
    let resolvedTaskName = taskName;
    let resolvedTasksList = [];

    if (taskName) {
      resolvedTaskName = taskName;
      resolvedTasksList = [];
    } else if (colKey) {
      const matchedTasks = [...new Set(currentMaintRecords.filter(r => {
        if (mode === "date") {
          return getFormattedDateString(getColValue(r, "workedOn")) === colKey;
        } else {
          return getColValue(r, "representativeWork") === colKey;
        }
      }).map(r => getColValue(r, "representativeWork")).filter(Boolean))];

      if (matchedTasks.length === 1) {
        resolvedTaskName = matchedTasks[0];
        resolvedTasksList = [];
      } else if (matchedTasks.length > 1) {
        resolvedTaskName = matchedTasks[0];
        resolvedTasksList = matchedTasks;
      } else {
        resolvedTaskName = "";
        resolvedTasksList = [];
      }
    } else {
      resolvedTaskName = "";
      resolvedTasksList = [];
    }

    setReplaceTargetTask(resolvedTaskName);
    setReplaceTargetTasksList(resolvedTasksList);

    // Prepopulate priority and effect type if they already exist in the matched records / clicked record
    let existingPriority = "";
    let existingCategory = "";
    
    if (record) {
      existingPriority = getColValue(record, "priority");
      existingCategory = getColValue(record, "category");
    }

    if (!existingPriority && !existingCategory && resolvedTaskName) {
      const matchedRecords = currentMaintRecords.filter(
        (r) => getColValue(r, "representativeWork") === resolvedTaskName
      );
      if (matchedRecords.length > 0) {
        const firstWithPriority = matchedRecords.find(r => getColValue(r, "priority") || getColValue(r, "category")) || matchedRecords[0];
        existingPriority = getColValue(firstWithPriority, "priority");
        existingCategory = getColValue(firstWithPriority, "category");
      }
    }

    setNewRepresentativeWork("");
    setNewPriority(existingPriority);
    setNewCategory(existingCategory);
    setShowReplaceModal(true);
  };

  // Execute Find & Replace
  const executeReplace = () => {
    const targetTask = replaceTargetTask;
    if (!targetTask) {
      alert(t("page.matrix.replaceTargetWarning", "변경할 작업명을 지정하세요."));
      return;
    }
    if (!newRepresentativeWork.trim() && !newPriority && !newCategory) {
      alert(t("page.matrix.replaceContentWarning", "변경할 내용을 입력하거나 선택하세요."));
      return;
    }

    setReplacing(true);

    const performUpdate = () => {
      const updated = allRecords.map((d) => {
        const isMatch = 
          getColValue(d, "process") === selectedProcess &&
          getColValue(d, "maintGroup") === selectedMaintenance &&
          getColValue(d, "representativeWork") === targetTask;

        if (isMatch) {
          const item = { ...d };
          if (newRepresentativeWork.trim()) {
            let updatedKey = false;
            if ("representativeWork" in item) { item.representativeWork = newRepresentativeWork.trim(); updatedKey = true; }
            if ("대표작업명" in item) { item["대표작업명"] = newRepresentativeWork.trim(); updatedKey = true; }
            if ("대표 작업명" in item) { item["대표 작업명"] = newRepresentativeWork.trim(); updatedKey = true; }
            if ("ëŒ€í‘œì ‘ì—…ëª…" in item) { item["ëŒ€í‘œì ‘ì—…ëª…"] = newRepresentativeWork.trim(); updatedKey = true; }
            if ("ëŒ€í‘œ ì ‘ì—…ëª…" in item) { item["ëŒ€í‘œ ì ‘ì—…ëª…"] = newRepresentativeWork.trim(); updatedKey = true; }
            if (!updatedKey) {
              item.representativeWork = newRepresentativeWork.trim();
            }
          }
          if (newPriority) {
            let updatedKey = false;
            if ("priority" in item) { item.priority = newPriority; updatedKey = true; }
            if ("중요도" in item) { item["중요도"] = newPriority; updatedKey = true; }
            if ("ì¤‘ìš”ë „" in item) { item["ì¤‘ìš”ë „"] = newPriority; updatedKey = true; }
            if (!updatedKey) {
              item.priority = newPriority;
            }
          }
          if (newCategory) {
            let updatedKey = false;
            if ("category" in item) { item.category = newCategory; updatedKey = true; }
            if ("효과 유형" in item) { item["효과 유형"] = newCategory; updatedKey = true; }
            if ("효과유형" in item) { item["효과유형"] = newCategory; updatedKey = true; }
            if ("íš¨ê³¼ ìœ í˜•" in item) { item["íš¨ê³¼ ìœ í˜•"] = newCategory; updatedKey = true; }
            if ("íš¨ê³¼ìœ í˜•" in item) { item["íš¨ê³¼ìœ í˜•"] = newCategory; updatedKey = true; }
            if (!updatedKey) {
              item.category = newCategory;
            }
          }
          return item;
        }
        return d;
      });

      setAllRecords(updated);

      const cleanRecords = updated.map((row) => {
        const clean = {};
        Object.keys(row).forEach((key) => {
          if (!key.startsWith("_")) {
            clean[key] = row[key];
          }
        });
        return {
          ...clean,
          id: clean.id ?? 0,
        };
      });

      const payload = {
        changeDataList: cleanRecords,
        id: changedDataId,
      };

      if (isStaticDataMode) {
        if (filterData?.representations && newRepresentativeWork.trim()) {
          const updatedReps = filterData.representations.map(rep => {
            if (normalizeName(rep.representativeWorkName) === normalizeName(targetTask)) {
              return { ...rep, representativeWorkName: newRepresentativeWork.trim() };
            }
            return rep;
          });
          setFilterData({ ...filterData, representations: updatedReps });
        }
        onUpload?.("change_rows", payload);
        setReplacing(false);
        setShowReplaceModal(false);
        return;
      }

      APIcallPost(pocEndPoints.SAVE_DATA_CHANGES, payload, {}, (responseData, status) => {
        setReplacing(false);
        if (status === 200) {
          setShowReplaceModal(false);
          onUpload?.("change_rows", payload);
          getFilterData();
        } else {
          alert(t("toast.saveError", "저장에 실패했습니다."));
        }
      });
    };

    if (newRepresentativeWork.trim() && !isStaticDataMode) {
      const representationItem = (filterData?.representations ?? []).find(
        (rep) => normalizeName(rep.representativeWorkName) === normalizeName(targetTask)
      );
      const repId = representationItem ? representationItem.id : null;

      if (repId !== null && repId !== undefined) {
        APIcallPost(
          pocEndPoints.UPDATE_REPRESENTATIVE_WORK,
          { id: repId, name: newRepresentativeWork.trim() },
          {},
          (repData, repStatus) => {
            if (repStatus === 200) {
              performUpdate();
            } else {
              setReplacing(false);
              alert(t("toast.saveError", "대표 작업명 수정에 실패했습니다."));
            }
          }
        );
      } else {
        performUpdate();
      }
    } else {
      performUpdate();
    }
  };

  const showLanding = false;

  if (loading) {
    return (
      <section className="space-y-6">
        <div className="flex min-h-[240px] items-center justify-center text-text-subtle">
          <i className="fas fa-spinner fa-spin mr-2" /> {t("app.loadingData", "데이터를 불러오는 중...")}
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-text-default">{t("page.matrix.title", "변경 매트릭스")}</h1>
          <p className="mt-2 text-sm text-text-subtle">
            {t("page.matrix.desc", "공정과 작업별 변경 이력을 시각적으로 분석합니다.")}
          </p>
        </div>
        <div className="toggle-group">
          <button
            type="button"
            className={`toggle-btn ${mode === "date" ? "active" : ""}`}
            onClick={() => setMode("date")}
          >
            {t("matrix.dateMode", "날짜 모드")}
          </button>
          <button
            type="button"
            className={`toggle-btn ${mode === "task" ? "active" : ""}`}
            onClick={() => setMode("task")}
          >
            {t("matrix.taskMode", "작업명 모드")}
          </button>
        </div>
      </header>

      {/* Filter Card */}
      <div className="card p-4 relative z-30">
        <div className="flex flex-wrap items-center gap-4">
          {/* 공정 */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold uppercase text-text-subtle whitespace-nowrap">{t("field.process", "공정")}</label>
            <select
              className="input-base"
              value={selectedProcess}
              onChange={handleProcessChange}
              style={{ width: "110px" }}
            >
              <option value="전체">{t("app.all", "전체")}</option>
              {processOptions.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          {/* 보전파트 */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold uppercase text-text-subtle whitespace-nowrap">{t("field.maintenance", "보전파트")}</label>
            <select
              className="input-base"
              value={selectedMaintenance}
              onChange={handleMaintenanceChange}
              disabled={selectedProcess === "전체"}
              style={{ width: "130px" }}
            >
              <option value="전체">{t("app.all", "전체")}</option>
              {maintenanceOptions.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* 법인 */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold uppercase text-text-subtle whitespace-nowrap">{t("field.site", "법인")}</label>
            <select
              className="input-base"
              value={selectedSite}
              onChange={handleSiteChange}
              disabled={selectedProcess === "전체"}
              style={{ width: "140px" }}
            >
              <option value="전체">{t("app.all", "전체")}</option>
              {siteOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* 대표 작업명 */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold uppercase text-text-subtle whitespace-nowrap">{t("field.repWork", "대표 작업명")}</label>
            <select
              className="input-base"
              value={selectedRepWork}
              onChange={(e) => setSelectedRepWork(e.target.value)}
              disabled={selectedProcess === "전체"}
              style={{ width: "180px" }}
            >
              <option value="전체">{t("app.all", "전체")}</option>
              {repWorkOptions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <span className="text-[10px] font-bold text-brand-60" style={{ color: "var(--brand-60, #0f62fe)" }}>
              {repWorkOptions.length ? `(${repWorkOptions.length}개)` : ""}
            </span>
          </div>

          {/* 중요도 */}
          <div className="flex items-center gap-2" style={{ width: "130px" }}>
            <label className="text-xs font-bold uppercase text-text-subtle whitespace-nowrap">
              {t("field.priority", "중요도")} <span className="text-red-500">*</span>
            </label>
            <MultiSelect
              options={priorityOptions.map((p) => ({ label: p, value: p }))}
              selectedValues={selectedPriorities}
              onChange={setSelectedPriorities}
              t={t}
            />
          </div>

          {/* 효과 유형 */}
          <div className="flex items-center gap-2" style={{ width: "130px" }}>
            <label className="text-xs font-bold uppercase text-text-subtle whitespace-nowrap">{t("field.category", "효과유형")}</label>
            <MultiSelect
              options={categoryOptions.map((c) => ({ label: c, value: c }))}
              selectedValues={selectedCategories}
              onChange={setSelectedCategories}
              t={t}
            />
          </div>

          {/* 기간 */}
          <div className="flex items-center gap-2 ml-auto">
            <label className="text-xs font-bold uppercase text-text-subtle whitespace-nowrap">{t("field.period", "기간")}</label>
            <input
              type="date"
              className="input-base py-1 px-2 text-xs"
              style={{ height: "38px" }}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <span className="text-text-subtle">~</span>
            <input
              type="date"
              className="input-base py-1 px-2 text-xs"
              style={{ height: "38px" }}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        {(startDate || endDate) && (
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              className="btn-base btn-ghost text-xs text-text-subtle"
              onClick={handleResetDates}
            >
              <i className="fas fa-times mr-1" />
              {t("matrix.resetDate", "날짜 초기화")}
            </button>
          </div>
        )}
      </div>

      {/* Grid Container */}
      <div className="card overflow-hidden flex flex-col relative" style={{ minHeight: "360px" }}>
        {showLanding ? (
          <div className="landing-empty flex flex-col items-center justify-center p-10 text-center relative flex-1" style={{ minHeight: "360px" }}>
            <div
              className="flex h-20 w-20 items-center justify-center rounded-full mx-auto mb-6"
              style={{
                backgroundColor: "var(--brand-10, #eff6ff)",
                animation: "float 4s ease-in-out infinite",
              }}
            >
              <i className="fas fa-layer-group text-4xl text-brand-60" style={{ color: "var(--primary-light, #93c5fd)" }} />
            </div>
            <h3 className="text-lg font-bold text-text-default mb-2">{t("page.matrix.landingTitle", "공정 및 보전파트를 선택하세요")}</h3>
            <p className="text-sm text-text-subtle max-w-[360px] mx-auto">
              {t("page.matrix.landingDesc", "상단 필터에서 공정과 보전파트를 먼저 선택하면 매트릭스가 표시됩니다.")}
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex min-h-[360px] flex-col items-center justify-center gap-3 p-10 text-center text-text-subtle flex-1">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-10 text-brand-60 text-3xl" style={{ backgroundColor: "var(--brand-10, #eff6ff)", color: "var(--brand-60, #0f62fe)" }}>
              <i className="fas fa-layer-group" />
            </div>
            <h2 className="text-xl font-bold text-text-default">
              {t("matrix.noData", "해당 조건에 맞는 데이터가 없습니다.")}
            </h2>
            <p>{t("matrix.adjustFilter", "필터를 조정하거나 추가 데이터를 확인하세요.")}</p>
          </div>
        ) : (
          <div className="overflow-auto flex-1" style={{ height: "calc(100vh - 350px)" }}>
            <table className="w-full min-w-max text-sm" style={{ borderCollapse: "separate", borderSpacing: 0 }}>
              <thead>
                <tr className="border-b border-border-base bg-surface-strong">
                  <th
                    className="sticky left-0 z-25 bg-surface-strong px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-text-subtle"
                    style={{ width: "120px", position: "sticky", left: 0 }}
                  >
                    {t("field.equipmentCode", "설비코드")}
                  </th>
                  <th
                    className="sticky z-25 bg-surface-strong px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-text-subtle"
                    style={{ width: "180px", position: "sticky", left: "120px" }}
                  >
                    {t("field.equipmentName", "설비명")}
                  </th>
                  {columns.map((col) => {
                    if (mode === "date") {
                      return (
                        <th
                          key={col}
                          className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-text-subtle relative group"
                          style={{ width: "160px" }}
                        >
                          <div className="flex items-center justify-center gap-1">
                            <span>{col}</span>
                            <i
                              className="fas fa-pen text-[9px] cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity ml-1"
                              onClick={() => openReplaceModal(null, col)}
                              title={t("page.matrix.editColumn", "열 작업명 수정")}
                            />
                          </div>
                        </th>
                      );
                    } else {
                      const rate = colCompletion?.[col] ?? 0;
                      return (
                        <th
                          key={col}
                          className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-text-subtle relative group"
                          style={{ width: "200px", whiteSpace: "normal" }}
                        >
                          <div className="flex flex-col items-center justify-center">
                            <div className="flex items-center justify-center gap-1">
                              <span className="break-all">{col}</span>
                              <i
                                className="fas fa-pen text-[9px] cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity ml-1"
                                onClick={() => openReplaceModal(null, col)}
                                title={t("page.matrix.editColumn", "열 작업명 수정")}
                              />
                            </div>
                            <span className="mt-1 text-[10px] font-normal normal-case text-text-subtle">
                              {rate.toFixed(1)}%
                            </span>
                          </div>
                        </th>
                      );
                    }
                  })}
                </tr>
              </thead>
              <tbody>
                {equipmentRows.map((eq, rowIdx) => (
                  <tr
                    key={`${eq.equipmentCode}-${rowIdx}`}
                    className="group border-b border-border-base last:border-0 hover:bg-fill-active transition-colors"
                  >
                    <td
                      className="sticky left-0 z-20 bg-surface-default px-4 py-3 font-semibold text-text-default group-hover:bg-fill-active transition-colors"
                      style={{ position: "sticky", left: 0 }}
                    >
                      {eq.equipmentCode}
                    </td>
                    <td
                      className="sticky z-20 bg-surface-default px-4 py-3 font-semibold text-text-default group-hover:bg-fill-active transition-colors"
                      style={{ position: "sticky", left: "120px" }}
                    >
                      {eq.equipmentName}
                    </td>
                    {columns.map((col) => {
                      const matched = filtered.filter(d => {
                        const isEquip = getColValue(d, "equipmentCode") === eq.equipmentCode && getColValue(d, "equipmentName") === eq.equipmentName;
                        if (!isEquip) return false;
                        if (mode === "date") {
                          return getFormattedDateString(getColValue(d, "workedOn")) === col;
                        } else {
                          return getColValue(d, "representativeWork") === col;
                        }
                      });

                      if (matched.length === 0) {
                        return <td key={col} className="px-4 py-3" />;
                      }

                      const displayValues = [...new Set(matched.map(d => 
                        mode === "date" ? getColValue(d, "representativeWork") : getFormattedDateString(getColValue(d, "workedOn"))
                      ).filter(Boolean))].sort();

                      const isImportant = matched.some(d => getColValue(d, "priority") === "중요");
                      
                      const repWork = matched.map(d => getColValue(d, "representativeWork")).find(Boolean) || "";
                      const colorCode = representativeColorMap.get(normalizeName(repWork));
                      
                      let cellBg;
                      let cellColor;
                      if (colorCode) {
                        cellBg = hexToRgba(colorCode, 0.12);
                        cellColor = colorCode;
                      } else {
                        cellBg = isImportant 
                          ? "rgba(239, 68, 68, 0.12)" 
                          : "rgba(15, 98, 254, 0.08)";
                        cellColor = isImportant 
                          ? "#dc2626" 
                          : "#0f62fe";
                      }

                      return (
                        <td key={col} className="px-3 py-2 align-middle">
                          <div
                            onClick={() => onOpenDetail?.(matched)}
                            className="matrix-cell p-2 rounded-lg cursor-pointer flex flex-col items-center justify-center text-center font-medium relative group transition-all duration-200 hover:scale-[1.04] hover:shadow-md hover:z-10"
                            style={{
                              backgroundColor: cellBg,
                              color: cellColor,
                              fontSize: "11px",
                              lineHeight: "1.4",
                              minHeight: "36px",
                              whiteSpace: "pre-line",
                              wordBreak: "break-all"
                            }}
                          >
                            <div>
                              {displayValues.join("\n")}
                            </div>
                            <span 
                              className="absolute top-[2px] right-[4px] text-[9px] opacity-0 group-hover:opacity-100 transition-all duration-200 text-text-subtle bg-white border border-[#e2e8f0] rounded-[4px] px-1 py-0.5 shadow-sm hover:text-[#4f46e5] hover:scale-105 active:scale-95 z-20 cursor-pointer"
                              onClick={(e) => {
                                  e.stopPropagation();
                                  const firstTask = getColValue(matched[0], "representativeWork");
                                  openReplaceModal(firstTask, null, matched[0]);
                              }}
                            >
                              <i className="fas fa-pen text-[8px]" />
                            </span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Find & Replace Modal */}
      {showReplaceModal && (
        <div className="modal-overlay fixed inset-0 z-[1000] flex items-center justify-center bg-[#0f172a]/40 backdrop-blur-sm animate-fade-in" onClick={() => setShowReplaceModal(false)}>
          <div className="modal-content w-full max-w-[520px] rounded-[24px] bg-[#f8fafc] shadow-2xl overflow-hidden border border-[#e2e8f0]" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-[#e2e8f0] bg-[#eef2ff] flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg text-[#0f172a] flex items-center gap-2">
                  <i className="fas fa-exchange-alt text-[#4f46e5]" />
                  {t("page.matrix.replaceModalTitle", "대표 작업명 일괄 수정")}
                </h3>
                <p className="text-xs text-[#475569] mt-1">
                  {t("page.matrix.replaceModalDesc", "일치하는 모든 대표 작업명과 속성을 한 번에 변경합니다.")}
                </p>
              </div>
              <button onClick={() => setShowReplaceModal(false)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-200/50 text-[#475569] transition-colors">
                <i className="fas fa-times text-lg" />
              </button>
            </div>
            
            <div className="p-6 space-y-5">
              <div>
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#475569] mb-1.5 uppercase tracking-wider">
                  <i className="fas fa-lock text-[#d97706]" />
                  {t("page.matrix.replaceBefore", "변경 전 (대표 작업명)")}
                  <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#fffbeb] text-[#d97706] border border-[#fde68a] ml-2">
                    <i className="fas fa-lock text-[8px]" />
                    {t("app.readonly", "수정 불가")}
                  </span>
                </div>
                {replaceTargetTasksList.length > 1 ? (
                  <div>
                    <select
                      className="input-base w-full bg-white font-medium text-text-default transition-all duration-150"
                      style={{ borderColor: "#f59e0b", borderWidth: "1.5px" }}
                      value={replaceTargetTask}
                      onChange={(e) => {
                        const nextTask = e.target.value;
                        setReplaceTargetTask(nextTask);
                        if (nextTask) {
                          const currentMaintRecords = allRecords.filter(r => 
                            getColValue(r, "process") === selectedProcess && 
                            getColValue(r, "maintGroup") === selectedMaintenance
                          );
                          
                          let foundRecord = null;
                          if (clickedRecord) {
                            const eqCode = getColValue(clickedRecord, "equipmentCode");
                            const eqName = getColValue(clickedRecord, "equipmentName");
                            foundRecord = allRecords.find(r => 
                              getColValue(r, "equipmentCode") === eqCode &&
                              getColValue(r, "equipmentName") === eqName &&
                              getColValue(r, "representativeWork") === nextTask
                            );
                          }
                          
                          if (foundRecord) {
                            setNewPriority(getColValue(foundRecord, "priority"));
                            setNewCategory(getColValue(foundRecord, "category"));
                          } else {
                            const matchedRecords = currentMaintRecords.filter(
                              (r) => getColValue(r, "representativeWork") === nextTask
                            );
                            if (matchedRecords.length > 0) {
                              const firstWithVal = matchedRecords.find(r => getColValue(r, "priority") || getColValue(r, "category")) || matchedRecords[0];
                              setNewPriority(getColValue(firstWithVal, "priority"));
                              setNewCategory(getColValue(firstWithVal, "category"));
                            } else {
                              setNewPriority("");
                              setNewCategory("");
                            }
                          }
                        } else {
                          setNewPriority("");
                          setNewCategory("");
                        }
                      }}
                    >
                      {replaceTargetTasksList.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                    <p className="text-[10px] text-text-subtle mt-1.5">
                      <i className="fas fa-info-circle mr-1 text-[#f59e0b]" />
                      {t("page.matrix.multipleTasksNotice", "해당 셀에 2개 이상의 대표 작업명이 있습니다. 변경할 작업명을 선택하세요.")}
                    </p>
                  </div>
                ) : (
                  <input
                    type="text"
                    className="input-base w-full bg-[#f1f5f9] cursor-not-allowed font-medium text-[#1e293b]"
                    style={{ borderColor: "#f59e0b", borderWidth: "1.5px" }}
                    value={replaceTargetTask}
                    readOnly
                  />
                )}
              </div>

              <div className="flex justify-center text-[#4f46e5] my-1 text-xl">
                <i className="fas fa-arrow-down" />
              </div>

              <div>
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#475569] mb-1.5 uppercase tracking-wider">
                  <i className="fas fa-pen text-[#94a3b8] text-[10px]" />
                  {t("page.matrix.replaceAfter", "변경 후 (대표 작업명)")}
                </div>
                <input
                  type="text"
                  list="replaceSuggestions"
                  className="input-base w-full bg-white border border-[#e2e8f0] focus:border-[#4f46e5] focus:ring-1 focus:ring-[#4f46e5] outline-none transition-all duration-150"
                  placeholder={t("page.matrix.replaceAfterPlaceholder", "새로운 대표 작업명을 입력하세요")}
                  value={newRepresentativeWork}
                  onChange={(e) => setNewRepresentativeWork(e.target.value)}
                />
                <datalist id="replaceSuggestions">
                  {repWorkOptions.map(opt => (
                    <option key={opt} value={opt} />
                  ))}
                </datalist>
                <p className="text-[11px] text-[#94a3b8] mt-1.5 flex items-center gap-1">
                  <i className="fas fa-lightbulb text-[#94a3b8]" />
                  {t("page.matrix.replaceSuggestionTip", "기존 작업명 중 선택하거나 새로운 이름을 입력할 수 있습니다.")}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#475569] mb-1.5 uppercase tracking-wider">
                    <i className="fas fa-flag text-[#94a3b8] text-[10px]" />
                    {t("field.priority", "중요도")}
                  </div>
                  <select
                    className="input-base w-full bg-white border border-[#e2e8f0] focus:border-[#4f46e5] focus:ring-1 focus:ring-[#4f46e5] outline-none"
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value)}
                  >
                    <option value="">{t("page.matrix.noChange", "변경 없음")}</option>
                    <option value="중요">{t("priority.high", "중요")}</option>
                    <option value="일반">{t("priority.normal", "일반")}</option>
                  </select>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#475569] mb-1.5 uppercase tracking-wider">
                    <i className="fas fa-tag text-[#94a3b8] text-[10px]" />
                    {t("field.category", "효과 유형")}
                  </div>
                  <select
                    className="input-base w-full bg-white border border-[#e2e8f0] focus:border-[#4f46e5] focus:ring-1 focus:ring-[#4f46e5] outline-none"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                  >
                    <option value="">{t("page.matrix.noChange", "변경 없음")}</option>
                    <option value="생산성">{t("category.productivity", "생산성")}</option>
                    <option value="품질">{t("category.quality", "품질")}</option>
                    <option value="보전성">{t("category.maintenance", "보전성")}</option>
                    <option value="기타">{t("category.etc", "기타")}</option>
                  </select>
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-[#bae6fd] bg-[#f0f9ff] flex items-start gap-2.5">
                <i className="fas fa-info-circle text-[#0284c7] mt-0.5 text-sm" />
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-[#0284c7]">{t("page.matrix.applyScopeTitle", "적용 범위")}</p>
                  <p className="text-[11px] text-[#0369a1] leading-relaxed">
                    {t("page.matrix.applyScopeDesc", "현재 보전파트 내에서 '변경 전' 작업명과 일치하는 모든 데이터의 대표 작업명, 중요도, 효과 유형이 일괄 변경됩니다.")
                      .split("모든 데이터")
                      .reduce((prev, current, i, arr) => {
                        if (i === 0) return [current];
                        return [...prev, <strong key={i} className="font-bold text-[#0284c7]">모든 데이터</strong>, current];
                      }, [])
                    }
                  </p>
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-[#e2e8f0] flex justify-end items-center gap-4 bg-[#f8fafc]">
              <button
                onClick={() => setShowReplaceModal(false)}
                className="text-[14px] font-bold text-[#334155] hover:text-[#0f172a] px-4 py-2 transition-colors duration-150"
              >
                {t("app.cancel", "취소")}
              </button>
              <button
                onClick={executeReplace}
                disabled={replacing}
                className="px-5 py-2.5 rounded-xl font-bold text-white text-[14px] flex items-center justify-center gap-1.5 shadow-lg shadow-[#4f46e5]/25 hover:shadow-xl hover:shadow-[#4f46e5]/35 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: "linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)" }}
              >
                {replacing ? (
                  <>
                    <i className="fas fa-spinner fa-spin" />
                    {t("app.applying", "적용 중...")}
                  </>
                ) : (
                  <>
                    <i className="fas fa-check" />
                    {t("app.apply", "적용하기")}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
