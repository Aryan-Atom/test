# System Specification: End-to-End Flow Diagram & Data Lifecycle

---

## 1. System Architecture & Workflow Diagram

This document illustrates the complete end-to-end operational flow of the EQUAL system—from initial multi-format file upload through AI narrative extraction, job monitoring, quarantine handling, master schema standardization, change history management, matrix heatmap visualization, and maintenance plan (MP) versioning.

```mermaid
flowchart TD
    subgraph STEP_1 [1. Multi-Format File Ingestion]
        A1[File Upload: PPT, Excel, PDF, PNG/JPG, EML] --> A2[AI Pipeline Import Action]
    end

    subgraph STEP_2 [2. Pre-Upload Configuration]
        A2 --> B1[AiPipelinePromptModal]
        B1 --> B2[Detected Columns Summary Report]
        B1 --> B3[Predefined System Prompt & Defined Change Points]
    end

    subgraph STEP_3 [3. AI Narrative Extraction Engine]
        B3 --> C1[GPT Opus 120B Inference Model]
        C1 --> C2[Domain Jargon Normalization]
        C1 --> C3[ISO Date & Equipment Alias Standardization]
    end

    subgraph STEP_4 [4. Extraction Verification & Routing]
        C3 --> D{Row Verification Check}
        D -->|Valid Report Content| E1[Jobs Execution Queue]
        D -->|Blank / Noise / Non-Content| E2[Quarantine Subsystem]
    end

    subgraph STEP_5 [5. Jobs & Quarantine Processing]
        E1 --> F1[Jobs Table\n4s Scoped Polling]
        F1 -->|Eye Icon Click| F2[Job Preview Modal\n22 Master Attributes Preview]

        E2 --> G1[Quarantine Table\nWHY Reason Pills]
        G1 -->|Restore Action| G2[Re-inject Row into Active Pool]
    end

    subgraph STEP_6 [6. Change History Data Workspace]
        F2 & G2 --> H1[Change History Data Grid]
        H1 --> H2[Header Actions: Import CSV / Export CSV & Excel]
        H1 --> H3[Targeted ZIP Export: POST /api/ChangeData/ExportZipByIds]
        H1 --> H4[Save Changes: POST /api/ChangeData/SaveChangedData]
        H4 -->|Auto-Trigger| H5[Event Listener: refreshChangeHistoryData]
    end

    subgraph STEP_7 [7. Change Matrix & MP Subsystems]
        H5 --> I1[Matrix Inquiry\n2D Heatmap & Photo Gallery]
        H5 --> I2[MP List Inquiry\nVersion Control & Row Revisions]
        H5 --> I3[MP List Management\nSpec Column Sequence Engine]
    end
```

---

## 2. Stage-by-Stage Operational Summary for QC Testing

| Stage # | Stage Name | System Action | QC Verification Expectation |
| :-: | :--- | :--- | :--- |
| **1** | **Multi-Format Ingestion** | Ingests `.xlsx`, `.csv`, `.pdf`, `.pptx`, `.png`, `.eml` files. | System accepts all 5 supported file types without rejection. |
| **2** | **Pre-Upload Report** | Displays column headers and editable prompt with Change Points. | Column summary tags match input file headers exactly. |
| **3** | **AI Extraction** | GPT Opus 120B maps text to 22 master schema columns. | Jargon normalized; dates converted to ISO-8601 (`YYYY-MM-DD`). |
| **4** | **Routing & Isolation** | Valid rows sent to Jobs; blank/noise sent to Quarantine. | Invalid/empty rows isolated without breaking the job run. |
| **5** | **Jobs & Quarantine** | 4s polling on Jobs; Restore action on Quarantine. | Polling active only on Jobs page; Restore returns row to pool. |
| **6** | **Change History Data** | 22-attribute grid editing, targeted ZIP export by IDs. | Selected checkbox IDs exported in ZIP package. |
| **7** | **Matrix & MP Modules** | Heatmap status badges, MP versioning, column sequence. | Column order strictly matches sequence numbers. |
