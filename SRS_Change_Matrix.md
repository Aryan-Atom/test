# Software Requirements Specification (SRS) - Change Matrix Feature

## 1. Introduction

### 1.1 Purpose
This document specifies the software requirements for the **Change Matrix** feature of the Equipment Maintenance Management System. The Change Matrix is designed to provide a highly interactive, pivoted grid visualization for analyzing, tracking, and batch-modifying equipment task histories and changes.

### 1.2 Scope
The Change Matrix allows engineering and maintenance teams to filter historical task records across processes, maintenance groups, sites, and periods, and visualize them by Date or by Representative Task name. It supports cell details inspection and inline batch updates (Find & Replace) for tasks, priorities, and category attributes.

### 1.3 Definitions and Acronyms
- **SRS**: Software Requirements Specification
- **CRS**: Component Requirement Specification (or Jira Epic-level requirement container)
- **Representative Task (대표작업명)**: A standardized, aggregated name representing one or more individual low-level maintenance activities.
- **Priority (중요도)**: Categorization of the task criticality (e.g., Important/중요, Normal/일반).
- **Category / Effect Type (효과유형)**: The business domain impacted by the maintenance task (e.g., Productivity/생산성, Quality/품질, Maintenance/보전성, Others/기타).

---

## 2. Functional Requirements

### 2.1 Filtering and Cascading Logic
The system must provide an interactive, cascading filter panel to scope down records before presenting them in the matrix grid.

- **Process Filter (공정)**: Single select dropdown. Populate options from all records whose process matches allowed items where `isChangedData` is true. Selecting a process is required to render the matrix.
- **Maintenance Group Filter (보전파트)**: Single select dropdown. Cascades from **Process**. Once a process is selected, this filter must display only the maintenance groups corresponding to the selected process. If a process has only one maintenance group, it is auto-selected.
- **Site Filter (법인)**: Single select dropdown. Cascades from **Process** and **Maintenance Group**. Displays sites where matching records exist. If only one site matches, it is auto-selected.
- **Representative Work Filter (대표 작업명)**: Single select dropdown. Displays unique representative task names within the filtered dataset.
- **Priority Filter (중요도)**: Multi-select checkbox dropdown. Filters records by priority levels.
- **Category Filter (효과유형)**: Multi-select checkbox dropdown. Filters records by categories.
- **Date/Period Filter (기간)**: Double date-picker input (Start Date & End Date) to filter worked-on dates. A reset button (X) must be displayed to clear date range selection.
- **Search Input (검색)**: Free-text input search across all record attributes.

### 2.2 Pivot Grid and X-Axis Modes
The matrix grid must support two distinct visualization modes toggled via a header group button:

#### 2.2.1 Date Mode (`mode = "date"`)
- **Y-Axis**: Grouped list of unique equipments (Equipment Code + Equipment Name), sorted alphabetically by Equipment Name.
- **X-Axis**: List of unique worked-on dates (`workedOn`) from the filtered records, sorted chronologically.
- **Cells**: Displays the representative tasks executed for each equipment on the corresponding date.
  - If multiple tasks were executed on the same day for the same equipment, cells must list all of them in a vertically stacked layout.
  - Cell background styling is determined dynamically by the priority of the task.

#### 2.2.2 Task Mode (`mode = "task"`)
- **Y-Axis**: Grouped list of unique equipments, sorted alphabetically.
- **X-Axis**: Unique Representative Tasks from the filtered records, sorted in descending order of their latest worked-on date (most recent task first).
- **Cells**: Displays the date(s) when the task was executed on the corresponding equipment.
- **Column Completion Rate (대표작업별 적용률)**:
  - Column headers in Task Mode must calculate and display a completion/applying rate.
  - Formula:
    $$\text{Completion Rate} = \left( \frac{\text{Count of Equipments that have executed this task}}{\text{Total Count of filtered Equipments}} \right) \times 100$$
  - The calculated percentage must display with one decimal place.

### 2.3 Find & Replace Modal (Batch Update)
The system must support batch editing of representative task names and their associated attributes.

