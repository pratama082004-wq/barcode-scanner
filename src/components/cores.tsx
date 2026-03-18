"use client";

import { useState, useRef, useEffect } from "react";
import * as XLSX from "xlsx";
import { TrashIcon, ArrowPathIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import Modal from "./ui/Modal"; // Memanggil cetakan Modal yang baru dibuat

type ScanItem = { id: string; barcode_id: string; created_at: string; };

export default function DashboardScan() {
  const [scannedItems, setScannedItems] = useState<ScanItem[]>([]);
  const [barcodeData, setBarcodeData] = useState<string>("");
  const [isMounted, setIsMounted] = useState<boolean>(false);
  
  // State Modal Tetap Disini (Karena datanya spesifik untuk halaman ini)
  const [duplicateModal, setDuplicateModal] = useState({ isOpen: false, pendingBarcode: "" });
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, itemId: null as string | null, barcodeId: "" });
  const [resetConfirmOpen, setResetConfirmOpen] = useState<boolean>(false);
  const [alertModal, setAlertModal] = useState({ isOpen: false, title: "", message: "" });

  const inputRef = useRef<HTMLInputElement>(null);
  const anyModalOpen = duplicateModal.isOpen || deleteConfirm.isOpen || resetConfirmOpen || alertModal.isOpen;

  useEffect(() => {
    setIsMounted(true);
    const savedData = localStorage.getItem("winteq_scanner_data");
    if (savedData) setScannedItems(JSON.parse(savedData));
  }, []);

  useEffect(() => {
    if (isMounted) localStorage.setItem("winteq_scanner_data", JSON.stringify(scannedItems));
  }, [scannedItems, isMounted]);

  useEffect(() => {
    if (!anyModalOpen) inputRef.current?.focus();
  }, [scannedItems, anyModalOpen]);

  const addBarcode = (barcode: string) => {
    setScannedItems((prev) => [{ id: crypto.randomUUID(), barcode_id: barcode, created_at: new Date().toLocaleString("id-ID") }, ...prev]);
    setBarcodeData(""); 
  };

  const handleScan = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && barcodeData.trim() !== "" && !anyModalOpen) {
      const currentBarcode = barcodeData.trim();
      if (scannedItems.some(item => item.barcode_id === currentBarcode)) {
        setDuplicateModal({ isOpen: true, pendingBarcode: currentBarcode });
        setBarcodeData(""); 
        return;
      }
      addBarcode(currentBarcode);
    }
  };

  const confirmDeleteRowAction = () => {
    if (deleteConfirm.itemId) setScannedItems((prev) => prev.filter((item) => item.id !== deleteConfirm.itemId));
    setDeleteConfirm({ isOpen: false, itemId: null, barcodeId: "" });
  };

  const exportToExcelWithAlert = () => {
    if (scannedItems.length === 0) return setAlertModal({ isOpen: true, title: "Data Kosong", message: "Belum ada data pindaian barcode yang bisa diunduh." });
    const worksheet = XLSX.utils.json_to_sheet(scannedItems.map((item, i) => ({ "No": i + 1, "ID Barcode": item.barcode_id, "Waktu Scan": item.created_at })));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Data Scan");
    XLSX.writeFile(workbook, "Laporan_Barcode_Winteq.xlsx");
  };

  const confirmResetDataAction = () => {
    setScannedItems([]);
    localStorage.removeItem("winteq_scanner_data");
    setResetConfirmOpen(false);
  };

  if (!isMounted) return null;

  return (
    <>
      {/* ===== PEMANGGILAN MODAL SANGAT RINGKAS SEKARANG ===== */}

      {/* 1. Modal Hapus Satuan */}
      <Modal 
        isOpen={deleteConfirm.isOpen} 
        title="Hapus Barcode?" 
        type="danger" icon="trash"
        description={<>Yakin menghapus barcode <span className="font-semibold text-red-700">"{deleteConfirm.barcodeId}"</span>?</>}
      >
        <button onClick={() => setDeleteConfirm({ isOpen: false, itemId: null, barcodeId: "" })} className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg">Batal</button>
        <button onClick={confirmDeleteRowAction} className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center"><TrashIcon className="w-4 h-4 mr-1.5" /> Hapus</button>
      </Modal>

      {/* 2. Modal Reset Semua */}
      <Modal 
        isOpen={resetConfirmOpen} 
        title="Peringatan: Reset Data Utuh" 
        type="severe" icon="reset"
        description={<>Yakin 100% menghapus <span className="font-semibold text-gray-800">SEMUA</span> {scannedItems.length} data?</>}
      >
        <button onClick={() => setResetConfirmOpen(false)} className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg">Batal</button>
        <button onClick={confirmResetDataAction} className="px-5 py-2.5 bg-red-700 hover:bg-red-800 text-white rounded-lg flex items-center"><ArrowPathIcon className="w-4 h-4 mr-1.5" /> Reset SEMUA Data</button>
      </Modal>

      {/* 3. Modal Info Generic */}
      <Modal 
        isOpen={alertModal.isOpen} 
        title={alertModal.title} 
        type="warning" icon="warning"
        description={alertModal.message}
      >
        <button onClick={() => setAlertModal({ isOpen: false, title: "", message: "" })} className="px-6 py-2.5 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg">Mengerti</button>
      </Modal>

      {/* 4. Modal Duplikat (Custom Buttons) */}
      <Modal 
        isOpen={duplicateModal.isOpen} 
        title="Barcode Sudah Ada!" 
        type="warning" icon="warning"
        description={<>ID Barcode <span className="font-semibold text-blue-600">"{duplicateModal.pendingBarcode}"</span> sudah ada. Apa yang ingin kamu lakukan?</>}
      >
        <button onClick={() => setDuplicateModal({ isOpen: false, pendingBarcode: "" })} className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg">Batal</button>
        <button onClick={() => {
            const newItem = { id: crypto.randomUUID(), barcode_id: duplicateModal.pendingBarcode, created_at: new Date().toLocaleString("id-ID") };
            setScannedItems((prev) => [newItem, ...prev.filter(item => item.barcode_id !== duplicateModal.pendingBarcode)]);
            setDuplicateModal({ isOpen: false, pendingBarcode: "" });
        }} className="px-5 py-2.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg">Timpa (Update Waktu)</button>
        <button onClick={() => {
            addBarcode(duplicateModal.pendingBarcode);
            setDuplicateModal({ isOpen: false, pendingBarcode: "" });
        }} className="px-5 py-2.5 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg flex items-center gap-1.5"><ExclamationTriangleIcon className="w-4 h-4"/> Tetap Tambahkan</button>
      </Modal>

      {/* ===== KONTEN DASHBOARD ===== */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 relative z-0">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-blue-500">
          <h3 className="text-sm font-medium text-gray-500 mb-1.5">Total Scan Tersimpan</h3>
          <p className="text-3xl font-bold text-gray-900">{scannedItems.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 relative z-0">
        <div className="xl:col-span-1">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 sticky top-0">
            <label className="block text-sm font-bold text-gray-700 mb-3 uppercase tracking-wider">Input Scanner</label>
            <p className="text-xs text-gray-500 mb-4">Arahkan alat ke barcode, data otomatis tersimpan.</p>
            <input type="text" ref={inputRef} value={barcodeData} onChange={(e) => setBarcodeData(e.target.value)} onKeyDown={handleScan} disabled={anyModalOpen} className="w-full p-4 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-lg disabled:bg-gray-100 disabled:cursor-not-allowed" placeholder={anyModalOpen ? "Menunggu aksi..." : "Scan barcode di sini..."} autoFocus onBlur={() => { if (!anyModalOpen) inputRef.current?.focus(); }} />
          </div>
        </div>

        <div className="xl:col-span-2">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-bold text-gray-800">Log Pindaian Barcode Terbaru</h3>
              <div className="flex space-x-2.5">
                <button onClick={exportToExcelWithAlert} className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium py-2 px-5 rounded-lg shadow-sm">Unduh Excel</button>
                {scannedItems.length > 0 && <button onClick={() => setResetConfirmOpen(true)} className="bg-red-50 hover:bg-red-100 text-red-600 text-sm font-medium py-2 px-5 rounded-lg border border-red-200">Reset Semua Data</button>}
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[400px]">
                <thead>
                  <tr className="bg-white text-xs md:text-sm uppercase tracking-wider text-gray-500 border-b">
                    <th className="p-4 md:p-5 font-semibold w-16">No</th>
                    <th className="p-4 md:p-5 font-semibold">ID Barcode</th>
                    <th className="p-4 md:p-5 font-semibold">Waktu Scan</th>
                    <th className="p-4 md:p-5 font-semibold w-24 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="text-sm md:text-base">
                  {scannedItems.length === 0 ? (
                    <tr><td colSpan={4} className="p-10 text-center text-gray-400">Belum ada data pindaian barcode.</td></tr>
                  ) : (
                    scannedItems.map((item, index) => (
                      <tr key={item.id} className="border-b last:border-0 hover:bg-blue-50/30 group">
                        <td className="p-4 md:p-5 text-gray-600">{index + 1}</td>
                        <td className="p-4 md:p-5 font-medium text-gray-900 break-all">{item.barcode_id}</td>
                        <td className="p-4 md:p-5 text-gray-600">{item.created_at}</td>
                        <td className="p-4 md:p-5 text-center">
                          <button onClick={() => setDeleteConfirm({ isOpen: true, itemId: item.id, barcodeId: item.barcode_id })} className="p-2.5 text-gray-400 hover:text-red-600 hover:bg-red-100 rounded-lg opacity-100 md:opacity-0 md:group-hover:opacity-100"><TrashIcon className="w-5 h-5"/></button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}