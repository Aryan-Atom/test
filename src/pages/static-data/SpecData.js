// change data columns

export const specDataColumns = [
  {
    id: 24,
    columnNameKr: "공정",
    sequence: 1,
    pageType: 2,
    isActive: true,
    isMasterData: true,
    excelColumnName: "공정",
    jsonKey: "process",
  },
  {
    id: 28,
    columnNameKr: "현장",
    sequence: 2,
    pageType: 2,
    isActive: true,
    isMasterData: true,
    excelColumnName: "site",
    jsonKey: "site",
  },
  {
    id: 25,
    columnNameKr: "보전타입",
    sequence: 3,
    pageType: 2,
    isActive: true,
    isMasterData: true,
    excelColumnName: "보전타입",
    jsonKey: "maintGroup",
  },
  {
    id: 29,
    columnNameKr: "설비코드",
    sequence: 4,
    pageType: 2,
    isActive: true,
    isMasterData: true,
    excelColumnName: "설비코드",
    jsonKey: "equipmentCode",
  },
  {
    id: 30,
    columnNameKr: "설비명",
    sequence: 5,
    pageType: 2,
    isActive: true,
    isMasterData: true,
    excelColumnName: "설비명",
    jsonKey: "equipmentName",
  },
  {
    id: 26,
    columnNameKr: "버전",
    sequence: 6,
    pageType: 2,
    isActive: true,
    isMasterData: false,
    excelColumnName: "버전",
    jsonKey: "version",
  },
  {
    id: 31,
    columnNameKr: "검수 항목(단위)",
    sequence: 7,
    pageType: 2,
    isActive: true,
    isMasterData: false,
    excelColumnName: "검수 항목(단위) ",
    jsonKey: "specName",
  },
  {
    id: 32,
    columnNameKr: "Spec.",
    sequence: 8,
    pageType: 2,
    isActive: true,
    isMasterData: false,
    excelColumnName: "Spec.",
    jsonKey: "specValue",
  },
];

export const specFilterDataAndTableData = {
  process: [
    {
      id: 7,
      processName: "04.성형",
    },
    {
      id: 8,
      processName: "03.성형",
    },
  ],
  site: [
    {
      id: 18,
      siteName: "d3.부산",
      processId: 7,
    },
    {
      id: 19,
      siteName: "a3.부산",
      processId: 8,
    },
    {
      id: 22,
      siteName: "",
      processId: 8,
    },
  ],
  category: [
    {
      id: 5,
      categoryName: "보전성",
    },
    {
      id: 6,
      categoryName: "품질",
    },
  ],
  priority: [
    {
      id: 1,
      priorityName: "중요",
    },
  ],
  maintenance: [
    {
      id: 20,
      maintenanceGroupName: "1307. ut coater",
      processId: 7,
    },
    {
      id: 21,
      maintenanceGroupName: "0307. ut coater",
      processId: 8,
    },
  ],
  equipments: [
    {
      id: 78,
      equipmentName: "coater(ut2)_it___ut20k",
      equipmentCode: "e2101741",
      processId: 7,
    },
    {
      id: 79,
      equipmentName: "coater(ut)_전장___ut103",
      equipmentCode: "e1800379",
      processId: 8,
    },
    {
      id: 82,
      equipmentName: "",
      equipmentCode: "",
      processId: 8,
    },
  ],
  representations: [
    {
      id: 80,
      representativeWorkName: "펌프 배선 플렉시블 관 적용",
      processId: 7,
      siteId: 18,
      maintenanceGroupId: 20,
    },
    {
      id: 81,
      representativeWorkName: "3기어 펌프 교체",
      processId: 8,
      siteId: 19,
      maintenanceGroupId: 21,
    },
  ],
  specDataJson: [
    {
      id: 8,
      content:
        '[{"id": 0, "site": "", "process": "03.성형", "version": "1.2", "specName": "", "specValue": "", "maintGroup": "0307. ut coater", "equipmentCode": "", "equipmentName": ""}, {"id": 0, "site": "", "process": "03.성형", "version": "1.2", "specName": "", "specValue": "", "maintGroup": "0307. ut coater", "equipmentCode": "", "equipmentName": ""}, {"id": 0, "site": "", "process": "03.성형", "version": "1.2", "specName": "", "specValue": "", "maintGroup": "0307. ut coater", "equipmentCode": "", "equipmentName": ""}, {"id": 0, "site": "", "process": "03.성형", "version": "1.2", "specName": "", "specValue": "", "maintGroup": "0307. ut coater", "equipmentCode": "", "equipmentName": ""}, {"id": 0, "site": "", "process": "03.성형", "version": "1.2", "specName": "", "specValue": "", "maintGroup": "0307. ut coater", "equipmentCode": "", "equipmentName": ""}]',
    },
  ],
};

export default {
  specDataColumns,
  specFilterDataAndTableData,
};
