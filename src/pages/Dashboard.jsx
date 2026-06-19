import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar.jsx";
import Navbar from "../components/Navbar.jsx";
import Drawer from "../components/Drawer.jsx";
import ChangeHistory from "./ChangeHistory.jsx";
import SpecData from "./SpecData.jsx";
import Matrix from "./Matrix.jsx";
import MPList from "./MPList.jsx";
import SpecMatrix from "./SpecMatrix.jsx";
import Board from "./Board.jsx";
import Admin from "./Admin.jsx";
import { useToast } from "../components/ToastContext.jsx";
import { uploadExcel, APIcallGet } from "../utils/api.js";
import { changeColumns, specColumns, mpColumns } from "../data.js";
import { useI18n } from "../i18n.jsx";


const pageNames = {
  "dm-change": "데이터 관리 > 변경 이력",
  "dm-spec": "데이터 관리 > 사양 데이터",
  "mx-matrix": "변경 매트릭스 > 매트릭스 조회",
  "mx-mplist": "변경 매트릭스 > MP List",
  spec: "사양 매트릭스",
  board: "게시판",
  admin: "권한 관리",
};

const defaultPage = "dm-change";

const pageRoutes = {
  "dm-change": "/data-management/change-history-data",
  "dm-spec": "/data-management/spec-data",
  "mx-matrix": "/change-matrix/matrix-view",
  "mx-mplist": "/change-matrix/mp-list",
  spec: "/spec-matrix",
  board: "/board",
  admin: "/admin",
};

const routePages = Object.fromEntries(
  Object.entries(pageRoutes).map(([pageId, route]) => [route, pageId]),
);

const loadLocal = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const saveLocal = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
};

const formatCsv = (items, columns) => {
  const rows = [columns.map((col) => `"${col.replace(/"/g, '""')}"`).join(",")];
  items.forEach((item) => {
    rows.push(columns.map((col) => `"${String(item[col] ?? "").replace(/"/g, '""')}"`).join(","));
  });
  return rows.join("\n");
};

const parseCsv = (text) => {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return [];
  const headers = lines[0].split(",").map((value) => value.replace(/^"|"$/g, "").trim());
  return lines.slice(1).map((line) => {
    const values = line
      .split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
      .map((value) => value.replace(/^"|"$/g, "").trim());
    return headers.reduce((acc, header, index) => {
      acc[header] = values[index] ?? "";
      return acc;
    }, {});
  });
};

