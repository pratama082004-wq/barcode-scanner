"use client";

import { useState, useEffect } from "react";
import { ClockIcon, ArrowPathRoundedSquareIcon, ExclamationTriangleIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import { ScanItem } from "./DashboardScan"; 

export type HistoryEntry = {
  id: string;
  timestamp: number;
  action: string; 
  dataSnapshot: ScanItem[]; 
};

export default function HistoryActivity() {
  const [historyLog, setHistoryLog] = useState<HistoryEntry[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  const [restoreConfirm, setRestoreConfirm] = useState<HistoryEntry | null>(null);
  const [alertModal, setAlertModal] = useState({ isOpen: false, title: "", message: "" });

  useEffect(() => {
    setIsMounted(true);
    const savedHistory = localStorage.getItem("winteq_activity_log");
    if (savedHistory) {
      setHistoryLog(JSON.parse(savedHistory));
    }
  }, []);

  const handleRestore = () => {
    if (!restoreConfirm) return;

    // 1. Timpa data utama dengan data dari masa lalu
    localStorage.setItem("winteq_drawing_data", JSON.stringify(restoreConfirm.dataSnapshot));
    
    // 2. Hapus batas waktu reset Dashboard, supaya data yang sempet di-reset muncul lagi!
    localStorage.setItem("winteq_dash_last_reset", "0");
    
    // 3. Catat aktivitas pemulihan ini ke dalam history baru
    const newEntry: HistoryEntry = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      action: `Memulihkan data ke versi: ${new Date(restoreConfirm.timestamp).toLocaleString("id-ID")}`,
      dataSnapshot: restoreConfirm.dataSnapshot
    };
    
    const updatedHistory = [newEntry, ...historyLog].slice(0, 50); 
    localStorage.setItem("winteq_activity_log", JSON.stringify(updatedHistory));
    setHistoryLog(updatedHistory);
    
    setRestoreConfirm(null);
    
    // Tampilkan Modal Success Custom, bukan alert() localhost lagi wkwkwk
    setAlertModal({ 
      isOpen: true, 
      title: "Berhasil Dipulihkan!", 
      message: "Data dan tampilan telah berhasil dikembalikan ke versi yang Anda pilih. Silakan cek halaman Dashboard atau Scan Log." 
    });
  };

  const clearHistory = () => {
    if(confirm("Yakin ingin menghapus semua riwayat aktivitas? Data utama tidak akan terhapus.")) {
      localStorage.removeItem("winteq_activity_log");
      setHistoryLog([]);
    }
  };

  if (!isMounted) return null;

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2 tracking-tight">
            <ClockIcon className="w-8 h-8 text-blue-600" />
            Riwayat Aktivitas Sistem
          </h1>
          <p className="text-sm text-slate-500 mt-1 font-medium">Sistem otomatis mencadangkan 50 aktivitas terakhir Anda.</p>
        </div>
        {historyLog.length > 0 && (
          <button onClick={clearHistory} className="text-xs text-red-600 hover:text-white font-bold px-4 py-2 border border-red-200 hover:bg-red-600 hover:border-red-600 rounded-lg transition-colors shadow-sm">
            Bersihkan Log
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {historyLog.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <ClockIcon className="w-14 h-14 mx-auto mb-4 opacity-20" />
            <p className="font-medium text-base">Belum ada riwayat aktivitas yang tercatat.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {historyLog.map((log, index) => (
              <li key={log.id} className="p-5 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="mt-1">
                    <div className="w-3 h-3 rounded-full bg-blue-500 ring-4 ring-blue-100"></div>
                  </div>
                  <div>
                    <p className="text-sm font-extrabold text-slate-800 tracking-wide">{log.action}</p>
                    <p className="text-xs text-slate-500 mt-1 font-medium">
                      {new Date(log.timestamp).toLocaleString("id-ID", { 
                        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', 
                        hour: '2-digit', minute: '2-digit', second: '2-digit' 
                      })}
                    </p>
                    <div className="mt-2 inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                      Total Data Snapshot: {log.dataSnapshot.length} Baris
                    </div>
                  </div>
                </div>
                
                {/* TOMBOL SELALU TAMPIL, BUKAN HOVER LAGI */}
                <div className="flex shrink-0 ml-7 sm:ml-0">
                  {index !== 0 ? (
                    <button 
                      onClick={() => setRestoreConfirm(log)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-white border border-blue-200 text-blue-700 text-xs font-bold rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-all shadow-sm"
                    >
                      <ArrowPathRoundedSquareIcon className="w-4 h-4" /> Pulihkan Versi Ini
                    </button>
                  ) : (
                    <span className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-extrabold text-green-700 bg-green-50 border border-green-200 rounded-lg">
                      <CheckCircleIcon className="w-4 h-4"/> Kondisi Saat Ini
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* POP-UP KONFIRMASI (CUSTOM MODAL) */}
      {restoreConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-yellow-600 mb-4">
              <ExclamationTriangleIcon className="w-8 h-8" />
              <h3 className="text-xl font-black text-slate-800">Konfirmasi Pemulihan</h3>
            </div>
            <div className="text-sm text-slate-600 mb-6 bg-yellow-50 p-4 rounded-xl border border-yellow-100">
              Anda akan memulihkan data ke kondisi pada:<br/>
              <span className="block mt-2 font-bold text-slate-800 text-base">
                {new Date(restoreConfirm.timestamp).toLocaleString("id-ID")}
              </span>
            </div>
            <p className="text-xs text-slate-500 mb-6 font-medium leading-relaxed">
              *Aktivitas apa pun yang Anda lakukan <b className="text-slate-700">setelah</b> tanggal tersebut akan dibatalkan dan layar akan diganti sepenuhnya dengan data versi ini.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setRestoreConfirm(null)} className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold rounded-lg transition-colors">Batal</button>
              <button onClick={handleRestore} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg shadow-sm transition-colors flex items-center gap-2">
                <ArrowPathRoundedSquareIcon className="w-4 h-4"/> Ya, Pulihkan Data
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POP-UP SUCCESS ALERT (MENGGANTIKAN ALERT LOCALHOST) */}
      {alertModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-5 shadow-sm">
              <CheckCircleIcon className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-black text-slate-800 mb-2">{alertModal.title}</h3>
            <p className="text-sm text-slate-500 mb-8 font-medium leading-relaxed">
              {alertModal.message}
            </p>
            <button 
              onClick={() => setAlertModal({ isOpen: false, title: "", message: "" })} 
              className="w-full py-3 bg-slate-800 hover:bg-slate-900 text-white text-sm font-bold rounded-xl transition-colors shadow-md"
            >
              Oke, Mengerti
            </button>
          </div>
        </div>
      )}

    </div>
  );
}