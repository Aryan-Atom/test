# Software Requirements Specification (SRS) - Spec Matrix Feature

## 1. Introduction

### 1.1 Purpose
This document specifies the software requirements for the **Spec Matrix** (사양 매트릭스) feature of the Equipment Maintenance Management System. The Spec Matrix provides a dynamic, pivoted grid interface to analyze and compare equipment specification items and parameters across different versions.

### 1.2 Scope
The Spec Matrix enables engineering and maintenance personnel to view equipment-specific parameters (VIEW 1) and compare parameter variations across successive version releases (VIEW 2). It features automatic change detection, visual difference indicators, and filtering by process and maintenance type.

### 1.3 Definitions and Acronyms
- **SRS**: Software Requirements Specification
- **VIEW 1 (장비별 사양)**: Grid representation of equipment rows mapped against specification columns.
- **VIEW 2 (버전별 비교)**: Pivot layout displaying specification parameter rows mapped against version columns.
- **Change Indicators**: Visual markers (arrows or colored dots) denoting that a parameter value has changed compared to its previous version.

---

## 2. Functional Requirements

### 2.1 Filtering and Cascading Panel
The system must provide filter selections to dynamically restrict the specifications dataset:

- **Process Filter (공정)**: Single select dropdown. Displays processes with `isSpecData` set to true. Selecting a process is required to render either view.
- **Maintenance Type Filter (보전유형)**: Single select dropdown. Cascades from **Process**. Displays only maintenance groups where `isSpecData` is true and match the selected process. Disabled if no process is selected.
- **Version Filter (버전)**: Single select dropdown. Displays all unique versions present in the dataset, alongside an "All" (전체) option.
- **Changes Only Toggle (변경 항목만)**: Active in **VIEW 2** only. A switch component that, when enabled, filters the grid to display only rows that have variations in parameter values between successive versions.
- **Search Input (검색)**: Real-time search filter matching equipment name, spec name, or spec value (case-insensitive).

### 2.2 Dual View Architectures

#### 2.2.1 VIEW 1 — Equipment-specific Specifications (장비별 사양)
- **Grid Layout**:
  - **Y-Axis (Rows)**: Grouped and sorted list of pivoted combinations of Equipment ID (`equipmentCode`), Equipment Name, and Spec Version. Sorted by Equipment Name, Equipment Code, and version.
  - **X-Axis (Columns)**: Unique list of specification item names (`specName` / `사양항목`) present in the filtered dataset, sorted alphabetically.
- **Cells**: Render the value of the specification item (`specValue` / `사양값`) matching the row's equipment and version. Displays "—" if no value exists.

#### 2.2.2 VIEW 2 — Version-specific Comparison (버전별 비교)
- **Grid Layout**:
  - **Y-Axis (Rows)**: List of unique specification item names (`specName`), grouped by equipment.
  - **X-Axis (Columns)**: List of unique specification versions sorted using semantic version sorting rules.
- **Cells**: Render the parameter value for that version.
- **Change Highlight**:
  - If a row contains a value in version $V_n$ that differs from version $V_{n-1}$, the row must be highlighted with a soft red background (`row-changed`).

### 2.3 Difference Comparison Engine (VIEW 2)
For each cell in VIEW 2 (from index $i > 0$ of sorted versions), the system must compare the current value $C$ against the previous version's value $P$:

- **Numeric Comparison**:
  - If both $C$ and $P$ can be parsed as numbers (ignoring commas):
    - If $C > P$: Render a green up arrow indicator (▲) with a tooltip "Increase compared to previous" (이전 대비 증가).
    - If $C < P$: Render a red down arrow indicator (▼) with a tooltip "Decrease compared to previous" (이전 대비 감소).
- **String Comparison**:
  - If either $C$ or $P$ is non-numeric, and $C \neq P$:
    - Render a red pulsing circular indicator dot (●) with a tooltip "Modified from previous version" (이전 버전에서 변경됨).
- **First Version**:
  - The first version column ($i = 0$) has no predecessor and must not display any change indicators.

---

## 3. User Interface (UI) Requirements

### 3.1 Views and Tab Switcher
- The interface must display a tab header group at the top right to switch between **장비별 사양 (VIEW 1)** and **버전별 비교 (VIEW 2)**.
- Active tabs must display with indigo color borders and bold typography.

### 3.2 Badges and Counters
- **Total Rows Badge**: Displays the total count of pivoted rows currently displayed in the table.
- **Changed Rows Badge**: In VIEW 2, if any changes are detected, a red badge must show the count of modified specification items (e.g. `3 변경`).

### 3.3 Visual States & Animations
- **Highlighting**: Rows in VIEW 2 marked as changed must render with `rgba(239, 68, 68, 0.05)` background and transit to `rgba(239, 68, 68, 0.09)` on cursor hover.
- **Pulsing Dot**: The string change indicator must loop a scale/opacity animation to draw immediate user attention.
- **Skeleton Table**: Renders shimmering light gray bar layouts during dataset loading or filtering operations.
- **Empty States**: If no Process is selected, displays a floating circular microscope icon instructing users to select process and maintenance type.

---

## 4. Technical Design & Data Schema

### 4.1 Data Model
Each specification record object must conform to the following JSON schema:
```json
{
  "process": "03.성형",
  "maintGroup": "0307. ut coater",
  "equipmentName": "UT Coater 1",
  "equipmentCode": "EQ-UT01",
  "specName": "온도",
  "version": "1.0",
  "specValue": "61.1"
}
```

### 4.2 Version Sorting Rules (`vsort`)
Versions must be sorted semantically:
1. Strip leading "V" or "v" characters.
2. Split major, minor, and patch identifiers by dot (`.`) or hyphen (`-`).
3. Convert segments to integers and compare them in order: Major $\rightarrow$ Minor $\rightarrow$ Patch.
   - Example order: `1.0` $\rightarrow$ `1.1` $\rightarrow$ `1.2` $\rightarrow$ `2.0`.

### 4.3 Runtime Modes & APIs
- **Static Mode**: If `isStaticDataMode` is active, the app loads mock datasets from `static-data/SpecData.js`. If data content lacks specific parameter objects, it dynamically generates spec records for numeric (temperature, pressure, RPM, vibration) and textual (material, standards, certificates) types.
- **API Mode**: Fetches dataset from the `GET_SPEC_DATA` endpoint.

---

## 5. Non-Functional Requirements

### 5.1 Performance
- **Pivot Computations**: Grouping and pivoting list arrays into matrix grids must run inside `useMemo` blocks to keep rendering performance smooth (aiming for $\le 16\text{ms}$ calculation time).
- **Memory Footprint**: Redundant copies of large JSON structures must be avoided by garbage collecting unmounted view states.
