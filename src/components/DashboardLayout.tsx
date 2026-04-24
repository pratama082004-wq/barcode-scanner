"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation"; 
import { 
  QrCodeIcon, TableCellsIcon, ClockIcon, Cog6ToothIcon, 
  PlusIcon, FolderIcon, ChevronDownIcon, XMarkIcon, PencilIcon, TrashIcon, ArrowRightOnRectangleIcon
} from "@heroicons/react/24/outline";

import { getWorkspaces, addWorkspace, renameWorkspace, deleteWorkspace, updateWorkspaceOrder } from "./../actions/db";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter(); 
  
  // ================= STATE SECURITY =================
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const inactiveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hiddenTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ================= STATE WORKSPACE =================
  const [workspaces, setWorkspaces] = useState<string[]>(["Main Log"]);
  const [activeWorkspace, setActiveWorkspace] = useState("Main Log");
  const [isScanLogOpen, setIsScanLogOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem("winteq_scanlog_menu_open");
      if (saved !== null) return saved === "true";
    }
    return true;
  });
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newLogName, setNewLogName] = useState("");
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, name: "" });
  const [editingWorkspace, setEditingWorkspace] = useState<string | null>(null);
  const [editWorkspaceName, setEditWorkspaceName] = useState("");
  const [draggedWs, setDraggedWs] = useState<string | null>(null);

  // ================= LOGIKA SECURITY SANGAT KETAT =================
  useEffect(() => {
    const isAuth = typeof window !== 'undefined' ? sessionStorage.getItem("winteq_auth") : null;

    if (pathname === '/login') {
      setIsCheckingAuth(false);
      return;
    }

    // PROTEKSI: Kalau belum login, usir ke halaman login
    if (!isAuth) {
      router.replace('/login');
      return;
    } else {
      setIsCheckingAuth(false);
    }

    // FUNGSI TENDANG KELUAR
    const forceLogout = (reason: string) => {
      sessionStorage.removeItem("winteq_auth");
      alert(`Sesi diakhiri secara otomatis untuk keamanan data.\nAlasan: ${reason}`);
      router.replace('/login');
    };

    // SENSOR 1: KETIAKA DIAM TIDAK ADA AKTIVITAS (1 MENIT = 60.000 ms)
    const resetInactiveTimer = () => {
      if (inactiveTimerRef.current) clearTimeout(inactiveTimerRef.current);
      inactiveTimerRef.current = setTimeout(() => {
        forceLogout("Tidak terdeteksi aktivitas selama 1 menit.");
      }, 60000); 
    };

    // SENSOR 2: KETIKA PINDAH TAB / MINIMIZE APP (2 MENIT = 120.000 ms)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        hiddenTimerRef.current = setTimeout(() => {
          forceLogout("Meninggalkan halaman layar lebih dari 2 menit.");
        }, 120000); 
      } else {
        if (hiddenTimerRef.current) clearTimeout(hiddenTimerRef.current);
        resetInactiveTimer(); // Balik ke halaman, reset timer aktivitas
      }
    };

    // DAFTARKAN SEMUA SENSOR
    const activeEvents = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    activeEvents.forEach(e => window.addEventListener(e, resetInactiveTimer));
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Mulai Timer Pertama Kali
    resetInactiveTimer();

    return () => {
      activeEvents.forEach(e => window.removeEventListener(e, resetInactiveTimer));
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (inactiveTimerRef.current) clearTimeout(inactiveTimerRef.current);
      if (hiddenTimerRef.current) clearTimeout(hiddenTimerRef.current);
    };
  }, [pathname, router]);

  // ================= LOGIKA WORKSPACE =================
  const loadWorkspaces = async () => {
    const data = await getWorkspaces();
    setWorkspaces(data);
  };

  useEffect(() => {
    if (pathname === '/login') return; // Jangan load data di halaman login
    
    loadWorkspaces();
    const savedWorkspace = localStorage.getItem("winteq_active_workspace");
    if (savedWorkspace) setActiveWorkspace(savedWorkspace);

    const handleWorkspaceSync = async () => {
      const currentWorkspace = localStorage.getItem("winteq_active_workspace") || "Main Log";
      setActiveWorkspace(currentWorkspace);
      await loadWorkspaces(); 
    };

    window.addEventListener("workspaceChanged", handleWorkspaceSync);
    return () => window.removeEventListener("workspaceChanged", handleWorkspaceSync);
  }, [pathname]);

  useEffect(() => {
    if (isAddModalOpen || deleteModal.isOpen) document.body.classList.add("global-modal-open");
    else document.body.classList.remove("global-modal-open");
    return () => document.body.classList.remove("global-modal-open");
  }, [isAddModalOpen, deleteModal.isOpen]);

  const handleSelectWorkspace = (ws: string) => {
    if (editingWorkspace) return;
    setActiveWorkspace(ws);
    localStorage.setItem("winteq_active_workspace", ws);
    window.dispatchEvent(new Event("workspaceChanged"));
    if (pathname !== '/scan-log') router.push('/scan-log');
  };

  const handleAddWorkspace = async () => {
    const name = newLogName.trim();
    if (!name || workspaces.includes(name)) return;
    await addWorkspace(name);
    setNewLogName(""); setIsAddModalOpen(false);
    handleSelectWorkspace(name);
  };

  const handleDeleteWorkspace = async () => {
    const name = deleteModal.name;
    await deleteWorkspace(name);
    if (activeWorkspace === name) handleSelectWorkspace("Main Log");
    else loadWorkspaces(); 
    setDeleteModal({ isOpen: false, name: "" });
  };

  const handleEditStart = (ws: string, e: React.MouseEvent) => { e.stopPropagation(); setEditingWorkspace(ws); setEditWorkspaceName(ws); };
  const handleEditSubmit = async (oldName: string) => {
    const newName = editWorkspaceName.trim();
    if (!newName || newName === oldName || workspaces.includes(newName)) { setEditingWorkspace(null); return; }
    setEditingWorkspace(null); 
    await renameWorkspace(oldName, newName);
    if (activeWorkspace === oldName) handleSelectWorkspace(newName);
    else loadWorkspaces(); 
  };

  const handleDragStart = (e: React.DragEvent, ws: string) => {
    if (ws === "Main Log") { e.preventDefault(); return; }
    setDraggedWs(ws); e.dataTransfer.effectAllowed = 'move';
    (e.target as HTMLElement).style.opacity = '0.5';
  };
  const handleDragEnd = (e: React.DragEvent) => { (e.target as HTMLElement).style.opacity = '1'; setDraggedWs(null); };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); };
  
  const handleDrop = async (e: React.DragEvent, targetWs: string) => {
    e.preventDefault(); if (!draggedWs || draggedWs === targetWs) return;
    const currentList = [...workspaces]; const fromIdx = currentList.indexOf(draggedWs); let toIdx = currentList.indexOf(targetWs);
    if (toIdx === 0) toIdx = 1;
    if (fromIdx > -1 && toIdx > -1) {
      const [movedItem] = currentList.splice(fromIdx, 1); currentList.splice(toIdx, 0, movedItem);
      setWorkspaces(currentList); await updateWorkspaceOrder(currentList);
    }
    setDraggedWs(null);
  };

  const toggleScanLogMenu = () => {
    const newState = !isScanLogOpen;
    setIsScanLogOpen(newState);
    localStorage.setItem("winteq_scanlog_menu_open", String(newState));
  };

  const handleManualLogout = () => {
    sessionStorage.removeItem("winteq_auth");
    router.replace('/login');
  };

  // CEGAH KEDIP SEBELUM CEK TOKEN
  if (isCheckingAuth) return <div className="h-screen w-full bg-[#0B1120]"></div>;

  // KALAU HALAMAN LOGIN, JANGAN TAMPILIN SIDEBAR SAMA SEKALI
  if (pathname === '/login') {
    return <>{children}</>;
  }

  // TAMPILAN DASHBOARD NORMAL JIKA SUDAH LOGIN
  return (
    <div className="flex h-screen bg-slate-50 font-sans">
      <div className="w-64 bg-[#0B1120] text-slate-300 flex flex-col shadow-xl z-20 shrink-0">
        <div className="h-16 flex items-center px-6 font-black text-xl text-white tracking-widest border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2"><XMarkIcon className="w-5 h-5 text-blue-500" /> WINTEQ</div>
        </div>
        
        <div className="flex-1 overflow-y-auto py-6 flex flex-col gap-2 px-3 thin-scrollbar">
          <Link href="/">
            <div className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors font-medium ${pathname === '/' ? 'bg-blue-600 text-white shadow-md' : 'hover:bg-slate-800 hover:text-white'}`}>
              <QrCodeIcon className="w-5 h-5" /> Dashboard Scan
            </div>
          </Link>

          <div className="flex flex-col">
            <div onClick={toggleScanLogMenu} className={`flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors font-medium cursor-pointer ${pathname === '/scan-log' ? 'bg-blue-600 text-white shadow-md' : 'hover:bg-slate-800 hover:text-white'}`}>
              <div onClick={(e) => { e.stopPropagation(); router.push('/scan-log'); }} className="flex items-center gap-3 flex-1"><TableCellsIcon className="w-5 h-5" /> Scan Log</div>
              <ChevronDownIcon className={`w-4 h-4 transition-transform ${isScanLogOpen ? 'rotate-180' : ''}`} />
            </div>
            {isScanLogOpen && (
              <div className="ml-4 mt-1 flex flex-col gap-1 border-l border-slate-700 pl-2 pr-1 animate-in fade-in slide-in-from-top-2 duration-200">
                {workspaces.map((ws) => {
                  const isMainLog = ws === "Main Log"; const isActive = activeWorkspace === ws && pathname === '/scan-log'; const isEditing = editingWorkspace === ws;
                  return (
                    <div key={ws} draggable={!isMainLog && !isEditing} onDragStart={(e) => handleDragStart(e, ws)} onDragEnd={handleDragEnd} onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, ws)} className={`flex items-center justify-between px-2 py-2 rounded-md text-sm transition-colors group ${isActive ? 'bg-slate-800/70 text-blue-400 font-bold' : 'text-slate-400 hover:bg-slate-800/30'} ${!isMainLog && !isEditing ? 'cursor-grab active:cursor-grabbing' : ''}`}>
                      <div onClick={() => !isEditing && handleSelectWorkspace(ws)} className={`flex items-center gap-2 flex-1 truncate mr-2 ${!isEditing ? 'cursor-pointer' : ''}`}>
                        <FolderIcon className={`w-4 h-4 shrink-0 ${isActive ? 'text-blue-500' : 'text-slate-500'}`} /> 
                        {isEditing ? (<input type="text" autoFocus value={editWorkspaceName} onChange={(e) => setEditWorkspaceName(e.target.value)} onBlur={() => handleEditSubmit(ws)} onKeyDown={(e) => { if (e.key === 'Enter') handleEditSubmit(ws); if (e.key === 'Escape') setEditingWorkspace(null); }} onClick={(e) => e.stopPropagation()} className="flex-1 bg-slate-900 border border-blue-500 text-blue-100 px-1.5 py-0.5 rounded outline-none focus:ring-2 focus:ring-blue-400 text-sm font-bold min-w-0" />) : (<span className="truncate select-none">{ws}</span>)}
                      </div>
                      {!isMainLog && !isEditing && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={(e) => handleEditStart(ws, e)} className="p-1.5 text-slate-500 hover:text-blue-400 hover:bg-slate-700 rounded transition-colors" title="Ganti Nama"><PencilIcon className="w-3.5 h-3.5" /></button>
                          <button onClick={(e) => { e.stopPropagation(); setDeleteModal({ isOpen: true, name: ws }); }} className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-700 rounded transition-colors" title="Hapus Log"><TrashIcon className="w-3.5 h-3.5" /></button>
                        </div>
                      )}
                    </div>
                  );
                })}
                <div onClick={() => setIsAddModalOpen(true)} className="flex items-center gap-2 px-3 py-2 rounded-md text-sm cursor-pointer transition-colors text-emerald-400 hover:text-emerald-300 hover:bg-slate-800/30 mt-1 font-medium"><PlusIcon className="w-4 h-4" /> Add New Log...</div>
              </div>
            )}
          </div>

          <Link href="/history-activity"><div className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors font-medium ${pathname === '/history-activity' ? 'bg-blue-600 text-white shadow-md' : 'hover:bg-slate-800 hover:text-white'}`}><ClockIcon className="w-5 h-5" /> History Activity</div></Link>
          <Link href="/pengaturan"><div className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors font-medium ${pathname === '/pengaturan' ? 'bg-blue-600 text-white shadow-md' : 'hover:bg-slate-800 hover:text-white'}`}><Cog6ToothIcon className="w-5 h-5" /> Pengaturan</div></Link>
        </div>
        
        {/* PROFILE ICON & TOMBOL LOGOUT MANUAL */}
        <div className="p-4 border-t border-slate-800 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-full bg-blue-600/20 flex items-center justify-center font-bold text-blue-500 border border-blue-500/30 shadow-inner">F</div>
             <span className="text-sm font-bold text-slate-300">Faisal</span>
          </div>
          <button onClick={handleManualLogout} className="p-2 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-all" title="Keluar">
             <ArrowRightOnRectangleIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50 relative">{children}</div>

      {/* MODAL AREA */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-xl font-black text-slate-800 mb-2">Buat Log Baru</h3>
            <p className="text-sm text-slate-500 mb-5 font-medium">Buat buku catatan baru untuk memisahkan data scan.</p>
            <input type="text" autoFocus value={newLogName} onChange={(e) => setNewLogName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddWorkspace()} placeholder="Contoh: Log Proyek X..." className="w-full p-3 border-2 border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 mb-6 text-slate-800 font-medium transition-all" />
            <div className="flex justify-end gap-3"><button onClick={() => setIsAddModalOpen(false)} className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold rounded-xl transition-colors">Batal</button><button onClick={handleAddWorkspace} disabled={!newLogName.trim()} className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl shadow-sm transition-colors disabled:opacity-50 flex items-center gap-2"><PlusIcon className="w-4 h-4"/> Buat Log</button></div>
          </div>
        </div>
      )}

      {deleteModal.isOpen && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm animate-in fade-in zoom-in-95 duration-200 border-t-4 border-red-500">
            <div className="flex items-center gap-3 mb-4 text-red-600"><TrashIcon className="w-7 h-7" /><h3 className="text-xl font-black text-slate-800">Hapus Log Ini?</h3></div>
            <p className="text-sm text-slate-600 mb-6 font-medium leading-relaxed">Anda yakin ingin menghapus <span className="font-bold text-red-600">"{deleteModal.name}"</span>? <br/><br/>Semua data barcode dan riwayat di dalam buku catatan ini akan <b className="text-red-600">dihapus permanen</b> dari database.</p>
            <div className="flex justify-end gap-3"><button onClick={() => setDeleteModal({ isOpen: false, name: "" })} className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold rounded-xl transition-colors">Batal (Esc)</button><button onClick={handleDeleteWorkspace} className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-xl shadow-sm transition-colors flex items-center gap-2"><TrashIcon className="w-4 h-4"/> Ya, Hapus Permanen</button></div>
          </div>
        </div>
      )}
    </div>
  );
}