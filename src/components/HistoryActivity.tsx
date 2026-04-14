"use client";

import { useState, useEffect } from "react";
import { ClockIcon, ArrowPathRoundedSquareIcon, ExclamationTriangleIcon, CheckCircleIcon, GlobeAltIcon, ChevronDownIcon } from "@heroicons/react/24/outline";
import { ScanItem } from "./DashboardScan"; 

import { getHistoryLogs, clearHistoryLogs, getAllScans, bulkDeleteScans, upsertScanData, saveSetting, saveHistoryLog, addWorkspace, getWorkspaces } from "../actions/db";

export type HistoryEntry = { id: string; workspace: string; timestamp: number; action: string; dataSnapshot: ScanItem[]; layoutSnapshot?: Record<string, any>; };

export default function HistoryActivity() {
  const [workspaces, setWorkspaces] = useState<string[]>(["Main Log"]);
  const [activeWorkspace, setActiveWorkspace] = useState("Main Log");
  
  const [viewMode, setViewMode] = useState<'WORKSPACE' | 'GLOBAL'>('WORKSPACE');

  const [historyLog, setHistoryLog] = useState<HistoryEntry[]>([]);
  
  // STATE ANIMASI
  const [isDataLoaded, setIsDataLoaded] = useState(false); // Buat nahan halaman pertama kali
  const [isLoading, setIsLoading] = useState(true); 
  const [isSwitching, setIsSwitching] = useState(false); 

  const [restoreConfirm, setRestoreConfirm] = useState<HistoryEntry | null>(null);
  const [alertModal, setAlertModal] = useState({ isOpen: false, title: "", message: "" });
  const [isRestoring, setIsRestoring] = useState(false);

  const loadHistory = async (mode: 'WORKSPACE' | 'GLOBAL', workspaceName: string = activeWorkspace) => {
    if (historyLog.length === 0 && !isDataLoaded) setIsLoading(true);
    else setIsSwitching(true); 
    
    try {
      const wsList = await getWorkspaces();
      setWorkspaces(wsList);

      const fetchTarget = mode === 'GLOBAL' ? "ALL" : workspaceName;
      const logs = await getHistoryLogs(fetchTarget);
      setHistoryLog(logs as HistoryEntry[]);
    } catch (error) {
      console.error("Gagal memuat history:", error);
    } finally {
      setIsLoading(false);
      setIsSwitching(false); 
      setIsDataLoaded(true);
    }
  };

  useEffect(() => {
    const initialWorkspace = localStorage.getItem("winteq_active_workspace") || "Main Log";
    setActiveWorkspace(initialWorkspace);
    loadHistory('WORKSPACE', initialWorkspace);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  useEffect(() => {
    const handleWorkspaceChange = async () => {
      const newWorkspace = localStorage.getItem("winteq_active_workspace") || "Main Log";
      setActiveWorkspace(newWorkspace);
      
      const wsList = await getWorkspaces();
      setWorkspaces(wsList);

      if (viewMode === 'WORKSPACE') {
        loadHistory('WORKSPACE', newWorkspace);
      }
    };

    window.addEventListener("workspaceChanged", handleWorkspaceChange);
    return () => window.removeEventListener("workspaceChanged", handleWorkspaceChange);
  }, [viewMode]);

  const handleTabChange = (mode: 'WORKSPACE' | 'GLOBAL') => {
    if (mode === viewMode) return; 
    setViewMode(mode);
    loadHistory(mode, activeWorkspace);
  };

  const handleRestore = async () => {
    if (!restoreConfirm) return;
    setIsRestoring(true);

    try {
      const workspacesInSnapshot = Array.from(new Set(restoreConfirm.dataSnapshot.map((s: any) => s.workspace)));
      for (const ws of workspacesInSnapshot) { if (ws) await addWorkspace(ws as string); }
      for (const ws of workspacesInSnapshot) { if (ws) { const currentScans = await getAllScans(ws as string); const currentIds = currentScans.map((s: any) => s.id); if (currentIds.length > 0) await bulkDeleteScans(currentIds); } }
      if (restoreConfirm.dataSnapshot && restoreConfirm.dataSnapshot.length > 0) { for (const item of restoreConfirm.dataSnapshot) { await upsertScanData(item); } }
      if (restoreConfirm.layoutSnapshot && Object.keys(restoreConfirm.layoutSnapshot).length > 0) { await saveSetting("layouts", restoreConfirm.layoutSnapshot); }
      
      const newEntry = { id: crypto.randomUUID(), workspace: viewMode === 'GLOBAL' ? "SYSTEM" : activeWorkspace, timestamp: Date.now(), action: `Memulihkan data ke versi: ${new Date(restoreConfirm.timestamp).toLocaleString("id-ID")}`, dataSnapshot: restoreConfirm.dataSnapshot, layoutSnapshot: restoreConfirm.layoutSnapshot || {} };
      await saveHistoryLog(newEntry);
      
      loadHistory(viewMode, activeWorkspace);
      setRestoreConfirm(null);
      setAlertModal({ isOpen: true, title: "Pemulihan Magis Berhasil!", message: "Data tabel telah dikembalikan. Jika Anda memulihkan Log yang sebelumnya terhapus, Log tersebut kini sudah bangkit kembali di Sidebar!" });
      window.dispatchEvent(new Event("workspaceChanged"));

    } catch (error) {
      console.error("Gagal memulihkan data:", error);
      alert("Terjadi kesalahan saat memulihkan data. Cek koneksi database.");
    } finally {
      setIsRestoring(false);
    }
  };

  const clearHistory = async () => {
    const target = viewMode === 'GLOBAL' ? "SELURUH SISTEM GLOBAL" : activeWorkspace;
    if(confirm(`Yakin ingin menghapus riwayat aktivitas untuk ${target}? Data utama di Scan Log tidak akan terhapus.`)) {
      setIsLoading(true);
      await clearHistoryLogs(viewMode === 'GLOBAL' ? "ALL" : activeWorkspace);
      setHistoryLog([]);
      setIsLoading(false);
    }
  };

  // =========================================================================
  // ANTI-HENTAKKAN: SKELETON LOADER
  // =========================================================================
  if (!isDataLoaded) return (
    <div className="flex flex-col h-[calc(100vh)] w-full bg-slate-50 animate-in fade-in duration-500">
      <div className="bg-white px-6 py-4 shadow-sm border-b border-gray-200 flex justify-between items-center z-10 shrink-0 h-[68px]">
        <div className="h-6 w-48 bg-slate-200 rounded animate-pulse"></div>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4 shadow-sm"></div>
        <p className="font-bold text-blue-500 animate-pulse tracking-wide">Memuat Riwayat...</p>
      </div>
    </div>
  );

  return (
    <div className="animate-in fade-in duration-500 flex w-full h-[calc(100vh)] bg-slate-50 flex-col">
      <div className="bg-white px-6 py-4 shadow-sm border-b border-gray-200 flex justify-between items-center z-10 shrink-0 h-[68px]">
        <h2 className="text-xl font-bold text-gray-800">History Activity</h2>
      </div>

      <div className="flex-1 p-6 lg:p-8 overflow-y-auto relative">
        
        {/* OVERLAY SKELETON LOADING CANTIK SAAT GANTI TAB */}
        {isSwitching && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-50/80 backdrop-blur-sm transition-all duration-300 rounded-xl m-4 sm:m-6">
             <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-3 shadow-md"></div>
             <p className="text-sm font-extrabold text-blue-700 animate-pulse tracking-wide">Memuat Riwayat...</p>
          </div>
        )}

        <div className="max-w-5xl mx-auto">
          
          <div className="flex bg-slate-200 p-1.5 rounded-xl w-max mb-8 shadow-inner border border-slate-300/50">
            <button onClick={() => handleTabChange('WORKSPACE')} className={`px-5 py-2.5 text-sm font-bold rounded-lg transition-all flex items-center gap-2 ${viewMode === 'WORKSPACE' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
              <ClockIcon className="w-5 h-5"/> Log Saat Ini
            </button>
            <button onClick={() => handleTabChange('GLOBAL')} className={`px-5 py-2.5 text-sm font-bold rounded-lg transition-all flex items-center gap-2 ${viewMode === 'GLOBAL' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
              <GlobeAltIcon className="w-5 h-5"/> Semua Sistem (Global)
            </button>
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
            <div>
              <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2 tracking-tight">
                {viewMode === 'GLOBAL' ? <GlobeAltIcon className="w-8 h-8 text-indigo-600" /> : <ClockIcon className="w-8 h-8 text-blue-600" />}
                {viewMode === 'GLOBAL' ? 'Riwayat Seluruh Sistem' : `Riwayat Aktivitas: ${activeWorkspace}`}
              </h1>
              <p className="text-sm text-slate-500 mt-1 font-medium">
                {viewMode === 'GLOBAL' ? 'Memantau dan mencadangkan aktivitas penting dari semua log.' : 'Sistem otomatis mencadangkan aktivitas terakhir di log ini.'}
              </p>
            </div>
            
            <div className="flex items-center gap-3 shrink-0">
              {viewMode === 'WORKSPACE' && (
                <div className="relative">
                  <select
                    value={activeWorkspace}
                    onChange={(e) => {
                      const ws = e.target.value;
                      setActiveWorkspace(ws);
                      localStorage.setItem("winteq_active_workspace", ws);
                      window.dispatchEvent(new Event("workspaceChanged"));
                    }}
                    className="appearance-none pl-4 pr-10 py-2 bg-white text-blue-700 font-bold border border-blue-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer text-sm shadow-sm"
                  >
                    {workspaces.map(w => <option key={w} value={w}>{w}</option>)}
                  </select>
                  <ChevronDownIcon className="w-4 h-4 text-blue-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              )}

              {historyLog.length > 0 && (
                <button onClick={clearHistory} disabled={isLoading || isRestoring} className="text-xs text-red-600 hover:bg-red-50 font-bold px-4 py-2 border border-red-200 hover:border-red-600 rounded-lg transition-colors shadow-sm disabled:opacity-50">
                  Bersihkan Log
                </button>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden min-h-[300px] relative">
            {isLoading ? (
              <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center h-full">
                <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
                <p className="font-medium text-base">Memuat riwayat dari database...</p>
              </div>
            ) : historyLog.length === 0 ? (
              <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center h-full">
                <ClockIcon className="w-14 h-14 mx-auto mb-4 opacity-20" />
                <p className="font-medium text-base">Belum ada riwayat aktivitas yang tercatat.</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {historyLog.map((log, index) => {
                  const isSystemEvent = log.workspace === "SYSTEM";
                  return (
                    <li key={log.id} className={`p-5 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${isSystemEvent ? 'bg-red-50/30' : ''}`}>
                      <div className="flex items-start gap-4">
                        <div className="mt-1">
                          <div className={`w-3 h-3 rounded-full ring-4 ${isSystemEvent ? 'bg-red-500 ring-red-100' : (viewMode === 'GLOBAL' ? 'bg-indigo-500 ring-indigo-100' : 'bg-blue-500 ring-blue-100')}`}></div>
                        </div>
                        <div>
                          {viewMode === 'GLOBAL' && (
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider mb-1.5 inline-block ${isSystemEvent ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-indigo-100 text-indigo-700 border border-indigo-200'}`}>
                              {isSystemEvent ? '🚨 SYSTEM ALERT' : log.workspace}
                            </span>
                          )}
                          <p className={`text-sm font-extrabold tracking-wide ${isSystemEvent ? 'text-red-700' : 'text-slate-800'}`}>{log.action}</p>
                          <p className="text-xs text-slate-500 mt-1 font-medium">
                            {new Date(log.timestamp).toLocaleString("id-ID", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </p>
                          <div className="mt-2 inline-flex flex-wrap items-center gap-2">
                            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                              Total Data Ter-Backup: {log.dataSnapshot?.length || 0} Baris
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex shrink-0 ml-7 sm:ml-0">
                        {index !== 0 || viewMode === 'GLOBAL' ? (
                          <button onClick={() => setRestoreConfirm(log)} disabled={isRestoring} className="flex items-center gap-1.5 px-4 py-2 bg-white border border-blue-200 text-blue-700 text-xs font-bold rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-all shadow-sm disabled:opacity-50">
                            <ArrowPathRoundedSquareIcon className="w-4 h-4" /> Pulihkan Data Ini
                          </button>
                        ) : (
                          <span className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-extrabold text-green-700 bg-green-50 border border-green-200 rounded-lg shadow-sm">
                            <CheckCircleIcon className="w-4 h-4"/> Kondisi Saat Ini
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>

      {restoreConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-yellow-600 mb-4">
              <ExclamationTriangleIcon className="w-8 h-8" />
              <h3 className="text-xl font-black text-slate-800">Konfirmasi Kebangkitan Data</h3>
            </div>
            <div className="text-sm text-slate-600 mb-6 bg-yellow-50 p-4 rounded-xl border border-yellow-100">
              Anda akan memulihkan data dari rekaman aktivitas ini:<br/>
              <span className="block mt-2 font-bold text-slate-800 text-base border-b border-yellow-200 pb-2 mb-2">{restoreConfirm.action}</span>
              <span className="font-bold text-slate-700">Waktu Backup: </span> {new Date(restoreConfirm.timestamp).toLocaleString("id-ID")}
            </div>
            <p className="text-xs text-slate-500 mb-6 font-medium leading-relaxed">
              *Tindakan ini akan menimpa data yang ada saat ini. <br/>
              *Jika ini adalah <b className="text-emerald-600">pemulihan Log yang terhapus</b>, sistem akan otomatis membuat ulang nama Log tersebut di Sidebar Anda secara utuh!
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setRestoreConfirm(null)} disabled={isRestoring} className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold rounded-lg transition-colors disabled:opacity-50">Batal</button>
              <button onClick={handleRestore} disabled={isRestoring} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50 min-w-[160px] justify-center">
                {isRestoring ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Membangkitkan...</> : <><ArrowPathRoundedSquareIcon className="w-4 h-4"/> Bangkitkan Data</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {alertModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-5 shadow-sm">
              <CheckCircleIcon className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-black text-slate-800 mb-2">{alertModal.title}</h3>
            <p className="text-sm text-slate-500 mb-8 font-medium leading-relaxed">{alertModal.message}</p>
            <button onClick={() => setAlertModal({ isOpen: false, title: "", message: "" })} className="w-full py-3 bg-slate-800 hover:bg-slate-900 text-white text-sm font-bold rounded-xl transition-colors shadow-md">Oke, Keren!</button>
          </div>
        </div>
      )}
    </div>
  );
}