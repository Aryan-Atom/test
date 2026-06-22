import { openDB } from "idb";

const DB_NAME = "ExcelImportPreviewDB";
const DEFAULT_STORE = "preview_rows";
const DB_VERSION = 2;

export async function initDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("preview_rows")) {
        db.createObjectStore("preview_rows");
      }
      if (!db.objectStoreNames.contains("spec_preview_rows")) {
        db.createObjectStore("spec_preview_rows");
      }
    },
  });
}

/**
 * Clear all records in the specified preview store
 */
export async function clearPreviewRows(storeName = DEFAULT_STORE) {
  const db = await initDB();
  await db.clear(storeName);
}

/**
 * Overwrite the specified preview store with a new list of rows
 * @param {Array} rows
 * @param {string} storeName
 */
export async function savePreviewRows(rows, storeName = DEFAULT_STORE) {
  const db = await initDB();
  const tx = db.transaction(storeName, "readwrite");
  const store = tx.objectStore(storeName);
  await store.clear();
  for (let i = 0; i < rows.length; i++) {
    await store.put(rows[i], i);
  }
  await tx.done;
}

/**
 * Retrieve all preview rows from the specified store ordered by their index keys
 * @param {string} storeName
 * @returns {Promise<Array>}
 */
export async function getAllPreviewRows(storeName = DEFAULT_STORE) {
  const db = await initDB();
  const tx = db.transaction(storeName, "readonly");
  const store = tx.objectStore(storeName);
  const rows = [];
  let cursor = await store.openCursor();
  while (cursor) {
    rows.push(cursor.value);
    cursor = await cursor.continue();
  }
  return rows;
}

/**
 * Update a specific row in the specified preview store
 * @param {number} index
 * @param {object} row
 * @param {string} storeName
 */
export async function updatePreviewRow(index, row, storeName = DEFAULT_STORE) {
  const db = await initDB();
  await db.put(storeName, row, index);
}

/**
 * Delete a specific row and shift subsequent keys in the specified store
 * @param {number} index
 * @param {number} totalCount
 * @param {string} storeName
 */
export async function deletePreviewRow(index, totalCount, storeName = DEFAULT_STORE) {
  const db = await initDB();
  const tx = db.transaction(storeName, "readwrite");
  const store = tx.objectStore(storeName);
  for (let i = index; i < totalCount - 1; i++) {
    const nextRow = await store.get(i + 1);
    if (nextRow !== undefined) {
      await store.put(nextRow, i);
    }
  }
  await store.delete(totalCount - 1);
  await tx.done;
}