export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const activePage = routePages[location.pathname] ?? defaultPage;
  const [searchText, setSearchText] = useState("");
  const [changeData, setChangeData] = useState(() => loadLocal("eq_chg", []));
  const [specData, setSpecData] = useState(() => loadLocal("eq_spec", []));
  const [boardData, setBoardData] = useState(() => loadLocal("eq_board", []));
  const [users, setUsers] = useState(() => loadLocal("eq_users", []));
  const [mpRows, setMpRows] = useState(() => loadLocal("eq_mp", []));
  const [changeDataColumns, setChangeDataColumns] = useState(() => loadLocal("eq_chg_cols", []));
  const [persistChange, setPersistChange] = useState(true);
  const [persistSpec, setPersistSpec] = useState(true);
  const [persistBoard, setPersistBoard] = useState(true);
  const [persistUsers, setPersistUsers] = useState(true);
  const [persistMp, setPersistMp] = useState(true);
  const [drawerItem, setDrawerItem] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem("eq_sidebar_collapsed") === "true",
  );
  const [theme, setTheme] = useState(() => localStorage.getItem("eq_theme") || "light");
  const { pushToast } = useToast();
  const { t } = useI18n();

  useEffect(() => {
    if (!routePages[location.pathname]) {
      navigate(pageRoutes[defaultPage], { replace: true });
    }
  }, [location.pathname, navigate]);

  useEffect(() => {
    if (persistChange) saveLocal("eq_chg", changeData);
    if (persistSpec) saveLocal("eq_spec", specData);
    if (persistBoard) saveLocal("eq_board", boardData);
    if (persistUsers) saveLocal("eq_users", users);
    if (persistMp) saveLocal("eq_mp", mpRows);
  }, [
    changeData,
    specData,
    boardData,
    users,
    mpRows,
    persistChange,
    persistSpec,
    persistBoard,
    persistUsers,
    persistMp,
  ]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("eq_theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("eq_sidebar_collapsed", String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  const handleUpload = async (type, file) => {
    if (type === "change_rows") {
      if (Array.isArray(file?.changeDataList)) {
        setChangeData(file.changeDataList);
      }
      return;
    }
    if (!file) return;
    const name = file.name || "";
    const ext = name.split(".").pop().toLowerCase();

    if (ext === "csv") {
      const text = await file.text();
      const parsed = parseCsv(text);
      if (!parsed.length) {
        pushToast(t("toast.csvReadError"), "error");
        return;
      }
      if (type === "change") {
        setChangeData(parsed);
        setPersistChange(false);
        pushToast(t("toast.changeHistoryUploaded"), "success");
      }
      if (type === "spec") {
        setSpecData(parsed);
        setPersistSpec(false);
        pushToast(t("toast.specDataUploaded"), "success");
      }
      return;
    }

    if (ext === "xlsx" || ext === "xls") {
      try {
        const uploadResponse = await uploadExcel(file);
        const rows = Array.isArray(uploadResponse?.rows) ? uploadResponse.rows : [];
        if (!rows.length) {
          pushToast(t("toast.excelEmptyRows"), "error");
          return;
        }

        if (type === "change") {
          setChangeData(rows);
          setPersistChange(false);
          pushToast(t("toast.changeHistoryUploaded"), "success");
        }
        if (type === "spec") {
          setSpecData(rows);
          setPersistSpec(false);
          pushToast(t("toast.specDataUploaded"), "success");
        }
      } catch (err) {
        pushToast(t("toast.excelError"), "error");
      }
      return;
    }

    pushToast(t("toast.unsupportedFormat"), "error");
  };

  const exportCsv = (type) => {
    let data = [];
    let columns = [];
    if (type === "change") {
      data = changeData;
      columns = changeColumns;
    } else if (type === "spec") {
      data = specData;
      columns = specColumns;
    } else if (type === "mp") {
      data = mpRows;
      columns = mpColumns;
    }
    const csv = formatCsv(data, columns);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${type}-export.csv`;
    link.click();
  };

  const addBoardPost = (post) => {
    setBoardData((prev) => [post, ...prev]);
    pushToast(t("toast.postSaved"), "success");
  };

  const addMpRow = (row) => {
    setMpRows((prev) => [row, ...prev]);
    pushToast(t("toast.mpRowAdded"), "success");
  };

  const updateUsers = (updated) => {
    setUsers(updated);
    pushToast(t("toast.permissionsSaved"), "success");
  };

  const handleNavigate = (pageId) => {
    navigate(pageRoutes[pageId] ?? pageRoutes[defaultPage]);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-text-default">
      <div className="flex h-screen overflow-hidden">
        <Sidebar
          activePage={activePage}
          onNavigate={handleNavigate}
          collapsed={sidebarCollapsed}
        />
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <Navbar
            collapsed={sidebarCollapsed}
            onToggleMenu={() => setSidebarCollapsed((current) => !current)}
            theme={theme}
            onToggleTheme={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
          />
          <main className="flex-1 overflow-auto bg-[#f8fafc] p-6">
            {activePage === "dm-change" && (
              <ChangeHistory
                data={changeData}
                onUpload={handleUpload}
                onExport={() => exportCsv("change")}
                onOpenDetail={setDrawerItem}
                searchText={searchText}
                changeDataColumns={changeDataColumns}
              />
            )}
            {activePage === "dm-spec" && (
              <SpecData
                data={specData}
                onUpload={handleUpload}
                onExport={() => exportCsv("spec")}
                searchText={searchText}
              />
            )}
            {activePage === "mx-matrix" && (
              <Matrix
                data={changeData}
                searchText={searchText}
                onOpenDetail={setDrawerItem}
                changeDataColumns={changeDataColumns}
                onUpload={handleUpload}
              />
            )}
            {activePage === "mx-mplist" && (
              <MPList
                data={mpRows}
                onAddRow={addMpRow}
                onExport={() => exportCsv("mp")}
                searchText={searchText}
                onOpenDetail={setDrawerItem}
                drawerItem={drawerItem}
                onUpload={handleUpload}
              />
            )}
            {activePage === "spec" && <SpecMatrix data={specData} searchText={searchText} />}
            {activePage === "board" && (
              <Board data={boardData} onAddPost={addBoardPost} searchText={searchText} />
            )}
            {activePage === "admin" && (
              <Admin users={users} onUpdateUsers={updateUsers} searchText={searchText} />
            )}
          </main>
        </div>
      </div>
      <Drawer item={drawerItem} onClose={() => setDrawerItem(null)} />
    </div>
  );
}
