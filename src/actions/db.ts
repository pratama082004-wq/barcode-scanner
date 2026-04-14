"use client"; // Kita ubah jadi client karena pakai LocalStorage

// Kita matikan revalidatePath dan Prisma karena ini mode darurat
const triggerRefresh = () => {
  if (typeof window !== 'undefined') {
    // Memberi sinyal UI kalau ada perubahan (opsional)
    window.dispatchEvent(new Event("db_mock_updated"));
  }
};

// ==========================================
// HELPERS LOCALSTORAGE (PENGGANTI MYSQL)
// ==========================================
const getDB = (key: string) => {
  if (typeof window === 'undefined') return [];
  return JSON.parse(localStorage.getItem(key) || "[]");
};

const setDB = (key: string, data: any) => {
  if (typeof window !== 'undefined') localStorage.setItem(key, JSON.stringify(data));
};

const getSet = () => {
  if (typeof window === 'undefined') return {};
  return JSON.parse(localStorage.getItem("winteq_mock_settings") || "{}");
};

const setSet = (data: any) => {
  if (typeof window !== 'undefined') localStorage.setItem("winteq_mock_settings", JSON.stringify(data));
};

// ==========================================
// 1. FUNGSI PENGATURAN
// ==========================================
export async function getSettings() {
  return getSet();
}

export async function saveSetting(key: string, value: any) {
  const s = getSet();
  s[key] = value;
  setSet(s);
  triggerRefresh();
}

// ==========================================
// 2. FUNGSI DATA SCAN UTAMA
// ==========================================
export async function getAllScans(workspace: string = "Main Log") {
  const scans = getDB("winteq_mock_scans");
  return scans
    .filter((s: any) => s.workspace === workspace)
    .sort((a: any, b: any) => b.timestamp_diterima - a.timestamp_diterima);
}

export async function upsertScanData(item: any) {
  let scans = getDB("winteq_mock_scans");
  const idx = scans.findIndex((s: any) => s.id === item.id);
  const cleanItem = { ...item, workspace: item.workspace || "Main Log" };
  
  if (idx > -1) scans[idx] = cleanItem;
  else scans.unshift(cleanItem); // unshift biar di atas
  
  setDB("winteq_mock_scans", scans);
  triggerRefresh();
}

export async function deleteScanData(id: string) {
  let scans = getDB("winteq_mock_scans");
  scans = scans.filter((s: any) => s.id !== id);
  setDB("winteq_mock_scans", scans);
  triggerRefresh();
}

export async function bulkDeleteScans(ids: string[]) {
  let scans = getDB("winteq_mock_scans");
  scans = scans.filter((s: any) => !ids.includes(s.id));
  setDB("winteq_mock_scans", scans);
  triggerRefresh();
}

// ==========================================
// 3. FUNGSI HISTORY ACTIVITY
// ==========================================
export async function getHistoryLogs(workspace: string = "Main Log") {
  let logs = getDB("winteq_mock_history");
  if (workspace !== "ALL") logs = logs.filter((l: any) => l.workspace === workspace);
  return logs.sort((a: any, b: any) => b.timestamp - a.timestamp).slice(0, 100);
}

export async function saveHistoryLog(entry: any) {
  let logs = getDB("winteq_mock_history");
  logs.unshift({ ...entry, workspace: entry.workspace || "Main Log" });
  setDB("winteq_mock_history", logs);
  triggerRefresh();
}

export async function clearHistoryLogs(workspace: string = "Main Log") {
  let logs = getDB("winteq_mock_history");
  if (workspace !== "ALL") logs = logs.filter((l: any) => l.workspace !== workspace);
  else logs = [];
  setDB("winteq_mock_history", logs);
  triggerRefresh();
}

// ==========================================
// 4. FUNGSI WORKSPACE
// ==========================================
export async function getWorkspaces() {
  const s = getSet();
  return s["workspaces"] || ["Main Log"];
}

export async function addWorkspace(name: string) {
  const current = await getWorkspaces();
  if (!current.includes(name)) {
    current.push(name);
    await saveSetting("workspaces", current);
  }
}

export async function renameWorkspace(oldName: string, newName: string) {
  if (oldName === "Main Log" || !newName.trim()) return;
  const current = await getWorkspaces();
  if (current.includes(newName)) return;

  const updated = current.map((w: any) => w === oldName ? newName : w);
  await saveSetting("workspaces", updated);

  let scans = getDB("winteq_mock_scans");
  scans = scans.map((s: any) => s.workspace === oldName ? { ...s, workspace: newName } : s);
  setDB("winteq_mock_scans", scans);

  let logs = getDB("winteq_mock_history");
  logs = logs.map((l: any) => l.workspace === oldName ? { ...l, workspace: newName } : l);
  setDB("winteq_mock_history", logs);

  const s = getSet();
  if (s[`copro_list_${oldName}`]) { s[`copro_list_${newName}`] = s[`copro_list_${oldName}`]; delete s[`copro_list_${oldName}`]; }
  if (s[`penerima_list_${oldName}`]) { s[`penerima_list_${newName}`] = s[`penerima_list_${oldName}`]; delete s[`penerima_list_${oldName}`]; }
  setSet(s);
  
  triggerRefresh();
}

export async function deleteWorkspace(name: string) {
  if (name === "Main Log") return;
  
  const deletedScans = await getAllScans(name);
  const s = getSet();
  const currentLayouts = s["layouts"] || {};

  let scans = getDB("winteq_mock_scans");
  scans = scans.filter((s: any) => s.workspace !== name);
  setDB("winteq_mock_scans", scans);

  let logs = getDB("winteq_mock_history");
  logs = logs.filter((l: any) => l.workspace !== name);
  setDB("winteq_mock_history", logs);

  delete s[`copro_list_${name}`];
  delete s[`penerima_list_${name}`];
  setSet(s);

  await saveHistoryLog({
    id: crypto.randomUUID(),
    workspace: "SYSTEM",
    timestamp: Date.now(),
    action: `Menghapus Log Permanen: ${name}`,
    dataSnapshot: deletedScans,
    layoutSnapshot: currentLayouts
  });

  const current = await getWorkspaces();
  const updated = current.filter((w: any) => w !== name);
  await saveSetting("workspaces", updated);
}

export async function updateWorkspaceOrder(newOrder: string[]) {
  const sanitizedOrder = ["Main Log", ...newOrder.filter((w: any) => w !== "Main Log")];
  await saveSetting("workspaces", sanitizedOrder);
}