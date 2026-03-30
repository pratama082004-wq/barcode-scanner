"use client";

import { useState, useRef, useEffect } from "react";
import * as XLSX from "xlsx";
import { TrashIcon, ArrowPathIcon, ExclamationTriangleIcon, ArrowUturnLeftIcon, ArrowUturnRightIcon, PlusIcon, FolderOpenIcon } from "@heroicons/react/24/outline";
import Modal from "./ui/Modal"; 

type ScanItem = { 
  id: string; 
  barcode_id: string; 
  created_at: string; 
  category?: string; 
  custom_data?: Record<string, string>; 
};

export default function DashboardScan() {
  const [scannedItems, setScannedItems] = useState<ScanItem[]>([]);
  const [barcodeData, setBarcodeData] = useState<string>("");
  const [isMounted, setIsMounted] = useState<boolean>(false);
  
  const [sheets, setSheets] = useState<string[]>(["All Data"]);
  const [selectedCategory, setSelectedCategory] = useState<string>("Default");
  const [showNewSheetModal, setShowNewSheetModal] = useState(false);
  const [newSheetName, setNewSheetName] = useState("");

  const [pastStates, setPastStates] = useState<ScanItem[][]>([]);
  const [futureStates, setFutureStates] = useState<ScanItem[][]>([]);

  const [duplicateModal, setDuplicateModal] = useState({ isOpen: false, pendingBarcode: "" });
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, itemId: null as string | null, barcodeId: "" });
  const [resetConfirmOpen, setResetConfirmOpen] = useState<boolean>(false);
  const [alertModal, setAlertModal] = useState({ isOpen: false, title: "", message: "" });

  const inputRef = useRef<HTMLInputElement>(null);
  const latestItemsRef = useRef<ScanItem[]>([]);

  const anyModalOpen = duplicateModal.isOpen || deleteConfirm.isOpen || resetConfirmOpen || alertModal.isOpen || showNewSheetModal;

  useEffect(() => {
    setIsMounted(true);
    const savedData = localStorage.getItem("winteq_scanner_data");
    const savedSheets = localStorage.getItem("winteq_scanner_sheets");
    if (savedData) {
      const parsed = JSON.parse(savedData);
      setScannedItems(parsed);
      latestItemsRef.current = parsed; 
    }
    if (savedSheets) setSheets(JSON.parse(savedSheets));
  }, []);

  useEffect(() => {
    if (isMounted) {
      localStorage.setItem("winteq_scanner_data", JSON.stringify(scannedItems));
      localStorage.setItem("winteq_scanner_sheets", JSON.stringify(sheets));
    }
  }, [scannedItems, sheets, isMounted]);

  useEffect(() => {
    if (!anyModalOpen) inputRef.current?.focus();
  }, [scannedItems, anyModalOpen]);

  const saveHistory = () => { setPastStates((prev) => [...prev.slice(-19), latestItemsRef.current]); setFutureStates([]); };
  
  const handleUndo = () => { 
    if (pastStates.length === 0) return; 
    const previousState = pastStates[pastStates.length - 1]; 
    setPastStates((prev) => prev.slice(0, -1)); 
    setFutureStates((prev) => [...prev, latestItemsRef.current]); 
    latestItemsRef.current = previousState; 
    setScannedItems(previousState); 
  };
  
  const handleRedo = () => { 
    if (futureStates.length === 0) return; 
    const nextState = futureStates[futureStates.length - 1]; 
    setFutureStates((prev) => prev.slice(0, -1)); 
    setPastStates((prev) => [...prev, latestItemsRef.current]); 
    latestItemsRef.current = nextState; 
    setScannedItems(nextState); 
  };

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (anyModalOpen) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); handleUndo(); } 
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); handleRedo(); }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [pastStates, futureStates, anyModalOpen]);

  const addBarcode = (barcode: string) => {
    saveHistory(); 
    const newItem: ScanItem = { 
      id: crypto.randomUUID(), 
      barcode_id: barcode.trim(), 
      created_at: new Date().toLocaleString("id-ID"),
      category: selectedCategory === "Default" ? undefined : selectedCategory 
    };
    
    const newData = [newItem, ...latestItemsRef.current];
    latestItemsRef.current = newData;
    setScannedItems(newData);
    
    setBarcodeData(""); 
    inputRef.current?.focus(); 
  };

  const submitBarcodeData = () => {
    if (barcodeData.trim() === "" || anyModalOpen) return;

    const currentBarcode = barcodeData.trim();
    const cleanCurrent = currentBarcode.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    
    const isDuplicate = latestItemsRef.current.some(
      item => item.barcode_id.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() === cleanCurrent
    );

    if (isDuplicate) {
      setDuplicateModal({ isOpen: true, pendingBarcode: currentBarcode });
      setBarcodeData(""); // Tetap dikosongkan agar input siap untuk aksi selanjutnya
      return;
    }
    
    addBarcode(currentBarcode);
  };

  // --- SOLUSI: Pisahkan KeyDown (Pencegah Bug) dan KeyUp (Eksekutor) ---
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault(); // Mencegah form ke-submit secara otomatis
    }
  };

  const handleKeyUp = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      submitBarcodeData(); // Hanya dieksekusi SAAT JARI DILEPAS dari tombol
    }
  };
  // ---------------------------------------------------------------------

  const handleCreateNewSheet = () => {
    const sheetName = newSheetName.trim();
    if (sheetName && !sheets.includes(sheetName) && sheetName !== "Default") { 
      setSheets([...sheets, sheetName]); 
      setSelectedCategory(sheetName); 
    }
    setShowNewSheetModal(false); 
    setNewSheetName("");
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const confirmDeleteRowAction = () => { 
    if (deleteConfirm.itemId) { 
      saveHistory(); 
      const newData = latestItemsRef.current.filter((item) => item.id !== deleteConfirm.itemId);
      latestItemsRef.current = newData;
      setScannedItems(newData);
    } 
    setDeleteConfirm({ isOpen: false, itemId: null, barcodeId: "" }); 
  };

  const confirmResetDataAction = () => { 
    saveHistory(); 
    latestItemsRef.current = [];
    setScannedItems([]); 
    setResetConfirmOpen(false); 
  };
  
  const exportToExcelWithAlert = () => {
    if (latestItemsRef.current.length === 0) return setAlertModal({ isOpen: true, title: "Data Kosong", message: "Belum ada data pindaian barcode yang bisa diunduh." });
    const dataToExport = latestItemsRef.current.slice(0, 10).map((item, i) => ({ "No": i + 1, "ID Barcode": item.barcode_id, "Waktu Scan": item.created_at, "Kategori": item.category || "Default" }));
    const worksheet = XLSX.utils.json_to_sheet(dataToExport); const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "10_Log_Terbaru"); XLSX.writeFile(workbook, "Laporan_Cepat_Winteq.xlsx");
  };

  const handleDuplicateCancel = () => setDuplicateModal({ isOpen: false, pendingBarcode: "" });
  
  const handleDuplicateReplace = () => {
    saveHistory(); 
    const newItem: ScanItem = { id: crypto.randomUUID(), barcode_id: duplicateModal.pendingBarcode.trim(), created_at: new Date().toLocaleString("id-ID"), category: selectedCategory === "Default" ? undefined : selectedCategory };
    const cleanPending = duplicateModal.pendingBarcode.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const filtered = latestItemsRef.current.filter(item => item.barcode_id.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() !== cleanPending);
    
    const newData = [newItem, ...filtered];
    latestItemsRef.current = newData;
    setScannedItems(newData);
    handleDuplicateCancel();
  };
  
  const handleDuplicateContinue = () => { addBarcode(duplicateModal.pendingBarcode); handleDuplicateCancel(); };

  if (!isMounted) return null;

  return (
    <>
      <Modal isOpen={deleteConfirm.isOpen} title="Hapus Barcode?" type="danger" icon="trash" onClose={() => setDeleteConfirm({ isOpen: false, itemId: null, barcodeId: "" })} onConfirm={confirmDeleteRowAction} description={<>Yakin menghapus barcode <span className="font-semibold text-red-700">"{deleteConfirm.barcodeId}"</span>?</>}>
        <button onClick={() => setDeleteConfirm({ isOpen: false, itemId: null, barcodeId: "" })} className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg">Batal (Esc)</button>
        <button onClick={confirmDeleteRowAction} className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg flex items-center"><TrashIcon className="w-4 h-4 mr-1.5" /> Hapus (Enter)</button>
      </Modal>

      <Modal isOpen={resetConfirmOpen} title="Peringatan: Reset Data Utuh" type="severe" icon="reset" onClose={() => setResetConfirmOpen(false)} onConfirm={confirmResetDataAction} description={<>Yakin 100% menghapus <span className="font-semibold text-gray-800">SEMUA</span> {scannedItems.length} data?</>}>
        <button onClick={() => setResetConfirmOpen(false)} className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg">Batal (Esc)</button>
        <button onClick={confirmResetDataAction} className="px-5 py-2 bg-red-700 hover:bg-red-800 text-white text-sm font-medium rounded-lg flex items-center"><ArrowPathIcon className="w-4 h-4 mr-1.5" /> Reset SEMUA Data (Enter)</button>
      </Modal>

      <Modal isOpen={alertModal.isOpen} title={alertModal.title} type="warning" icon="warning" onClose={() => setAlertModal({ isOpen: false, title: "", message: "" })} onConfirm={() => setAlertModal({ isOpen: false, title: "", message: "" })} description={alertModal.message}>
        <button onClick={() => setAlertModal({ isOpen: false, title: "", message: "" })} className="px-5 py-2 bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-medium rounded-lg">Mengerti (Enter/Esc)</button>
      </Modal>

      <Modal 
        isOpen={duplicateModal.isOpen} 
        title="Barcode Sudah Ada!" 
        type="warning" icon="warning" 
        onClose={handleDuplicateCancel} 
        onConfirm={handleDuplicateCancel} 
        description={<>ID Barcode <span className="font-semibold text-blue-600">"{duplicateModal.pendingBarcode}"</span> sudah ada. Apa yang ingin kamu lakukan?</>}
      >
        <button onClick={handleDuplicateCancel} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg">Batal (Esc/Enter)</button>
        <button onClick={handleDuplicateReplace} className="px-4 py-2 bg-blue-50 border border-blue-200 text-blue-700 text-sm font-medium rounded-lg">Timpa Waktu</button>
        <button onClick={handleDuplicateContinue} className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-medium rounded-lg flex items-center gap-1.5"><ExclamationTriangleIcon className="w-4 h-4"/> Tetap Tambahkan</button>
      </Modal>

      <Modal isOpen={showNewSheetModal} title="Buat Kategori Kertas Baru" type="warning" icon="warning" onClose={() => setShowNewSheetModal(false)} onConfirm={handleCreateNewSheet} 
        description={
          <div className="pt-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">Nama Kategori (Contoh: Part Head)</label>
            <input 
              type="text" 
              value={newSheetName} 
              onChange={(e) => setNewSheetName(e.target.value)} 
              onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }} 
              onKeyUp={(e) => { if (e.key === 'Enter') handleCreateNewSheet(); }} 
              className="w-full p-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 transition-all text-gray-800" 
              placeholder="Masukkan nama kategori..." 
              autoFocus 
            />
          </div>
        }>
        <button onClick={() => setShowNewSheetModal(false)} className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg">Batal</button>
        <button onClick={handleCreateNewSheet} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg flex items-center"><PlusIcon className="w-4 h-4 mr-1.5" /> Buat Kategori</button>
      </Modal>

      <div className="flex flex-col xl:flex-row gap-8 h-[calc(100vh-8rem)]">
        <div className="w-full xl:w-1/3 flex flex-col gap-6 shrink-0 overflow-y-auto pb-4">
          
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <label className="block text-sm font-bold text-gray-700 mb-3 uppercase tracking-wider">Input Scanner</label>
            <p className="text-xs text-gray-500 mb-4">Arahkan alat ke barcode, data otomatis tersimpan.</p>
            
            <div className="flex gap-2">
              <input 
                type="text" 
                ref={inputRef} 
                value={barcodeData} 
                onChange={(e) => setBarcodeData(e.target.value)} 
                
                // MENGGUNAKAN LOGIKA BARU DI SINI 👇
                onKeyDown={handleKeyDown} 
                onKeyUp={handleKeyUp} 
                
                disabled={anyModalOpen} 
                className="w-full p-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-base disabled:bg-gray-100 disabled:cursor-not-allowed" 
                placeholder={anyModalOpen ? "Menunggu aksi..." : "Scan barcode di sini..."} 
                autoFocus 
                onBlur={() => { if (!anyModalOpen) inputRef.current?.focus(); }} 
              />
              <button 
                onClick={submitBarcodeData}
                disabled={anyModalOpen || barcodeData.trim() === ""}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 rounded-lg transition-colors shadow-sm shrink-0 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed"
              >
                Add
              </button>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center space-x-2 mb-3">
              <FolderOpenIcon className="w-5 h-5 text-gray-500" />
              <label className="block text-sm font-bold text-gray-700 uppercase tracking-wider">Input Category</label>
            </div>
            <p className="text-xs text-gray-500 mb-4">Pilih kategori untuk pindaian selanjutnya. Data akan otomatis masuk ke sheet tujuan.</p>
            <div className="flex space-x-2">
              <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="flex-1 p-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white text-gray-700 transition-all text-sm cursor-pointer">
                <option value="Default">Default</option>
                {sheets.filter(s => s !== "All Data").map(sheet => <option key={sheet} value={sheet}>{sheet}</option>)}
              </select>
              <button onClick={() => setShowNewSheetModal(true)} className="bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 p-3 rounded-lg transition-colors flex items-center justify-center shrink-0" title="Tambah Kategori Baru"><PlusIcon className="w-5 h-5" /></button>
            </div>
          </div>
        </div>
        
        <div className="w-full xl:w-2/3 flex flex-col bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center bg-gray-50/50 gap-4 sm:gap-0 shrink-0">
            <h3 className="font-bold text-gray-800">10 Log Pindaian Terbaru</h3>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex bg-gray-100 rounded-lg p-1 border border-gray-200">
                <button onClick={handleUndo} disabled={pastStates.length === 0} className={`p-1.5 rounded-md flex items-center transition-all ${pastStates.length > 0 ? "bg-white text-gray-700 shadow-sm hover:text-blue-600" : "text-gray-400 cursor-not-allowed opacity-60"}`} title="Undo (Ctrl+Z)"><ArrowUturnLeftIcon className="w-4 h-4" /></button>
                <button onClick={handleRedo} disabled={futureStates.length === 0} className={`p-1.5 rounded-md flex items-center transition-all ml-1 ${futureStates.length > 0 ? "bg-white text-gray-700 shadow-sm hover:text-blue-600" : "text-gray-400 cursor-not-allowed opacity-60"}`} title="Redo (Ctrl+Y)"><ArrowUturnRightIcon className="w-4 h-4" /></button>
              </div>
              <button onClick={exportToExcelWithAlert} className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium py-2 px-4 rounded-lg shadow-sm">Unduh Excel</button>
              {scannedItems.length > 0 && <button onClick={() => setResetConfirmOpen(true)} className="bg-red-50 hover:bg-red-100 text-red-600 text-sm font-medium py-2 px-4 rounded-lg border border-red-200">Reset Data</button>}
            </div>
          </div>
          <div className="flex-1 overflow-auto bg-white">
            <table className="w-full text-left border-collapse min-w-[500px]">
              <thead className="sticky top-0 bg-white shadow-sm z-10">
                <tr className="text-xs uppercase tracking-wider text-gray-500 border-b border-gray-200">
                  <th className="p-4 font-semibold w-16">No</th>
                  <th className="p-4 font-semibold">ID Barcode</th>
                  <th className="p-4 font-semibold">Waktu Scan</th>
                  <th className="p-4 font-semibold text-center w-32">Kategori</th>
                  <th className="p-4 font-semibold w-24 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {scannedItems.length === 0 ? (
                  <tr><td colSpan={5} className="p-16 text-center text-gray-400">Belum ada data pindaian barcode.</td></tr>
                ) : (
                  scannedItems.slice(0, 10).map((item, index) => (
                    <tr key={item.id} className="border-b border-gray-100 last:border-0 hover:bg-blue-50/30 transition-colors group">
                      <td className="p-4 text-gray-600">{index + 1}</td>
                      <td className="p-4 font-medium text-gray-900 break-all">{item.barcode_id}</td>
                      <td className="p-4 text-gray-600">{item.created_at}</td>
                      <td className="p-4 text-center">
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs font-medium border border-gray-200 inline-block max-w-[120px] truncate" title={item.category || "Default"}>
                          {item.category || "Default"}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <button onClick={() => setDeleteConfirm({ isOpen: true, itemId: item.id, barcodeId: item.barcode_id })} className="p-2 text-red-500 hover:text-red-700 hover:bg-red-100 rounded-lg transition-colors" title="Hapus Baris">
                          <TrashIcon className="w-5 h-5"/>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}