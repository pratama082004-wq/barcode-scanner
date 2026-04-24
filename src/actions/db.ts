"use server"; 

import { prisma } from "../lib/prisma"; 
import { revalidatePath } from "next/cache";

const triggerRefresh = () => {
  revalidatePath("/");
  revalidatePath("/scan-log");
  revalidatePath("/history-activity");
};

// ==========================================
// 1. FUNGSI UNTUK PENGATURAN (Layout, Copro, Penerima)
// ==========================================
export async function getSettings() {
  const settings = await prisma.systemSetting.findMany();
  const result: Record<string, any> = {};
  settings.forEach((s: any) => { result[s.key] = s.value; });
  return result;
}

export async function saveSetting(key: string, value: any) {
  await prisma.systemSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value }
  });
  triggerRefresh(); 
}

// ==========================================
// 2. FUNGSI UNTUK DATA SCAN UTAMA
// ==========================================
export async function getAllScans(workspace: string = "Main Log") {
  const data = await prisma.scanLog.findMany({
    where: { workspace: workspace }, 
    orderBy: { timestamp_diterima: 'desc' }
  });
  
  return data.map((d: any) => ({
    ...d,
    timestamp_diterima: Number(d.timestamp_diterima), 
    custom_data: d.custom_data ? (d.custom_data as Record<string, string>) : {}
  }));
}

export async function upsertScanData(item: any) {
  await prisma.scanLog.upsert({
    where: { id: item.id },
    update: {
      workspace: item.workspace || "Main Log",
      barcode_id: item.barcode_id,
      copro: item.copro,
      nama_penerima: item.nama_penerima,
      kategori: item.kategori,
      waktu_diterima: item.waktu_diterima,
      waktu_dikembalikan: item.waktu_dikembalikan,
      timestamp_diterima: BigInt(item.timestamp_diterima),
      custom_data: item.custom_data
    },
    create: {
      id: item.id,
      workspace: item.workspace || "Main Log",
      barcode_id: item.barcode_id,
      copro: item.copro,
      nama_penerima: item.nama_penerima,
      kategori: item.kategori,
      waktu_diterima: item.waktu_diterima,
      waktu_dikembalikan: item.waktu_dikembalikan,
      timestamp_diterima: BigInt(item.timestamp_diterima),
      custom_data: item.custom_data
    }
  });
  triggerRefresh(); 
}

export async function deleteScanData(id: string) {
  await prisma.scanLog.delete({ where: { id } }).catch(() => console.log("Data sudah tidak ada"));
  triggerRefresh(); 
}

export async function bulkDeleteScans(ids: string[]) {
  await prisma.scanLog.deleteMany({
    where: { id: { in: ids } }
  });
  triggerRefresh(); 
}

// ==========================================
// 3. FUNGSI UNTUK HISTORY ACTIVITY (Time Travel & Global)
// ==========================================
export async function getHistoryLogs(workspace: string = "Main Log") {
  const whereClause = workspace === "ALL" ? {} : { workspace: workspace };
  
  const logs = await prisma.activityHistory.findMany({
    where: whereClause, 
    orderBy: { timestamp: 'desc' },
    take: 100 
  });
  return logs.map((l: any) => ({
    ...l,
    timestamp: Number(l.timestamp)
  }));
}

export async function saveHistoryLog(entry: any) {
  await prisma.activityHistory.create({
    data: {
      id: entry.id,
      workspace: entry.workspace || "Main Log",
      timestamp: BigInt(entry.timestamp),
      action: entry.action,
      dataSnapshot: entry.dataSnapshot,
      layoutSnapshot: entry.layoutSnapshot || {}
    }
  });
  triggerRefresh(); 
}

export async function clearHistoryLogs(workspace: string = "Main Log") {
  const whereClause = workspace === "ALL" ? {} : { workspace: workspace };
  await prisma.activityHistory.deleteMany({
    where: whereClause
  });
  triggerRefresh(); 
}

// ==========================================
// 4. FUNGSI UNTUK WORKSPACE (BUKU CATATAN)
// ==========================================
export async function getWorkspaces() {
  const setting = await prisma.systemSetting.findUnique({ where: { key: "workspaces" } });
  return setting ? (setting.value as string[]) : ["Main Log"];
}

export async function addWorkspace(newWorkspace: string) {
  const current = await getWorkspaces();
  if (!current.includes(newWorkspace)) {
    const updated = [...current, newWorkspace];
    await prisma.systemSetting.upsert({
      where: { key: "workspaces" },
      update: { value: updated },
      create: { key: "workspaces", value: updated }
    });
    triggerRefresh(); 
  }
}

export async function renameWorkspace(oldName: string, newName: string) {
  if (oldName === "Main Log" || !newName.trim()) return;
  const current = await getWorkspaces();
  if (current.includes(newName)) return; 

  const updated = current.map(w => w === oldName ? newName : w);
  await prisma.systemSetting.upsert({
    where: { key: "workspaces" },
    update: { value: updated },
    create: { key: "workspaces", value: updated }
  });

  await prisma.scanLog.updateMany({
    where: { workspace: oldName },
    data: { workspace: newName }
  });
  
  await prisma.activityHistory.updateMany({
    where: { workspace: oldName },
    data: { workspace: newName }
  });

  const settingsToMove = await prisma.systemSetting.findMany({
    where: { key: { in: [`copro_list_${oldName}`, `penerima_list_${oldName}`] } }
  });
  
  for (const s of settingsToMove) {
    const newKey = s.key.replace(oldName, newName);
    await prisma.systemSetting.upsert({
      where: { key: newKey },
      update: { value: s.value as any },
      create: { key: newKey, value: s.value as any }
    });
    await prisma.systemSetting.delete({ where: { key: s.key } });
  }

  triggerRefresh(); 
}

export async function deleteWorkspace(name: string) {
  if (name === "Main Log") return;
  
  const rawDeletedData = await prisma.scanLog.findMany({ where: { workspace: name } });
  const settings = await prisma.systemSetting.findUnique({ where: { key: "layouts" } });
  const currentLayouts = settings ? settings.value : {};

  const formattedDeletedData = rawDeletedData.map((d: any) => ({
    ...d,
    timestamp_diterima: Number(d.timestamp_diterima)
  })) as any;

  await prisma.scanLog.deleteMany({ where: { workspace: name } });
  await prisma.activityHistory.deleteMany({ where: { workspace: name } });

  await prisma.systemSetting.deleteMany({
    where: { key: { in: [`copro_list_${name}`, `penerima_list_${name}`] } }
  });

  await prisma.activityHistory.create({
    data: {
      id: crypto.randomUUID(),
      workspace: "SYSTEM", 
      timestamp: BigInt(Date.now()),
      action: `Menghapus Log Permanen: ${name}`,
      dataSnapshot: formattedDeletedData,
      layoutSnapshot: currentLayouts || {}
    }
  });

  const current = await getWorkspaces();
  const updated = current.filter(w => w !== name);
  await prisma.systemSetting.upsert({
    where: { key: "workspaces" },
    update: { value: updated },
    create: { key: "workspaces", value: updated }
  });

  triggerRefresh(); 
}

export async function updateWorkspaceOrder(newOrder: string[]) {
  const sanitizedOrder = ["Main Log", ...newOrder.filter(w => w !== "Main Log")];
  
  await prisma.systemSetting.upsert({
    where: { key: "workspaces" },
    update: { value: sanitizedOrder },
    create: { key: "workspaces", value: sanitizedOrder }
  });
  triggerRefresh();
}
