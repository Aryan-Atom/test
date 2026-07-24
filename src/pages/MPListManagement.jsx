import { useMemo, useState } from "react";
import Modal from "../components/Modal.jsx";
import { useI18n } from "../i18n.jsx";

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

export default function MPListManagement({ data = [], searchText = "" }) {
  const { t } = useI18n();
  const [selectedProcess, setSelectedProcess] = useState("");
  const [selectedMaint, setSelectedMaint] = useState("");
  const [selectedVersion, setSelectedVersion] = useState(null);

  const rows = Array.isArray(data) ? data : [];

  const processOptions = useMemo(() => {
    return [
      ...new Set(rows.map((row) => normalizeText(row?.process ?? row?.공정))),
    ]
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const maintenanceOptions = useMemo(() => {
    return [
      ...new Set(
        rows
          .filter(
            (row) =>
              !selectedProcess ||
              normalizeText(row?.process ?? row?.공정) === selectedProcess,
          )
          .map((row) =>
            normalizeText(row?.maintGroup ?? row?.보전파트 ?? row?.보전그룹),
          ),
      ),
    ]
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
  }, [rows, selectedProcess]);

  const filteredRows = useMemo(() => {
    const q = normalizeText(searchText).toLowerCase();

    return rows.filter((row) => {
      const processName = normalizeText(getRowValue(row, "process", "공정"));
      const maintName = normalizeText(
        getRowValue(row, "maintGroup", "보전파트", "보전그룹"),
      );
      const combined = Object.values(row ?? {})
        .map((value) => String(value ?? ""))
        .join(" ")
        .toLowerCase();

      const matchesProcess =
        !selectedProcess || processName === selectedProcess;
      const matchesMaint = !selectedMaint || maintName === selectedMaint;
      const matchesSearch = !q || combined.includes(q);

      return matchesProcess && matchesMaint && matchesSearch;
    });
  }, [rows, searchText, selectedMaint, selectedProcess]);

  const versionRows = useMemo(() => {
    const grouped = new Map();

    filteredRows.forEach((row, index) => {
      const date = getDateValue(getRowValue(row, "workedOn", "작업완료일"));
      const groupKey = `${selectedProcess}__${selectedMaint}__${date || "unknown"}`;
      const entry = grouped.get(groupKey) ?? {
        version: `v${grouped.size + 1}`,
        period: date || "-",
        rows: [],
        registeredBy: "Admin",
        editedBy: "Admin",
        registeredAt: date || new Date().toISOString().slice(0, 10),
        editedAt: date || new Date().toISOString().slice(0, 10),
      };

      entry.rows.push(row);
      entry.period = entry.period === "-" ? date : entry.period;
      grouped.set(groupKey, entry);
    });

    return [...grouped.values()]
      .map((entry, index) => ({
        ...entry,
        version: `v${index + 1}`,
        appliedCount: entry.rows.length,
        excludedCount: 0,
        equipmentIds: [
          ...new Set(
            entry.rows
              .map((row) =>
                normalizeText(getRowValue(row, "equipmentCode", "설비코드")),
              )
              .filter(Boolean),
          ),
        ],
        reviewLabel: entry.rows.length
          ? `${entry.rows.length}건 협의 이력`
          : "협의 이력 없음",
      }))
      .sort((a, b) =>
        (b.registeredAt || "").localeCompare(a.registeredAt || ""),
      );
  }, [filteredRows, selectedMaint, selectedProcess]);

  const showLanding = !selectedProcess || !selectedMaint;

  return (
    <section className="flex h-full flex-col overflow-hidden p-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-text-default">
            <i className="fas fa-list-check mr-2 text-brand-60" />
            MP List 관리
          </h1>
          <p className="mt-1 text-sm text-text-subtle">
            공정·보전파트별 저장된 MP List를 버전별로 관리합니다
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="btn-base bg-brand-60 text-white hover:bg-brand-70"
          >
            <i className="fas fa-code-compare mr-1" />
            MP 비교
          </button>
        </div>
      </div>

      <div className="card mb-6 p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold uppercase text-text-subtle">
              공정
            </label>
            <select
              className="input"
              style={{ width: 130 }}
              value={selectedProcess}
              onChange={(event) => {
                setSelectedProcess(event.target.value);
                setSelectedMaint("");
              }}
            >
              <option value="">선택하세요</option>
              {processOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-bold uppercase text-text-subtle">
              보전파트
            </label>
            <select
              className="input"
              style={{ width: 280 }}
              value={selectedMaint}
              onChange={(event) => setSelectedMaint(event.target.value)}
              disabled={!selectedProcess}
            >
              <option value="">선택하세요</option>
              {maintenanceOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {showLanding ? (
        <div className="flex flex-1 items-center justify-center rounded-2xl border border-border-base bg-surface-default">
          <div className="flex flex-col items-center px-6 py-10 text-center">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-brand-10 text-4xl text-brand-60">
              <i className="fas fa-list-check" />
            </div>
            <h3 className="text-lg font-bold text-text-default">
              공정 및 보전파트를 선택하세요
            </h3>
            <p className="mt-2 max-w-md text-sm text-text-subtle">
              필터에서 공정과 보전파트를 선택하면
              <br />
              저장된 MP List 버전 목록이 표시됩니다.
            </p>
          </div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table
            className="data-table"
            style={{ tableLayout: "fixed", width: "100%" }}
          >
            <colgroup>
              <col style={{ width: "4%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "18%" }} />
              <col style={{ width: "6%" }} />
              <col style={{ width: "6%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "10%" }} />
            </colgroup>
            <thead>
              <tr>
                <th>버전</th>
                <th>기간</th>
                <th>적용</th>
                <th>미적용</th>
                <th>설비ID</th>
                <th>협의</th>
                <th>등록자</th>
                <th>등록일시</th>
                <th>편집자</th>
                <th>편집일시</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {versionRows.map((version) => (
                <tr key={version.version}>
                  <td>{version.version}</td>
                  <td>{version.period}</td>
                  <td>{version.appliedCount}</td>
                  <td>{version.excludedCount}</td>
                  <td>{version.equipmentIds.join(", ") || "-"}</td>
                  <td>{version.reviewLabel}</td>
                  <td>{version.registeredBy}</td>
                  <td>{version.registeredAt}</td>
                  <td>{version.editedBy}</td>
                  <td>{version.editedAt}</td>
                  <td>
                    <button
                      type="button"
                      className="btn-base btn-ghost"
                      onClick={() => setSelectedVersion(version)}
                    >
                      보기
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={Boolean(selectedVersion)}
        onClose={() => setSelectedVersion(null)}
        title="MP List 조회"
        description={`${selectedProcess} · ${selectedMaint}`}
        maxWidth="1100px"
        footer={
          <button
            type="button"
            className="btn-base bg-brand-60 text-white hover:bg-brand-70"
            onClick={() => setSelectedVersion(null)}
          >
            {t("app.close")}
          </button>
        }
      >
        {selectedVersion && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-brand-10 px-3 py-1 text-xs font-bold text-brand-60">
                {selectedVersion.version}
              </span>
              <span className="text-sm text-text-subtle">
                기간: {selectedVersion.period}
              </span>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-border-base bg-surface-strong p-3">
                <div className="text-xs font-bold uppercase text-text-subtle">
                  설비 ID
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
                  협의 이력
                </div>
                <div className="mt-2 text-sm text-text-default">
                  {selectedVersion.reviewLabel}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border-base bg-surface-default">
              <table
                className="data-table"
                style={{ tableLayout: "fixed", width: "100%" }}
              >
                <thead>
                  <tr>
                    <th>대표 작업명</th>
                    <th>작업 목적</th>
                    <th>HW 변경 전</th>
                    <th>HW 변경 후</th>
                    <th>SW 변경 전</th>
                    <th>SW 변경 후</th>
                    <th>작업완료일</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedVersion.rows.map((row, index) => (
                    <tr key={getRowKey(row, index)}>
                      <td>
                        {normalizeText(
                          getRowValue(
                            row,
                            "representativeWork",
                            "대표작업명",
                            "대표 작업명",
                          ),
                        ) || "-"}
                      </td>
                      <td>
                        {normalizeText(getRowValue(row, "work", "작업목적")) ||
                          "-"}
                      </td>
                      <td>
                        {normalizeText(
                          getRowValue(row, "hwAsWas", "HW 변경 전"),
                        ) || "-"}
                      </td>
                      <td>
                        {normalizeText(
                          getRowValue(row, "hwAsIs", "HW 변경 후"),
                        ) || "-"}
                      </td>
                      <td>
                        {normalizeText(
                          getRowValue(row, "swAsWas", "SW 변경 전"),
                        ) || "-"}
                      </td>
                      <td>
                        {normalizeText(
                          getRowValue(row, "swAsIs", "SW 변경 후"),
                        ) || "-"}
                      </td>
                      <td>
                        {getDateValue(
                          getRowValue(row, "workedOn", "작업완료일"),
                        ) || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}