- **Triggers**: Click on the edit icon (pencil) in column headers or cell corner overlays.
- **Scope**: Applied to all records in the currently selected **Process** and **Maintenance Group** that match the "Before" Representative Task.
- **Form Controls**:
  - **Before (변경 전)**: Displays the target representative task name to be modified.
    - Read-only field.
    - If a cell contains multiple representative tasks, a dropdown must be shown listing them to allow the user to select the specific task to modify.
  - **After (변경 후)**: Text input field. Displays autocomplete suggestions matching existing representative task names from a datalist.
  - **Priority (중요도)**: Dropdown selection (Change to "중요", "일반", or keep "No Change").
  - **Category / Effect Type (효과 유형)**: Dropdown selection (Change to "생산성", "품질", "보전성", "기타", or keep "No Change").
- **Verification & Confirmation**: Displays an alert banner highlighting that the update will affect **all matching records** under the current process and maintenance group.
- **Operations**: Triggers API calls to persist changes, followed by reloading filter and matrix datasets.

### 2.4 Details Panel Integration
Clicking on a populated grid cell must trigger a callback (`onOpenDetail`) passing all matching raw record objects for the cell intersection. This allows the host application to display a detailed list of individual change tickets or work logs in a drawer or modal.

---

## 3. User Interface (UI) Requirements

### 3.1 Layout and Styling
- **Sticky Layout**: The table must maintain sticky position for table headers (`thead`) on vertical scroll, and sticky positions for the first two columns (Equipment Code & Equipment Name) on horizontal scroll to preserve context.
- **Cell Styling**:
  - Cells must have hover scale-up effects ($1.04\times$) with subtle shadows to indicate interactivity.
  - In Date Mode, individual task blocks must be styled with customized background colors matching the priority of the task.
- **Interactive States**:
  - Row highlight: Hovering over any cell highlights the entire equipment row.
  - Column headers: Edit icons must fade in on hover.

### 3.2 Loading and Empty States
- **Landing State**: When no Process is selected, displays a clean landing interface instructing the user to select a Process and Maintenance Group.
- **Skeleton Loader**: While filtering is active, a skeleton matrix table with shimmer effects must be shown to ensure a responsive feeling.
- **Empty Grid State**: If filters yield no results, displays an empty inbox icon and message suggesting filter adjustments.

---

## 4. Technical Design & Data Schema

### 4.1 Data Model
Each change record object must conform to the following schema structure:
```json
{
  "id": 123,
  "process": "03.성형",
  "maintGroup": "0307. ut coater",
  "site": "BMS",
  "equipmentCode": "EQ-001",
  "equipmentName": "Coater A",
  "workedOn": "2026-06-15",
  "representativeWork": "Coating Slot Die Check",
  "priority": "중요",
  "category": "생산성"
}
```

### 4.2 API Integration
The feature must support two runtime modes: Static Mode (loading offline mock datasets) and API Mode (making Axios calls).

- **GET_FILTER_DATA**:
  - Endpoint: `GET_FILTER_DATA`
  - Payload: None
  - Response: Object containing `changedDataJson` list. The client parses the `content` field string if necessary.
- **SAVE_DATA_CHANGES**:
  - Endpoint: `SAVE_DATA_CHANGES`
  - Method: `POST`
  - Payload: `{ changeDataList: Array, id: number }`
- **UPDATE_REPRESENTATIVE_WORK**:
  - Endpoint: `UPDATE_REPRESENTATIVE_WORK`
  - Method: `POST`
  - Payload: `{ id: number, name: string }` (Invoked when a representative task name is updated in the database).

---

## 5. Non-Functional Requirements

### 5.1 Performance
- **React Rendering Optimization**: The pivot calculations (X/Y coordinate mappings) must run inside `useMemo` hooks, keyed by filter states, to prevent redundant execution on every state update.
- **Component Memoization**: List rows must be optimized to prevent micro-lagging in tables rendering more than 100 equipment rows.

### 5.2 Accessibility
- Elements like interactive buttons, filters, and input fields must support keyboard focus outlines and explicit labeling.
- Tooltips must be provided on abbreviations or icons (e.g. read-only lock, edit pencil).
