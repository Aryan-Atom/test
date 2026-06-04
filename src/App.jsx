import { useEffect, useMemo, useState } from "react";
import Sidebar from "./components/Sidebar.jsx";
import Navbar from "./components/Navbar.jsx";
import Drawer from "./components/Drawer.jsx";
import ChangeHistory from "./pages/ChangeHistory.jsx";
import SpecData from "./pages/SpecData.jsx";
import Matrix from "./pages/Matrix.jsx";
import MPList from "./pages/MPList.jsx";
import SpecMatrix from "./pages/SpecMatrix.jsx";
import Board from "./pages/Board.jsx";
import Admin from "./pages/Admin.jsx";
import { useToast } from "./components/ToastContext.jsx";
import { uploadExcel } from "./utils/api.js";
import { changeColumns, specColumns, mpColumns } from "./data.js";

const pageNames = {
  "dm-change": "데이터 관리 > 변경 이력",
  "dm-spec": "데이터 관리 > 사양 데이터",
  "mx-matrix": "변경 매트릭스 > 매트릭스 조회",
  "mx-mplist": "변경 매트릭스 > MP List",
  spec: "사양 매트릭스",
  board: "게시판",
  admin: "권한 관리",
};

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
    rows.push(
      columns
        .map((col) => `"${String(item[col] ?? "").replace(/"/g, '""')}"`)
        .join(","),
    );
  });
  return rows.join("\n");
};

const parseCsv = (text) => {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return [];
  const headers = lines[0]
    .split(",")
    .map((value) => value.replace(/^"|"$/g, "").trim());
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

export default function App() {
  const [activePage, setActivePage] = useState("dm-change");
  const [searchText, setSearchText] = useState("");
  const [changeData, setChangeData] = useState(() => loadLocal("eq_chg", []));
  const [specData, setSpecData] = useState(() => loadLocal("eq_spec", []));
  const [boardData, setBoardData] = useState(() => loadLocal("eq_board", []));
  const [users, setUsers] = useState(() => loadLocal("eq_users", []));
  const [mpRows, setMpRows] = useState(() => loadLocal("eq_mp", []));
  // Persist flags: when false, the corresponding dataset will not be written
  // to localStorage (useful for transient uploads that should reset on reload)
  const [persistChange, setPersistChange] = useState(true);
  const [persistSpec, setPersistSpec] = useState(true);
  const [persistBoard, setPersistBoard] = useState(true);
  const [persistUsers, setPersistUsers] = useState(true);
  const [persistMp, setPersistMp] = useState(true);
  const [drawerItem, setDrawerItem] = useState(null);
  const { pushToast } = useToast();

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

  const handleUpload = async (type, file) => {
    if (!file) return;
    const name = file.name || "";
    const ext = name.split(".").pop().toLowerCase();

    if (ext === "csv") {
      const text = await file.text();
      const parsed = parseCsv(text);
      if (!parsed.length) {
        pushToast("CSV 파일을 읽을 수 없습니다.", "error");
        return;
      }
      if (type === "change") {
        setChangeData(parsed);
        setPersistChange(false);
        pushToast("변경 이력 데이터가 업로드되었습니다.", "success");
      }
      if (type === "spec") {
        setSpecData(parsed);
        setPersistSpec(false);
        pushToast("사양 데이터가 업로드되었습니다.", "success");
      }
      return;
    }

    if (ext === "xlsx" || ext === "xls") {
      try {
        const response = await uploadExcel(file);
        const rows = Array.isArray(response?.rows) ? response.rows : [];
        if (!rows.length) {
          pushToast("엑셀 업로드 후 rows가 없습니다.", "error");
          return;
        }
        if (type === "change") {
          setChangeData(rows);
          setPersistChange(false);
          pushToast("변경 이력 데이터가 업로드되었습니다.", "success");
        }
        if (type === "spec") {
          setSpecData(rows);
          setPersistSpec(false);
          pushToast("사양 데이터가 업로드되었습니다.", "success");
        }
      } catch (err) {
        pushToast("엑셀 업로드 중 오류가 발생했습니다.", "error");
      }
      return;
    }

    pushToast(
      "지원되지 않는 파일 형식입니다. CSV 또는 XLSX만 지원합니다.",
      "error",
    );
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
    pushToast("게시글이 저장되었습니다.", "success");
  };

  const addMpRow = (row) => {
    setMpRows((prev) => [row, ...prev]);
    pushToast("MP List 행이 추가되었습니다.", "success");
  };

  const updateUsers = (updated) => {
    setUsers(updated);
    pushToast("사용자 권한 정보가 저장되었습니다.", "success");
  };

  const currentBreadcrumb = pageNames[activePage] || "대시보드";

  return (
    <div className="min-h-screen bg-surface-default text-text-default">
      <div className="flex min-h-screen overflow-hidden">
        <Sidebar activePage={activePage} onNavigate={setActivePage} />
        <div className="flex min-h-screen flex-1 flex-col overflow-hidden">
          <Navbar
            breadcrumb={currentBreadcrumb}
            searchText={searchText}
            onSearchChange={setSearchText}
          />
          <main className="flex-1 overflow-auto p-6">
            {activePage === "dm-change" && (
              <ChangeHistory
                data={changeData}
                onUpload={handleUpload}
                onExport={() => exportCsv("change")}
                onOpenDetail={setDrawerItem}
                searchText={searchText}
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
              />
            )}
            {activePage === "mx-mplist" && (
              <MPList
                data={mpRows}
                onAddRow={addMpRow}
                onExport={() => exportCsv("mp")}
                searchText={searchText}
              />
            )}
            {activePage === "spec" && (
              <SpecMatrix data={specData} searchText={searchText} />
            )}
            {activePage === "board" && (
              <Board
                data={boardData}
                onAddPost={addBoardPost}
                searchText={searchText}
              />
            )}
            {activePage === "admin" && (
              <Admin
                users={users}
                onUpdateUsers={updateUsers}
                searchText={searchText}
              />
            )}
          </main>
        </div>
      </div>
      <Drawer item={drawerItem} onClose={() => setDrawerItem(null)} />
    </div>
  );
}
