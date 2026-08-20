import { normalizePriority } from "./matrixCellStyle.js";

export function getPriorityLabel(priority, t) {
  if (!priority) return "";
  const str = String(priority).trim();
  const norm = normalizePriority(str);

  if (norm === "필수") return t("priority.required", "필수");
  if (norm === "중요") return t("priority.important", "중요");
  if (norm === "제외") return t("priority.excluded", "제외");
  if (norm === "일반") return t("priority.normal", "일반");

  if (str === "정보 없음" || str.toLowerCase() === "no info" || str.toLowerCase() === "no information") {
    return t("app.noInfo", "정보 없음");
  }

  return t(`priority.${str}`, str);
}

export function getCategoryLabel(category, t) {
  if (!category) return "";
  const str = String(category).trim();

  if (str === "보전성" || str.toLowerCase() === "maintenance") return t("category.maintenance", "보전성");
  if (str === "품질" || str.toLowerCase() === "quality") return t("category.quality", "품질");
  if (str === "생산성" || str.toLowerCase() === "productivity") return t("category.productivity", "생산성");
  if (str === "기타" || str.toLowerCase() === "etc" || str.toLowerCase() === "other") return t("category.etc", "기타");
  if (str === "정보 없음" || str.toLowerCase() === "no info" || str.toLowerCase() === "no information") {
    return t("app.noInfo", "정보 없음");
  }

  return t(`category.${str}`, str);
}
