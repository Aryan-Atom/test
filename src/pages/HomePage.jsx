import { useEffect, useMemo, useState } from "react";
import { APIcallGet } from "../utils/api.js";
import { pocEndPoints } from "../axios/endPoints.js";
import { useI18n } from "../i18n.jsx";

function normalizeValue(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function pickFirst(row, keys) {
  for (const key of keys) {
    if (row?.[key] != null && String(row[key]).trim()) {
      return String(row[key]).trim();
    }
  }
  return "";
}

function countUniqueValues(rows, keys) {
  const seen = new Set();
  rows.forEach((row) => {
    const value = pickFirst(row, keys);
    if (value) seen.add(value);
  });
  return seen.size;
}

function HomePage({ changeData = [], specData = [], mpRows = [], onNavigate }) {
  const { t } = useI18n();
  const [activeStep, setActiveStep] = useState(0);
  const [stats, setStats] = useState({
    totalChanges: 0,
    totalEquip: 0,
    totalProc: 0,
    totalPart: 0,
  });

  useEffect(() => {
    APIcallGet(pocEndPoints.GET_HOME_STATS, {}, (responseData, status) => {
      if (status === 200 && responseData) {
        const payload = responseData?.data ?? responseData;
        const next = {
          totalChanges: Number(
            payload?.totalChanges ??
              payload?.total_change ??
              payload?.changeCount ??
              0,
          ),
          totalEquip: Number(
            payload?.totalEquip ??
              payload?.equipmentCount ??
              payload?.totalEquipment ??
              0,
          ),
          totalProc: Number(
            payload?.totalProc ??
              payload?.processCount ??
              payload?.totalProcess ??
              0,
          ),
          totalPart: Number(
            payload?.totalPart ??
              payload?.partCount ??
              payload?.totalMaintenancePart ??
              0,
          ),
        };

        if (Object.values(next).some((value) => value > 0)) {
          setStats(next);
        }
      }
    });
  }, []);

  const derivedStats = useMemo(() => {
    const totalChanges = Array.isArray(changeData) ? changeData.length : 0;
    const totalEquip = countUniqueValues(changeData, [
      "설비명",
      "설비ID",
      "EquipmentName",
      "EquipmentID",
      "equipmentName",
      "equipmentId",
      "equipName",
      "equipId",
    ]);
    const totalProc = countUniqueValues(changeData, [
      "공정",
      "Process",
      "ProcessName",
      "process",
      "processName",
    ]);
    const totalPart = countUniqueValues(changeData, [
      "보전파트",
      "MaintenancePart",
      "MaintenancePartName",
      "maintenancePart",
      "part",
      "partName",
    ]);

    return {
      totalChanges,
      totalEquip: totalEquip || specData.length || 0,
      totalProc:
        totalProc ||
        Math.max(
          1,
          new Set(
            specData.map((row) =>
              pickFirst(row, ["공정", "Process", "process"]),
            ),
          ).size,
        ),
      totalPart:
        totalPart ||
        Math.max(
          1,
          new Set(
            mpRows.map((row) =>
              pickFirst(row, ["보전파트", "MaintenancePart", "part"]),
            ),
          ).size,
        ),
    };
  }, [changeData, specData, mpRows]);

  const displayedStats = {
    totalChanges: stats.totalChanges || derivedStats.totalChanges,
    totalEquip: stats.totalEquip || derivedStats.totalEquip,
    totalProc: stats.totalProc || derivedStats.totalProc,
    totalPart: stats.totalPart || derivedStats.totalPart,
  };

  const steps = [
    {
      icon: "fa-file-alt",
      title: t("page.home.step1.title", "WO 원본"),
      desc: t(
        "page.home.step1.desc",
        "EMS 시스템에서 수집된 설비 작업 이력입니다. 보고서 형태의 비정형 데이터로, 자유롭게 작성된 텍스트입니다.",
      ),
      tone: "var(--primary)",
    },
    {
      icon: "fa-robot",
      title: t("page.home.step2.title", "분석 AI"),
      desc: t("page.home.step2.desc", "비정형 보고서 내용을 읽고 분석해서 정형화합니다."),
      tone: "var(--primary)",
    },
    {
      icon: "fa-puzzle-piece",
      title: t("page.home.step3.title", "클러스터링 AI"),
      desc: t(
        "page.home.step3.desc",
        "정형화한 내용을 분석해서 유사한 작업끼리 그룹으로 구분하고, 각 그룹에 대표 작업명을 작성합니다.",
      ),
      tone: "var(--primary)",
    },
    {
      icon: "fa-balance-scale",
      title: t("page.home.step4.title", "가치 판단 AI"),
      desc: t(
        "page.home.step4.desc",
        "해당 작업이 중요한지 일반인지, 효과 유형은 생산성·품질·보전성·기타 중 무엇인지 판단합니다.",
      ),
      tone: "var(--primary)",
    },
    {
      icon: "fa-check-circle",
      title: t("page.home.step5.title", "데이터 완료!"),
      desc: t(
        "page.home.step5.desc",
        "사용자가 변경 이력을 쉽게 파악할 수 있는 데이터가 준비되었습니다. 매트릭스와 리포트로 바로 확인해보세요.",
      ),
      tone: "oklch(0.55 0.17 155)",
    },
  ];

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveStep((current) => (current + 1) % steps.length);
    }, 6000);

    return () => window.clearInterval(timer);
  }, [steps.length]);

  const handleStepChange = (index) => {
    setActiveStep(index);
  };

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-[var(--bg-secondary)]">
      <div
        className="relative flex min-h-[240px] items-center justify-center px-8 py-7"
        style={{
          background:
            "linear-gradient(135deg, oklch(0.28 0.1 264), oklch(0.2 0.08 264))",
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 25% 40%, oklch(0.4 0.18 264/0.25), transparent 55%), radial-gradient(ellipse at 75% 60%, oklch(0.35 0.12 200/0.15), transparent 50%)",
          }}
        />
        <div className="relative z-10 max-w-3xl text-center">
          <div className="mb-5 inline-flex items-center gap-4">
            <div
              className="flex h-[52px] w-[52px] items-center justify-center rounded-[14px] shadow-lg"
              style={{
                background: "oklch(0.55 0.2 264)",
                boxShadow: "0 4px 20px oklch(0.45 0.2 264/0.4)",
              }}
            >
              <i className="fas fa-layer-group text-[1.5rem] text-white" />
            </div>
            <span className="text-[2rem] font-extrabold tracking-[3px] text-white">
              EQUAL
            </span>
          </div>
          <h2 className="mb-3 text-[1.25rem] font-bold tracking-[0.5px] text-[oklch(0.88_0.1_264)]">
            Equal Equipment, Ensured Quality!
          </h2>
          <p className="mx-auto max-w-[600px] text-[0.9rem] leading-8 text-[oklch(0.82_0.05_264)] whitespace-pre-line">
            {t(
              "page.home.subtitle",
              "EMS의 Work order(설비 작업 이력)를 AI가 분석해서,\n변경점을 한 눈에 확인할 수 있고, 차세대 설비 설계에도 반영할 수 있습니다.",
            )}
          </p>
        </div>
      </div>

      <div className="px-8 pt-5">
        <div className="grid grid-cols-4 gap-3" id="landingStats">
          {[
            {
              id: "lsTotalChanges",
              value: displayedStats.totalChanges,
              label: t("page.home.totalChanges", "총 변경 이력"),
              tone: "var(--primary)",
            },
            {
              id: "lsTotalEquip",
              value: displayedStats.totalEquip,
              label: t("page.home.totalEquip", "등록 설비"),
              tone: "oklch(0.55 0.17 155)",
            },
            {
              id: "lsTotalProc",
              value: displayedStats.totalProc,
              label: t("page.home.totalProc", "공정 수"),
              tone: "oklch(0.65 0.18 50)",
            },
            {
              id: "lsTotalPart",
              value: displayedStats.totalPart,
              label: t("page.home.totalPart", "보전파트 수"),
              tone: "oklch(0.55 0.15 280)",
            },
          ].map((stat) => (
            <div key={stat.id} className="card p-4 text-center">
              <div
                className="text-[1.5rem] font-extrabold"
                style={{ color: stat.tone }}
              >
                {stat.value}
              </div>
              <div
                className="mt-1 text-[0.7rem] font-semibold uppercase tracking-[0.5px]"
                style={{ color: "var(--muted-foreground)" }}
              >
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="px-8 pt-5">
        <h3 className="mb-2 text-center text-[1rem] font-bold text-[var(--text-primary)]">
          {t("page.home.keyFeatures", "주요 기능")}
        </h3>
        <div className="grid grid-cols-3 gap-3.5">
          <button
            type="button"
            className="card p-[18px] text-left"
            onClick={() => onNavigate("dm-change")}
          >
            <div className="mb-3 flex h-[42px] w-[42px] items-center justify-center rounded-[10px] bg-[oklch(0.45_0.2_264/0.1)]">
              <i className="fas fa-database text-[1rem] text-[var(--primary)]" />
            </div>
            <div className="mb-1 text-[0.9375rem] font-bold text-[var(--text-primary)]">
              {t("nav.changeHistory", "변경 이력 데이터")}
            </div>
            <div className="text-[0.8rem] leading-6 text-[var(--text-secondary)]">
              {t(
                "page.home.changeHistoryDesc",
                "설비별 작업 이력을 테이블로 관리하고, CSV/Excel로 내보낼 수 있습니다.",
              )}
            </div>
          </button>

          <button
            type="button"
            className="card landing-pulse p-[22px] text-left"
            onClick={() => onNavigate("mx-matrix")}
          >
            <div className="mb-3 flex h-[42px] w-[42px] items-center justify-center rounded-[10px] bg-[oklch(0.55_0.17_155/0.1)]">
              <i className="fas fa-th text-[1rem] text-[oklch(0.55_0.17_155)]" />
            </div>
            <div className="mb-1 text-[0.9375rem] font-bold text-[var(--text-primary)]">
              {t("nav.matrix", "변경 매트릭스")}
            </div>
            <div className="text-[0.8rem] leading-6 text-[var(--text-secondary)]">
              {t(
                "page.home.changeMatrixDesc",
                "설비×작업 이력을 매트릭스로 시각화하여 횡전개를 관리하고, 설비 산포를 개선합니다.",
              )}
            </div>
          </button>

          <button
            type="button"
            className="card p-[18px] text-left"
            onClick={() => onNavigate("mx-mplist")}
          >
            <div className="mb-3 flex h-[42px] w-[42px] items-center justify-center rounded-[10px] bg-[oklch(0.65_0.18_50/0.1)]">
              <i className="fas fa-clipboard-list text-[1rem] text-[oklch(0.65_0.18_50)]" />
            </div>
            <div className="mb-1 text-[0.9375rem] font-bold text-[var(--text-primary)]">
              {t("nav.mpList", "MP List")}
            </div>
            <div className="text-[0.8rem] leading-6 text-[var(--text-secondary)]">
              {t(
                "page.home.mpListDesc",
                "설비 변경 이력을 리포트로 저장 및 관리해서 다음 설계에 반영합니다.",
              )}
            </div>
          </button>
        </div>
      </div>

      <div className="px-8 py-5">
        <h3 className="mb-3 text-center text-[1rem] font-bold text-[var(--text-primary)]">
          {t("page.home.aiProcessTitle", "✨ AI가 데이터를 만드는 과정")}
        </h3>
        <div
          className="mb-3 flex items-center justify-center gap-0"
          id="aiPipeline"
        >
          {steps.map((step, index) => (
            <div key={`${step.title}-${index}`} className="flex items-center">
              <button
                type="button"
                onClick={() => handleStepChange(index)}
                className={`ai-step ${activeStep === index ? "active" : ""} flex w-[110px] flex-col items-center gap-2 rounded-[12px] border px-2 py-3 text-center`}
                style={{
                  background: "var(--bg-card)",
                  borderColor: "var(--border)",
                  opacity: activeStep === index ? 1 : 0.85,
                }}
              >
                <div
                  className="flex h-[36px] w-[36px] items-center justify-center rounded-[10px]"
                  style={{ background: "oklch(0.55 0.2 264/0.12)" }}
                >
                  <i
                    className={`fas ${step.icon}`}
                    style={{ color: step.tone, fontSize: ".95rem" }}
                  />
                </div>
                <div className="text-[0.75rem] font-bold text-[var(--text-primary)]">
                  {step.title}
                </div>
              </button>
              {index < steps.length - 1 && (
                <div
                  className="ai-arrow mx-[2px] mb-[18px] h-[2px] w-[28px] rounded-[1px]"
                  style={{ background: "oklch(0.55 0.2 264/0.2)" }}
                />
              )}
            </div>
          ))}
        </div>

        <div className="card min-h-[70px] p-4" id="aiDescArea">
          {steps.map((step, index) => (
            <div
              key={`${step.title}-${index}`}
              className="ai-desc flex items-start gap-2.5"
              style={{ display: index === activeStep ? "flex" : "none" }}
            >
              <i
                className={`fas ${step.icon}`}
                style={{ color: step.tone, marginTop: 2 }}
              />
              <div>
                <div className="mb-1 text-[0.85rem] font-bold text-[var(--text-primary)]">
                  {step.title}
                </div>
                <div className="text-[0.78rem] leading-6 text-[var(--text-secondary)]">
                  {step.desc}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="px-8 pb-8">
        <h3 className="mb-2 text-center text-[1rem] font-bold text-[var(--text-primary)]">
          {t("page.home.guideTitle", "사용 가이드")}
        </h3>
        <div className="grid grid-cols-3 gap-3.5">
          {[
            {
              index: "1",
              title: t("page.home.guide1.title", "공정 선택"),
              desc: t("page.home.guide1.desc", "필터에서 공정을 선택합니다"),
              tone: "var(--primary)",
            },
            {
              index: "2",
              title: t("page.home.guide2.title", "보전파트 선택"),
              desc: t("page.home.guide2.desc", "해당 보전파트를 선택합니다"),
              tone: "oklch(0.55 0.17 155)",
            },
            {
              index: "3",
              title: t("page.home.guide3.title", "매트릭스 확인"),
              desc: t("page.home.guide3.desc", "변경 이력 매트릭스를 확인합니다"),
              tone: "oklch(0.65 0.18 50)",
            },
          ].map((item) => (
            <div key={item.index} className="card p-3.5 text-center">
              <div
                className="mb-2 inline-flex h-[34px] w-[34px] items-center justify-center rounded-full text-[0.85rem] font-bold text-white"
                style={{ background: item.tone }}
              >
                {item.index}
              </div>
              <div className="mb-1 text-[0.85rem] font-semibold text-[var(--text-primary)]">
                {item.title}
              </div>
              <div className="text-[0.75rem] text-[var(--text-secondary)]">
                {item.desc}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default HomePage;
