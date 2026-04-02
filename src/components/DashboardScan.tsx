"use client";

import { useState, useRef, useEffect } from "react";
import * as XLSX from "xlsx-js-style";
import { 
  TrashIcon, ArrowPathIcon, ExclamationTriangleIcon, ArrowUturnLeftIcon, 
  ArrowUturnRightIcon, PlusIcon, Cog6ToothIcon, CheckCircleIcon, PencilIcon, ChevronDownIcon, DocumentArrowDownIcon
} from "@heroicons/react/24/outline";
import Modal from "./ui/Modal"; 

export type ScanItem = { 
  id: string; 
  barcode_id: string; 
  copro: string;
  nama_penerima: string; 
  kategori: string; 
  waktu_diterima: string;
  waktu_dikembalikan: string | null;
  timestamp_diterima: number; 
  custom_data?: Record<string, string>; 
};

export default function DashboardScan() {
  const [scannedItems, setScannedItems] = useState<ScanItem[]>([]);
  const [barcodeData, setBarcodeData] = useState<string>("");
  const [isMounted, setIsMounted] = useState<boolean>(false);
  
  const [tabs, setTabs] = useState<string[]>(["All Drawing", "Drawing App Internal", "Tanda Terima Drawing"]);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  
  const [coproList, setCoproList] = useState<string[]>(["611600", "611601"]);
  const [selectedCopro, setSelectedCopro] = useState<string>(""); 
  
  const [penerimaList, setPenerimaList] = useState<string[]>(["Budi", "Agus", "Siti"]);
  const [selectedPenerima, setSelectedPenerima] = useState<string>(""); 

  const [coproDropdownOpen, setCoproDropdownOpen] = useState(false);
  const [penerimaDropdownOpen, setPenerimaDropdownOpen] = useState(false);
  const coproRef = useRef<HTMLDivElement>(null);
  const penerimaRef = useRef<HTMLDivElement>(null);

  const [listModal, setListModal] = useState({ isOpen: false, mode: 'add' as 'add' | 'edit' | 'delete', type: 'copro' as 'copro' | 'penerima', oldName: "", newName: "" });

  const [pastStates, setPastStates] = useState<ScanItem[][]>([]);
  const [futureStates, setFutureStates] = useState<ScanItem[][]>([]);

  const [duplicateModal, setDuplicateModal] = useState({ isOpen: false, pendingBarcode: "" });
  const [returnModal, setReturnModal] = useState({ isOpen: false, pendingBarcode: "", existingItemId: "" });
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, itemId: null as string | null, barcodeId: "" });
  const [resetConfirmOpen, setResetConfirmOpen] = useState<boolean>(false);
  const [alertModal, setAlertModal] = useState({ isOpen: false, title: "", message: "" });

  const inputRef = useRef<HTMLInputElement>(null);
  const latestItemsRef = useRef<ScanItem[]>([]);

  const anyModalOpen = duplicateModal.isOpen || returnModal.isOpen || deleteConfirm.isOpen || resetConfirmOpen || listModal.isOpen || alertModal.isOpen;

  useEffect(() => {
    setIsMounted(true);
    const savedData = localStorage.getItem("winteq_drawing_data");
    const savedCopro = localStorage.getItem("winteq_drawing_coprolist");
    const savedPenerima = localStorage.getItem("winteq_drawing_penerimalist");
    const savedTabs = localStorage.getItem("winteq_drawing_tabs");
    
    const uiCategory = localStorage.getItem("winteq_dash_cat");
    const uiCopro = localStorage.getItem("winteq_dash_copro");
    const uiPenerima = localStorage.getItem("winteq_dash_penerima");

    if (savedData) { const parsed = JSON.parse(savedData); setScannedItems(parsed); latestItemsRef.current = parsed; }
    if (savedCopro) setCoproList(JSON.parse(savedCopro));
    if (savedPenerima) setPenerimaList(JSON.parse(savedPenerima));

    if (savedTabs) {
      const parsedTabs = JSON.parse(savedTabs); setTabs(parsedTabs);
      if (uiCategory && parsedTabs.includes(uiCategory)) setSelectedCategory(uiCategory);
      else setSelectedCategory(parsedTabs[2] || "Tanda Terima Drawing");
    } else { setSelectedCategory("Tanda Terima Drawing"); }

    if (uiCopro !== null) setSelectedCopro(uiCopro);
    if (uiPenerima !== null) setSelectedPenerima(uiPenerima);
  }, []);

  useEffect(() => {
    if (isMounted) {
      localStorage.setItem("winteq_drawing_data", JSON.stringify(scannedItems));
      localStorage.setItem("winteq_drawing_coprolist", JSON.stringify(coproList));
      localStorage.setItem("winteq_drawing_penerimalist", JSON.stringify(penerimaList));
      localStorage.setItem("winteq_dash_cat", selectedCategory);
      localStorage.setItem("winteq_dash_copro", selectedCopro);
      localStorage.setItem("winteq_dash_penerima", selectedPenerima);
    }
  }, [scannedItems, coproList, penerimaList, selectedCategory, selectedCopro, selectedPenerima, isMounted]);

  useEffect(() => { if (!anyModalOpen) inputRef.current?.focus(); }, [scannedItems, anyModalOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (coproRef.current && !coproRef.current.contains(e.target as Node)) setCoproDropdownOpen(false);
      if (penerimaRef.current && !penerimaRef.current.contains(e.target as Node)) setPenerimaDropdownOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside); return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // --- PERBAIKAN: LOGIKA UNDO REDO DISAMAKAN 100% DENGAN SCAN LOG ---
  const saveHistory = () => { 
    setPastStates((prev) => [...prev.slice(-19), scannedItems]); 
    setFutureStates([]); 
  };
  
  const handleUndo = () => { 
    if (pastStates.length === 0) return; 
    const previousState = pastStates[pastStates.length - 1]; 
    setPastStates((prev) => prev.slice(0, -1)); 
    setFutureStates((prev) => [...prev, scannedItems]); 
    latestItemsRef.current = previousState; // Sinkronisasi paksa ke Ref
    setScannedItems(previousState); 
  };
  
  const handleRedo = () => { 
    if (futureStates.length === 0) return; 
    const nextState = futureStates[futureStates.length - 1]; 
    setFutureStates((prev) => prev.slice(0, -1)); 
    setPastStates((prev) => [...prev, scannedItems]); 
    latestItemsRef.current = nextState; // Sinkronisasi paksa ke Ref
    setScannedItems(nextState); 
  };

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (anyModalOpen) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); handleUndo(); } 
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); handleRedo(); }
    };
    window.addEventListener('keydown', handleGlobalKeyDown); return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [pastStates, futureStates, scannedItems, anyModalOpen]); // Tambahan `scannedItems` agar Undo Keyboard selalu dapat data segar!

  const submitBarcodeData = () => {
    if (barcodeData.trim() === "" || anyModalOpen) return;
    const currentBarcode = barcodeData.trim();
    const existingItemIndex = latestItemsRef.current.findIndex(item => item.barcode_id === currentBarcode);

    if (existingItemIndex > -1) {
      const existingItem = latestItemsRef.current[existingItemIndex];
      if (selectedCategory !== tabs[1]) {
        if (!existingItem.waktu_dikembalikan) {
          setReturnModal({ isOpen: true, pendingBarcode: currentBarcode, existingItemId: existingItem.id });
          setBarcodeData(""); return;
        } else {
          setDuplicateModal({ isOpen: true, pendingBarcode: currentBarcode });
          setBarcodeData(""); return;
        }
      } else {
        setDuplicateModal({ isOpen: true, pendingBarcode: currentBarcode });
        setBarcodeData(""); return;
      }
    }
    
    saveHistory(); 
    const finalCopro = selectedCopro === "" ? currentBarcode.substring(0, 6) : selectedCopro;
    if (finalCopro && !coproList.includes(finalCopro)) { setCoproList(prev => [...prev, finalCopro]); }

    const newItem: ScanItem = { 
      id: crypto.randomUUID(), barcode_id: currentBarcode, copro: finalCopro,
      nama_penerima: selectedCategory === tabs[1] ? "" : selectedPenerima, 
      kategori: selectedCategory, waktu_diterima: new Date().toLocaleString("id-ID"), waktu_dikembalikan: null, timestamp_diterima: Date.now()
    };
    
    const newData = [newItem, ...latestItemsRef.current];
    latestItemsRef.current = newData; setScannedItems(newData); setBarcodeData(""); inputRef.current?.focus(); 
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === "Enter") e.preventDefault(); };
  const handleKeyUp = (e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === "Enter") submitBarcodeData(); };
  
  const confirmDeleteRowAction = () => { 
    if (deleteConfirm.itemId) { 
      saveHistory(); 
      const newData = latestItemsRef.current.filter((item) => item.id !== deleteConfirm.itemId); 
      latestItemsRef.current = newData; setScannedItems(newData); 
    } 
    setDeleteConfirm({ isOpen: false, itemId: null, barcodeId: "" }); 
  };
  
  const confirmResetDataAction = () => { 
    saveHistory(); 
    latestItemsRef.current = []; 
    setScannedItems([]); 
    setResetConfirmOpen(false); 
  };
  
  const handleListAction = () => {
    if (listModal.mode === 'delete') {
      if (listModal.type === 'copro') { const newList = coproList.filter(c => c !== listModal.oldName); setCoproList(newList); if (selectedCopro === listModal.oldName) setSelectedCopro(newList[0] || ""); } 
      else { const newList = penerimaList.filter(p => p !== listModal.oldName); setPenerimaList(newList); if (selectedPenerima === listModal.oldName) setSelectedPenerima(""); }
    } else {
      const val = listModal.newName.trim(); if (!val) return;
      if (listModal.mode === 'add') {
        if (listModal.type === 'copro' && !coproList.includes(val)) { setCoproList([...coproList, val]); setSelectedCopro(val); } 
        else if (listModal.type === 'penerima' && !penerimaList.includes(val)) { setPenerimaList([...penerimaList, val]); setSelectedPenerima(val); }
      } else if (listModal.mode === 'edit') {
        if (listModal.type === 'copro' && coproList.includes(val) && val !== listModal.oldName) return; 
        if (listModal.type === 'penerima' && penerimaList.includes(val) && val !== listModal.oldName) return; 
        saveHistory(); 
        if (listModal.type === 'copro') {
          setCoproList(coproList.map(c => c === listModal.oldName ? val : c)); setSelectedCopro(val);
          const newData = latestItemsRef.current.map(i => i.copro === listModal.oldName ? { ...i, copro: val } : i); latestItemsRef.current = newData; setScannedItems(newData);
        } else {
          setPenerimaList(penerimaList.map(p => p === listModal.oldName ? val : p)); setSelectedPenerima(val);
          const newData = latestItemsRef.current.map(i => i.nama_penerima === listModal.oldName ? { ...i, nama_penerima: val } : i); latestItemsRef.current = newData; setScannedItems(newData);
        }
      }
    }
    setListModal({ ...listModal, isOpen: false }); setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleReturnCancel = () => { setReturnModal({ isOpen: false, pendingBarcode: "", existingItemId: "" }); setTimeout(() => inputRef.current?.focus(), 100); };
  const handleReturnConfirm = () => {
    saveHistory();
    const updatedData = [...latestItemsRef.current];
    const idx = updatedData.findIndex(i => i.id === returnModal.existingItemId);
    if (idx > -1) {
      updatedData[idx] = { ...updatedData[idx], waktu_dikembalikan: new Date().toLocaleString("id-ID") };
      const itemToMove = updatedData.splice(idx, 1)[0]; updatedData.unshift(itemToMove);
      latestItemsRef.current = updatedData; setScannedItems(updatedData);
      setAlertModal({ isOpen: true, title: "Drawing Dikembalikan!", message: `Drawing ${updatedData[0].barcode_id} berhasil dicatat sebagai SUDAH DIKEMBALIKAN.` });
    }
    handleReturnCancel();
  };

  const handleDuplicateCancel = () => { setDuplicateModal({ isOpen: false, pendingBarcode: "" }); setTimeout(() => inputRef.current?.focus(), 100); };
  const handleDuplicateReplace = () => {
    saveHistory(); 
    const pendingTrimmed = duplicateModal.pendingBarcode.trim();
    const finalCopro = selectedCopro === "" ? pendingTrimmed.substring(0, 6) : selectedCopro;
    if (finalCopro && !coproList.includes(finalCopro)) { setCoproList(prev => [...prev, finalCopro]); }

    const newItem: ScanItem = { 
      id: crypto.randomUUID(), barcode_id: pendingTrimmed, copro: finalCopro, nama_penerima: selectedCategory === tabs[1] ? "" : selectedPenerima,
      kategori: selectedCategory, waktu_diterima: new Date().toLocaleString("id-ID"), waktu_dikembalikan: null, timestamp_diterima: Date.now()
    };
    const filtered = latestItemsRef.current.filter(item => item.barcode_id !== pendingTrimmed);
    latestItemsRef.current = [newItem, ...filtered]; setScannedItems(latestItemsRef.current);
    handleDuplicateCancel();
  };
  
  const handleDuplicateAddAnyway = () => {
    saveHistory(); 
    const pendingTrimmed = duplicateModal.pendingBarcode.trim();
    const finalCopro = selectedCopro === "" ? pendingTrimmed.substring(0, 6) : selectedCopro;
    if (finalCopro && !coproList.includes(finalCopro)) { setCoproList(prev => [...prev, finalCopro]); }

    const newItem: ScanItem = { 
      id: crypto.randomUUID(), barcode_id: pendingTrimmed, copro: finalCopro, nama_penerima: selectedCategory === tabs[1] ? "" : selectedPenerima,
      kategori: selectedCategory, waktu_diterima: new Date().toLocaleString("id-ID"), waktu_dikembalikan: null, timestamp_diterima: Date.now()
    };
    latestItemsRef.current = [newItem, ...latestItemsRef.current]; setScannedItems(latestItemsRef.current);
    handleDuplicateCancel();
  };

  const displayedItems = scannedItems.filter(item => item.kategori === selectedCategory).slice(0, 7);

  const exportToExcelWithAlert = () => {
    if (displayedItems.length === 0) return setAlertModal({ isOpen: true, title: "Data Kosong", message: "Belum ada data pindaian di kategori ini yang bisa diunduh." });
    
    const headers = ["NO", "ID BARCODE", "WAKTU DITERIMA", "KATEGORI"];
    const rows = displayedItems.map((item, i) => [ i + 1, item.barcode_id, item.waktu_diterima, item.kategori ]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws['!cols'] = [{ wpx: 60 }, { wpx: 220 }, { wpx: 200 }, { wpx: 150 }];
    
    for (const key in ws) {
      if (key[0] === '!') continue; 
      const cell = ws[key]; const rowIndex = parseInt(key.replace(/[A-Z]/g, '')); const colLetter = key.replace(/[0-9]/g, '');
      let hAlign = "left"; if (colLetter === 'A' || colLetter === 'C' || colLetter === 'D') hAlign = "center";
      cell.s = { font: { name: "Arial", sz: 11, color: { rgb: "1F2937" } }, alignment: { horizontal: hAlign, vertical: "top", wrapText: true }, border: { bottom: { style: "thin", color: { rgb: "D1D5DB" } } } };
      if (rowIndex === 1) { cell.s.font.bold = true; cell.s.font.color = { rgb: "111827" }; cell.s.fill = { fgColor: { rgb: "E5E7EB" } }; cell.s.alignment.horizontal = "center"; cell.s.alignment.vertical = "center"; cell.s.border = { bottom: { style: "medium", color: { rgb: "9CA3AF" } } }; }
    }
    const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, ws, "10_Log_Terbaru"); XLSX.writeFile(workbook, `Laporan_${selectedCategory.replace(/\s+/g, '_')}.xlsx`);
  };

  if (!isMounted) return null;

  return (
    <>
      <style>{`.thin-scrollbar::-webkit-scrollbar { width: 6px; } .thin-scrollbar::-webkit-scrollbar-track { background: transparent; } .thin-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 10px; } .thin-scrollbar::-webkit-scrollbar-thumb:hover { background-color: #94a3b8; }`}</style>

      <Modal isOpen={deleteConfirm.isOpen} title="Hapus Barcode?" type="danger" icon="trash" onClose={() => setDeleteConfirm({ isOpen: false, itemId: null, barcodeId: "" })} onConfirm={confirmDeleteRowAction} description={<>Yakin menghapus barcode <span className="font-semibold text-red-700">"{deleteConfirm.barcodeId}"</span>?</>}>
        <button onClick={() => setDeleteConfirm({ isOpen: false, itemId: null, barcodeId: "" })} className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg">Batal (Esc)</button>
        <button onClick={confirmDeleteRowAction} className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg flex items-center"><TrashIcon className="w-4 h-4 mr-1.5" /> Hapus (Enter)</button>
      </Modal>

      <Modal isOpen={resetConfirmOpen} title="Peringatan: Reset Data Utuh" type="severe" icon="reset" onClose={() => setResetConfirmOpen(false)} onConfirm={confirmResetDataAction} description={<>Yakin 100% menghapus <span className="font-semibold text-gray-800">SEMUA</span> {scannedItems.length} data drawing?</>}>
        <button onClick={() => setResetConfirmOpen(false)} className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg">Batal (Esc)</button>
        <button onClick={confirmResetDataAction} className="px-5 py-2 bg-red-700 hover:bg-red-800 text-white text-sm font-medium rounded-lg flex items-center"><ArrowPathIcon className="w-4 h-4 mr-1.5" /> Reset SEMUA Data</button>
      </Modal>

      <Modal isOpen={alertModal.isOpen} title={alertModal.title} type="warning" icon="warning" onClose={() => setAlertModal({ ...alertModal, isOpen: false })} onConfirm={() => setAlertModal({ ...alertModal, isOpen: false })} description={alertModal.message}>
        <button onClick={() => setAlertModal({ ...alertModal, isOpen: false })} className="px-5 py-2 bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-medium rounded-lg">Mengerti (Enter/Esc)</button>
      </Modal>

      <Modal isOpen={returnModal.isOpen} title="Konfirmasi Pengembalian" type="warning" icon="warning" onClose={handleReturnCancel} onConfirm={handleReturnConfirm} description={<>Drawing <span className="font-semibold text-blue-600">"{returnModal.pendingBarcode}"</span> sudah tercatat DITERIMA. Apakah Anda ingin mengembalikan drawing ini?</>}>
        <button onClick={handleReturnCancel} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg">Batal (Esc)</button>
        <button onClick={handleReturnConfirm} className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-lg flex items-center gap-1.5"><CheckCircleIcon className="w-4 h-4"/> Drawing Dikembalikan</button>
      </Modal>

      <Modal isOpen={duplicateModal.isOpen} title="Barcode Sudah Ada!" type="warning" icon="warning" onClose={handleDuplicateCancel} onConfirm={handleDuplicateCancel} description={<>Drawing <span className="font-semibold text-blue-600">"{duplicateModal.pendingBarcode}"</span> sudah tercatat di sistem secara penuh. Apa yang ingin kamu lakukan?</>}>
        <button onClick={handleDuplicateCancel} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg">Batal (Esc)</button>
        <button onClick={handleDuplicateReplace} className="px-4 py-2 bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 text-sm font-medium rounded-lg flex items-center gap-1.5"><ExclamationTriangleIcon className="w-4 h-4"/> Timpa Data Lama</button>
        <button onClick={handleDuplicateAddAnyway} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg flex items-center gap-1.5"><PlusIcon className="w-4 h-4"/> Tetap Tambahkan (Dobel)</button>
      </Modal>

      <Modal 
        isOpen={listModal.isOpen} 
        title={listModal.mode === 'delete' ? `Hapus ${listModal.type.toUpperCase()}?` : `${listModal.mode === 'edit' ? 'Edit' : 'Tambah'} ${listModal.type.toUpperCase()}`} 
        type={listModal.mode === 'delete' ? 'danger' : 'warning'} 
        icon={listModal.mode === 'delete' ? 'trash' : 'warning'} 
        onClose={() => setListModal({ ...listModal, isOpen: false })} 
        onConfirm={handleListAction} 
        description={
          listModal.mode === 'delete' ? (
            <>Yakin menghapus <span className="font-semibold text-red-700">"{listModal.oldName}"</span> dari daftar pilihan?</>
          ) : (
            <div className="pt-2">
              <input type="text" value={listModal.newName} onChange={(e) => setListModal({...listModal, newName: e.target.value})} onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }} onKeyUp={(e) => { if (e.key === 'Enter') handleListAction(); }} className="w-full p-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 transition-all text-gray-800" placeholder={`Masukkan Nama ${listModal.type}...`} autoFocus />
            </div>
          )
        }>
        <button onClick={() => setListModal({ ...listModal, isOpen: false })} className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg">Batal</button>
        <button onClick={handleListAction} className={`px-5 py-2 text-white text-sm font-medium rounded-lg flex items-center ${listModal.mode === 'delete' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
          {listModal.mode === 'delete' ? <TrashIcon className="w-4 h-4 mr-1.5" /> : (listModal.mode === 'edit' ? <PencilIcon className="w-4 h-4 mr-1.5" /> : <PlusIcon className="w-4 h-4 mr-1.5" />)}
          {listModal.mode === 'delete' ? 'Hapus' : (listModal.mode === 'edit' ? 'Simpan Perubahan' : 'Tambah')}
        </button>
      </Modal>

      <div className="flex flex-col xl:flex-row gap-8 h-[calc(100vh-8rem)]">
        
        <div className="w-full xl:w-1/3 flex flex-col gap-6 shrink-0 pb-4 z-10">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <label className="block text-sm font-bold text-gray-700 mb-3 uppercase tracking-wider">Input Scanner</label>
            <p className="text-xs text-gray-500 mb-4">Arahkan alat ke barcode. Sistem otomatis mendeteksi Penerimaan/Pengembalian.</p>
            <div className="flex gap-2">
              <input type="text" ref={inputRef} value={barcodeData} onChange={(e) => setBarcodeData(e.target.value)} onKeyDown={handleKeyDown} onKeyUp={handleKeyUp} disabled={anyModalOpen} className="w-full p-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-base" placeholder="Scan Nomer Drawing..." autoFocus onBlur={() => { if (!anyModalOpen) inputRef.current?.focus(); }} />
              <button onClick={submitBarcodeData} disabled={anyModalOpen || barcodeData.trim() === ""} className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 rounded-lg transition-colors shadow-sm shrink-0">Add</button>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-5">
            <div className="flex items-center space-x-2 border-b border-gray-100 pb-3">
              <Cog6ToothIcon className="w-5 h-5 text-gray-500" />
              <label className="block text-sm font-bold text-gray-700 uppercase tracking-wider">Pengaturan Scan</label>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-2 uppercase">1. Kategori Drawing</p>
              <div className="flex bg-gray-100 p-1.5 rounded-lg">
                <button onClick={() => setSelectedCategory(tabs[1])} className={`flex-1 py-2.5 px-2 text-sm font-bold rounded-md transition-all ${selectedCategory === tabs[1] ? 'bg-white text-blue-700 shadow-sm ring-1 ring-black/5' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'}`}>{tabs[1]}</button>
                <button onClick={() => setSelectedCategory(tabs[2])} className={`flex-1 py-2.5 px-2 text-sm font-bold rounded-md transition-all ${selectedCategory === tabs[2] ? 'bg-white text-blue-700 shadow-sm ring-1 ring-black/5' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'}`}>{tabs[2]}</button>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-2 uppercase">2. COPRO</p>
              <div className="flex space-x-2 relative">
                <div className="relative flex-1" ref={coproRef}>
                  <div className="w-full p-3 border-2 border-gray-300 rounded-lg bg-white text-gray-700 text-sm cursor-pointer flex justify-between items-center" onClick={() => setCoproDropdownOpen(!coproDropdownOpen)}>
                    <span>{selectedCopro || "-- Input Copro Otomatis --"}</span>
                    <ChevronDownIcon className="w-4 h-4 text-gray-500" />
                  </div>
                  {coproDropdownOpen && (
                    <div className="absolute z-[100] top-full left-0 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto thin-scrollbar">
                      <div className="px-4 py-2 hover:bg-gray-50 cursor-pointer text-sm text-gray-500 italic border-b border-gray-100" onClick={() => { setSelectedCopro(""); setCoproDropdownOpen(false); }}>-- Input Copro Otomatis --</div>
                      {coproList.map(c => (
                        <div key={c} className="flex justify-between items-center px-4 py-2 hover:bg-gray-50 cursor-pointer group" onClick={() => { setSelectedCopro(c); setCoproDropdownOpen(false); }}>
                          <span className="text-sm text-gray-700">{c}</span>
                          <div className="flex space-x-1">
                            <button onClick={(e) => { e.stopPropagation(); setListModal({ isOpen: true, mode: 'edit', type: 'copro', oldName: c, newName: c }); setCoproDropdownOpen(false); }} className="text-blue-500 hover:bg-blue-100 p-1.5 rounded transition-colors" title="Edit"><PencilIcon className="w-4 h-4" /></button>
                            <button onClick={(e) => { e.stopPropagation(); setListModal({ isOpen: true, mode: 'delete', type: 'copro', oldName: c, newName: "" }); setCoproDropdownOpen(false); }} className="text-red-500 hover:bg-red-100 p-1.5 rounded transition-colors" title="Hapus"><TrashIcon className="w-4 h-4" /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <button onClick={() => setListModal({ isOpen: true, mode: 'add', type: 'copro', oldName: "", newName: "" })} className="bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 p-3 rounded-lg flex items-center justify-center shrink-0" title="Tambah Copro Baru"><PlusIcon className="w-5 h-5" /></button>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-2 uppercase">3. Nama Penerima</p>
              <div className="flex space-x-2 relative">
                <div className="relative flex-1" ref={penerimaRef}>
                  <div className={`w-full p-3 border-2 border-gray-300 rounded-lg bg-white text-gray-700 text-sm flex justify-between items-center ${selectedCategory === tabs[1] ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'cursor-pointer'}`} onClick={() => { if (selectedCategory !== tabs[1]) setPenerimaDropdownOpen(!penerimaDropdownOpen); }}>
                    <span>{selectedPenerima || "-- Biarkan Kosong --"}</span>
                    <ChevronDownIcon className="w-4 h-4 text-gray-500" />
                  </div>
                  {penerimaDropdownOpen && selectedCategory !== tabs[1] && (
                    <div className="absolute z-[100] top-full left-0 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto thin-scrollbar">
                      <div className="px-4 py-2 hover:bg-gray-50 cursor-pointer text-sm text-gray-500 italic border-b border-gray-100" onClick={() => { setSelectedPenerima(""); setPenerimaDropdownOpen(false); }}>-- Biarkan Kosong --</div>
                      {penerimaList.map(p => (
                        <div key={p} className="flex justify-between items-center px-4 py-2 hover:bg-gray-50 cursor-pointer group" onClick={() => { setSelectedPenerima(p); setPenerimaDropdownOpen(false); }}>
                          <span className="text-sm text-gray-700">{p}</span>
                          <div className="flex space-x-1">
                            <button onClick={(e) => { e.stopPropagation(); setListModal({ isOpen: true, mode: 'edit', type: 'penerima', oldName: p, newName: p }); setPenerimaDropdownOpen(false); }} className="text-blue-500 hover:bg-blue-100 p-1.5 rounded transition-colors" title="Edit"><PencilIcon className="w-4 h-4" /></button>
                            <button onClick={(e) => { e.stopPropagation(); setListModal({ isOpen: true, mode: 'delete', type: 'penerima', oldName: p, newName: "" }); setPenerimaDropdownOpen(false); }} className="text-red-500 hover:bg-red-100 p-1.5 rounded transition-colors" title="Hapus"><TrashIcon className="w-4 h-4" /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <button onClick={() => setListModal({ isOpen: true, mode: 'add', type: 'penerima', oldName: "", newName: "" })} disabled={selectedCategory === tabs[1]} className="bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 p-3 rounded-lg flex items-center justify-center shrink-0 disabled:opacity-50 disabled:cursor-not-allowed" title="Tambah Penerima Baru"><PlusIcon className="w-5 h-5" /></button>
              </div>
              {selectedCategory === tabs[1] && <p className="text-xs text-red-500 mt-1 italic">*Internal tidak memerlukan nama penerima.</p>}
            </div>
          </div>
        </div>
        
        <div className="w-full xl:w-2/3 flex flex-col bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden z-0">
          <div className="p-4 sm:p-5 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center bg-gray-50/50 gap-4 sm:gap-0 shrink-0">
            <h3 className="font-bold text-gray-800">10 Log Terbaru: <span className="text-blue-700 font-extrabold">{selectedCategory}</span></h3>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex bg-gray-100 rounded-lg p-1 border border-gray-200">
                <button onClick={handleUndo} disabled={pastStates.length === 0} className={`p-1.5 rounded-md flex items-center transition-all ${pastStates.length > 0 ? "bg-white text-gray-700 shadow-sm hover:text-blue-600" : "text-gray-400 cursor-not-allowed opacity-60"}`}><ArrowUturnLeftIcon className="w-4 h-4" /></button>
                <button onClick={handleRedo} disabled={futureStates.length === 0} className={`p-1.5 rounded-md flex items-center transition-all ml-1 ${futureStates.length > 0 ? "bg-white text-gray-700 shadow-sm hover:text-blue-600" : "text-gray-400 cursor-not-allowed opacity-60"}`}><ArrowUturnRightIcon className="w-4 h-4" /></button>
              </div>
              <button onClick={exportToExcelWithAlert} className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium py-2 px-4 rounded-lg shadow-sm flex items-center">
                <DocumentArrowDownIcon className="w-4 h-4 mr-1.5" /> Unduh Excel
              </button>
              {scannedItems.length > 0 && <button onClick={() => setResetConfirmOpen(true)} className="bg-red-50 hover:bg-red-100 text-red-600 text-sm font-medium py-2 px-4 rounded-lg border border-red-200">Reset Data</button>}
            </div>
          </div>
          <div className="flex-1 overflow-auto bg-white">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead className="sticky top-0 bg-gray-50 shadow-sm z-10 border-b border-gray-200">
                <tr className="text-xs uppercase tracking-wider text-gray-600">
                  <th className="p-4 font-bold text-center w-12">No</th>
                  <th className="p-4 font-bold">Nomer Drawing</th>
                  <th className="p-4 font-bold text-center">Status</th>
                  <th className="p-4 font-bold text-center w-24">Aksi</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {displayedItems.length === 0 ? (
                  <tr><td colSpan={4} className="p-16 text-center text-gray-400">Belum ada data pindaian di kategori ini.</td></tr>
                ) : (
                  displayedItems.map((item, index) => {
                    const isReturned = item.waktu_dikembalikan !== null;
                    return (
                      <tr key={item.id} className="border-b border-gray-100 hover:bg-blue-50/30 transition-colors">
                        <td className="p-4 text-gray-600 text-center">{index + 1}</td>
                        <td className="p-4">
                          <div className="font-bold text-gray-900">{item.barcode_id}</div>
                          <div className="text-xs text-gray-500 mt-1">Copro: {item.copro || "-"} | {item.kategori}</div>
                        </td>
                        <td className="p-4 text-center">
                          {item.kategori === tabs[1] ? (
                            <span className="text-gray-400 font-bold">-</span>
                          ) : isReturned ? (
                            <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-bold border border-green-200 inline-flex items-center"><CheckCircleIcon className="w-3.5 h-3.5 mr-1"/> DIKEMBALIKAN</span> 
                          ) : (
                            <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs font-bold border border-yellow-200">BELUM KEMBALI</span>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          <button onClick={() => setDeleteConfirm({ isOpen: true, itemId: item.id, barcodeId: item.barcode_id })} className="p-2 text-red-500 hover:text-red-700 hover:bg-red-100 rounded-lg"><TrashIcon className="w-5 h-5"/></button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}