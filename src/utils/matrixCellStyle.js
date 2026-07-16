export const X_AXIS_MODE = {
  DATE: "date",
  REPRESENTATIVE_WORK_NAME: "task",
};

const IMPORTANT_PRIORITIES = new Set(["중요", "Important", "High"]);

export function isImportantPriority(priority) {
  return IMPORTANT_PRIORITIES.has(String(priority ?? "").trim());
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
  if (xAxisMode === X_AXIS_MODE.DATE) {
    return {
      backgroundColor: "transparent",
      color: "inherit",
    };
  }

  const hasImportantItem = items.some((item) => isImportantPriority(getPriority(item)));

  if (hasImportantItem) {
    return {
      backgroundColor: "var(--primary-soft)",
      color: "var(--primary)",
    };
  }

  return {
    backgroundColor: "transparent",
    color: "inherit",
  };
}

export function getDateModeItemStyle(items, getPriority, getRepresentativeWorkName) {
  const itemList = Array.isArray(items) ? items : [items].filter(Boolean);
  const importantItem = itemList.find((item) => isImportantPriority(getPriority(item)));

  if (!importantItem) {
    return {
      backgroundColor: "transparent",
      color: "inherit",
      fontWeight: 500,
      className: "",
    };
  }

  return {
    backgroundColor: getHashBasedHslColor(getRepresentativeWorkName(importantItem)),
    color: "var(--text-primary)",
    fontWeight: 700,
    className: "px-2 py-1 rounded-[6px] shadow-sm",
  };
}
