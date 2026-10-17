/* IndexedDB storage layer */
(() => {
  "use strict";
  const DB_NAME = "FoodWalkNotebook";
  const DB_VERSION = 1;
  let dbPromise;

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("records")) {
          const store = db.createObjectStore("records", { keyPath: "id" });
          store.createIndex("visitDate", "visitDate", { unique: false });
          store.createIndex("postStatus", "postStatus", { unique: false });
          store.createIndex("shopName", "shopName", { unique: false });
        }
        if (!db.objectStoreNames.contains("settings")) {
          db.createObjectStore("settings", { keyPath: "key" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("データベースを開けませんでした。"));
    });
    return dbPromise;
  }

  async function requestResult(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("データ操作に失敗しました。"));
    });
  }

  async function getAllRecords() {
    const db = await openDb();
    return requestResult(db.transaction("records", "readonly").objectStore("records").getAll());
  }
  async function getRecord(id) {
    const db = await openDb();
    return requestResult(db.transaction("records", "readonly").objectStore("records").get(id));
  }
  async function putRecord(record) {
    const db = await openDb();
    return requestResult(db.transaction("records", "readwrite").objectStore("records").put(record));
  }
  async function deleteRecord(id) {
    const db = await openDb();
    return requestResult(db.transaction("records", "readwrite").objectStore("records").delete(id));
  }
  async function getSetting(key) {
    const db = await openDb();
    const value = await requestResult(db.transaction("settings", "readonly").objectStore("settings").get(key));
    return value ? value.value : undefined;
  }
  async function putSetting(key, value) {
    const db = await openDb();
    return requestResult(db.transaction("settings", "readwrite").objectStore("settings").put({ key, value }));
  }
  async function replaceAllRecords(records) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("records", "readwrite");
      const store = tx.objectStore("records");
      store.clear();
      for (const record of records) store.put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error("復元に失敗しました。"));
      tx.onabort = () => reject(tx.error || new Error("復元が中断されました。"));
    });
  }
  async function deleteAllRecords() {
    const db = await openDb();
    return requestResult(db.transaction("records", "readwrite").objectStore("records").clear());
  }

  window.FoodDB = { openDb, getAllRecords, getRecord, putRecord, deleteRecord, getSetting, putSetting, replaceAllRecords, deleteAllRecords };
})();
