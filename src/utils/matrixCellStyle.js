export const X_AXIS_MODE = {
  DATE: "date",
  REPRESENTATIVE_WORK_NAME: "task",
};

const REQUIRED_PRIORITIES = new Set(["필수", "Required", "Essential", "1"]);
const IMPORTANT_PRIORITIES = new Set(["중요", "Important", "High", "2"]);
const EXCLUDED_PRIORITIES = new Set(["제외", "Excluded", "Ignore", "4"]);

export function normalizePriority(priority) {
  const str = String(priority ?? "").trim();
  if (REQUIRED_PRIORITIES.has(str)) return "필수";
  if (IMPORTANT_PRIORITIES.has(str)) return "중요";
  if (EXCLUDED_PRIORITIES.has(str)) return "제외";
  return "일반";
}

export function getPriorityRank(priority) {
  const norm = normalizePriority(priority);
  if (norm === "필수") return 1;
  if (norm === "중요") return 2;
  if (norm === "일반") return 3;
  if (norm === "제외") return 4;
  return 3;
}

export function isImportantPriority(priority) {
  const norm = normalizePriority(priority);
  return norm === "필수" || norm === "중요";
}

export function getHashBasedHslColor(representativeWorkName) {
  const name = String(representativeWorkName ?? "");
  let h = 0;

  for (let i = 0; i < name.length; i++) {
    h = ((h << 5) - h) + name.charCodeAt(i);
    h = h | 0;
  }

  const hue = ((h % 360) + 360) % 360;
  return `hsl(${hue}, 65%, 82%)`;
}

export function getCellStyle(items, xAxisMode, getPriority = (item) => item?.priority) {
  return {
    backgroundColor: "transparent",
    color: "inherit",
  };
}

export function getDateModeItemStyle(items, getPriority = (item) => item?.priority, getRepresentativeWorkName = (item) => item?.representativeWork) {
  const itemList = Array.isArray(items) ? items : [items].filter(Boolean);
  if (itemList.length === 0) {
    return {
      style: {},
      className: "",
      backgroundColor: "transparent",
      color: "inherit",
      fontWeight: "normal",
    };
  }

  let highestItem = itemList[0];
  let highestRank = getPriorityRank(getPriority(highestItem));

  for (let i = 1; i < itemList.length; i++) {
    const rank = getPriorityRank(getPriority(itemList[i]));
    if (rank < highestRank) {
      highestRank = rank;
      highestItem = itemList[i];
    }
  }

  const normPri = normalizePriority(getPriority(highestItem));
  const taskName = getRepresentativeWorkName(highestItem);
  const hashColor = getHashBasedHslColor(taskName);

  if (normPri === "필수") {
    return {
      normPriority: "필수",
      style: {
        backgroundColor: hashColor,
        color: "var(--text-primary, #0f172a)",
        fontWeight: 700,
        border: "none",
      },
      className: "px-2 py-1 rounded-[6px] shadow-sm font-bold",
      backgroundColor: hashColor,
      color: "var(--text-primary, #0f172a)",
      fontWeight: 700,
      border: "none",
    };
  }

  if (normPri === "중요") {
    return {
      normPriority: "중요",
      style: {
        backgroundColor: "transparent",
        color: "var(--text-primary, #0f172a)",
        border: `2px solid ${hashColor}`,
        borderRadius: "4px",
        fontWeight: "normal",
      },
      className: "px-2 py-1 rounded-[4px]",
      backgroundColor: "transparent",
      color: "var(--text-primary, #0f172a)",
      border: `2px solid ${hashColor}`,
      borderRadius: "4px",
      fontWeight: "normal",
    };
  }

  if (normPri === "제외") {
    return {
      normPriority: "제외",
      style: {
        backgroundColor: "transparent",
        color: "var(--text-muted, #94a3b8)",
        border: "none",
        fontWeight: "normal",
      },
      className: "px-2 py-1 rounded-[6px]",
      backgroundColor: "transparent",
      color: "var(--text-muted, #94a3b8)",
      fontWeight: "normal",
      border: "none",
    };
  }

  // 일반 (Normal)
  return {
    normPriority: "일반",
    style: {
      backgroundColor: "transparent",
      color: "inherit",
      border: "none",
      fontWeight: "normal",
    },
    className: "px-2 py-1 rounded-[6px]",
    backgroundColor: "transparent",
    color: "inherit",
    fontWeight: "normal",
    border: "none",
  };
}

