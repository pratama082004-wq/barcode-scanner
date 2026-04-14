"use client";

import { useState, useRef, useEffect } from "react";
import * as XLSX from "xlsx-js-style";
import { 
  TrashIcon, ArrowPathIcon, ExclamationTriangleIcon, ArrowUturnLeftIcon, 
  ArrowUturnRightIcon, PlusIcon, Cog6ToothIcon, CheckCircleIcon, PencilIcon, ChevronDownIcon, DocumentArrowDownIcon
} from "@heroicons/react/24/outline";
import Modal from "./ui/Modal"; 

import { 
  getAllScans, upsertScanData, deleteScanData, getSettings, saveSetting, 
  saveHistoryLog, getWorkspaces, addWorkspace, renameWorkspace, deleteWorkspace 
} from "../actions/db";

export type ScanItem = { 
  id: string; 
  workspace: string; 
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
  // ================= STATE WORKSPACE =================
  const [workspaces, setWorkspaces] = useState<string[]>(["Main Log"]);
  const [activeWorkspace, setActiveWorkspace] = useState("Main Log");
  const [workspaceDropdownOpen, setWorkspaceDropdownOpen] = useState(false);
  const workspaceRef = useRef<HTMLDivElement>(null);

  // ================= STATE DATA UTAMA =================
  const [scannedItems, setScannedItems] = useState<ScanItem[]>([]);
  const [barcodeData, setBarcodeData] = useState<string>("");
  
  // ================= STATE ANIMASI & LOADING =================
  const [isDataLoaded, setIsDataLoaded] = useState<boolean>(false);
  const [isSwitching, setIsSwitching] = useState<boolean>(false); 
  
  // ================= STATE PENGATURAN SCAN =================
  const [tabs, setTabs] = useState<string[]>(["All Drawing", "Drawing App Internal", "Tanda Terima Drawing"]);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  
  const [coproList, setCoproList] = useState<string[]>([]);
  const [selectedCopro, setSelectedCopro] = useState<string>(""); 
  
  const [penerimaList, setPenerimaList] = useState<string[]>([]);
  const [selectedPenerima, setSelectedPenerima] = useState<string>(""); 

  const [coproDropdownOpen, setCoproDropdownOpen] = useState(false);
  const [penerimaDropdownOpen, setPenerimaDropdownOpen] = useState(false);
  const coproRef = useRef<HTMLDivElement>(null);
  const penerimaRef = useRef<HTMLDivElement>(null);

  // ================= STATE MODAL & HISTORY =================
  const [listModal, setListModal] = useState({ 
    isOpen: false, 
    mode: 'add' as 'add' | 'edit' | 'delete', 
    type: 'copro' as 'copro' | 'penerima' | 'workspace', 
    oldName: "", 
    newName: "" 
  });

  const [pastStates, setPastStates] = useState<ScanItem[][]>([]);
  const [futureStates, setFutureStates] = useState<ScanItem[][]>([]);

  const [duplicateModal, setDuplicateModal] = useState({ isOpen: false, pendingBarcode: "" });
  const [returnModal, setReturnModal] = useState({ isOpen: false, pendingBarcode: "", existingItemId: "" });
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, itemId: null as string | null, barcodeId: "" });
  const [resetConfirmOpen, setResetConfirmOpen] = useState<boolean>(false);
  const [alertModal, setAlertModal] = useState({ isOpen: false, title: "", message: "" });

  const [lastResetTime, setLastResetTime] = useState<number>(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const latestItemsRef = useRef<ScanItem[]>([]);

  const anyModalOpen = duplicateModal.isOpen || returnModal.isOpen || deleteConfirm.isOpen || resetConfirmOpen || listModal.isOpen || alertModal.isOpen;

  // ================= FUNGSI HISTORY & DB =================
  const recordGlobalHistory = async (actionName: string, newData: ScanItem[]) => {
    try {
      const settings = await getSettings();
      const currentLayouts = settings.layouts || {};
      const newEntry = { 
        id: crypto.randomUUID(), 
        workspace: activeWorkspace, 
        timestamp: Date.now(), 
        action: actionName, 
        dataSnapshot: newData, 
        layoutSnapshot: currentLayouts 
      };
      await saveHistoryLog(newEntry);
    } catch (e) { 
      console.error(e); 
    }
  };

  const loadDataForWorkspace = async (workspaceName: string) => {
    if (isDataLoaded) setIsSwitching(true); 
    try {
      const wsData = await getWorkspaces(); 
      setWorkspaces(wsData);
      
      const settings = await getSettings();
      
      // LOAD COPRO KHUSUS WORKSPACE INI
      let loadedCopros = settings[`copro_list_${workspaceName}`];
      if (!loadedCopros && workspaceName === "Main Log" && settings.copro_list) {
        loadedCopros = settings.copro_list;
      }
      setCoproList(loadedCopros || []);

      // LOAD PENERIMA KHUSUS WORKSPACE INI
      let loadedPenerimas = settings[`penerima_list_${workspaceName}`];
      if (!loadedPenerimas && workspaceName === "Main Log" && settings.penerima_list) {
        loadedPenerimas = settings.penerima_list;
      }
      setPenerimaList(loadedPenerimas || []);

      if (settings.tabs) setTabs(settings.tabs);

      const dbScans = await getAllScans(workspaceName);
      setScannedItems(dbScans); 
      latestItemsRef.current = dbScans;

      const uiCategory = localStorage.getItem("winteq_dash_cat");
      const uiCopro = localStorage.getItem("winteq_dash_copro");
      const uiPenerima = localStorage.getItem("winteq_dash_penerima");
      const savedResetTime = localStorage.getItem(`winteq_dash_last_reset_${workspaceName}`); 

      if (savedResetTime) setLastResetTime(Number(savedResetTime)); 
      else setLastResetTime(0);

      const currentTabs = settings.tabs || ["All Drawing", "Drawing App Internal", "Tanda Terima Drawing"];
      if (uiCategory && currentTabs.includes(uiCategory)) setSelectedCategory(uiCategory); 
      else setSelectedCategory(currentTabs[2] || "Tanda Terima Drawing");
      
      if (uiCopro !== null && (loadedCopros || []).includes(uiCopro)) setSelectedCopro(uiCopro); 
      else setSelectedCopro("");

      if (uiPenerima !== null && (loadedPenerimas || []).includes(uiPenerima)) setSelectedPenerima(uiPenerima); 
      else setSelectedPenerima("");

    } catch (error) { 
      console.error(error); 
    } finally {
      setIsDataLoaded(true); 
      setIsSwitching(false); 
    }
  };

  useEffect(() => {
    const initialWorkspace = localStorage.getItem("winteq_active_workspace") || "Main Log";
    setActiveWorkspace(initialWorkspace);
    loadDataForWorkspace(initialWorkspace);

    const handleWorkspaceChange = async () => {
      const newWorkspace = localStorage.getItem("winteq_active_workspace") || "Main Log";
      setActiveWorkspace(newWorkspace);
      setPastStates([]); 
      setFutureStates([]);
      const wsData = await getWorkspaces(); 
      setWorkspaces(wsData);
      loadDataForWorkspace(newWorkspace);
    };

    window.addEventListener("workspaceChanged", handleWorkspaceChange);
    return () => window.removeEventListener("workspaceChanged", handleWorkspaceChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isDataLoaded) {
      localStorage.setItem("winteq_dash_cat", selectedCategory); 
      localStorage.setItem("winteq_dash_copro", selectedCopro); 
      localStorage.setItem("winteq_dash_penerima", selectedPenerima);
    }
  }, [selectedCategory, selectedCopro, selectedPenerima, isDataLoaded]);

  useEffect(() => { 
    if (!anyModalOpen && !document.body.classList.contains("global-modal-open")) {
      inputRef.current?.focus(); 
    }
  }, [scannedItems, anyModalOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (coproRef.current && !coproRef.current.contains(e.target as Node)) setCoproDropdownOpen(false);
      if (penerimaRef.current && !penerimaRef.current.contains(e.target as Node)) setPenerimaDropdownOpen(false);
      if (workspaceRef.current && !workspaceRef.current.contains(e.target as Node)) setWorkspaceDropdownOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside); 
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const saveHistory = () => { 
    setPastStates((prev) => [...prev.slice(-19), scannedItems]); 
    setFutureStates([]); 
  };

  const handleUndo = () => { 
    if (pastStates.length === 0) return; 
    const previousState = pastStates[pastStates.length - 1]; 
    setPastStates((prev) => prev.slice(0, -1)); 
    setFutureStates((prev) => [...prev, scannedItems]); 
    latestItemsRef.current = previousState; 
    setScannedItems(previousState); 
    recordGlobalHistory("Undo Aksi (Dashboard UI)", previousState); 
  };

  const handleRedo = () => { 
    if (futureStates.length === 0) return; 
    const nextState = futureStates[futureStates.length - 1]; 
    setFutureStates((prev) => prev.slice(0, -1)); 
    setPastStates((prev) => [...prev, scannedItems]); 
    latestItemsRef.current = nextState; 
    setScannedItems(nextState); 
    recordGlobalHistory("Redo Aksi (Dashboard UI)", nextState); 
  };

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (anyModalOpen || document.body.classList.contains("global-modal-open")) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); handleUndo(); } 
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); handleRedo(); }
    };
    window.addEventListener('keydown', handleGlobalKeyDown); 
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [pastStates, futureStates, scannedItems, anyModalOpen]);

  // ================= FUNGSI SUBMIT SCAN =================
  const submitBarcodeData = async () => {
    if (barcodeData.trim() === "" || anyModalOpen || document.body.classList.contains("global-modal-open")) return;
    
    const currentBarcode = barcodeData.trim();
    const existingItemIndex = latestItemsRef.current.findIndex(item => item.barcode_id === currentBarcode && item.kategori === selectedCategory);
    
    if (existingItemIndex > -1) {
      const existingItem = latestItemsRef.current[existingItemIndex];
      if (selectedCategory !== tabs[1]) {
        if (!existingItem.waktu_dikembalikan) { 
          setReturnModal({ isOpen: true, pendingBarcode: currentBarcode, existingItemId: existingItem.id }); 
          setBarcodeData(""); 
          return; 
        } else { 
          setDuplicateModal({ isOpen: true, pendingBarcode: currentBarcode }); 
          setBarcodeData(""); 
          return; 
        }
      } else { 
        setDuplicateModal({ isOpen: true, pendingBarcode: currentBarcode }); 
        setBarcodeData(""); 
        return; 
      }
    }
    
    saveHistory(); 
    const finalCopro = selectedCopro === "" ? currentBarcode.substring(0, 6) : selectedCopro;
    if (finalCopro && !coproList.includes(finalCopro)) { 
      const newList = [...coproList, finalCopro]; 
      setCoproList(newList); 
      await saveSetting(`copro_list_${activeWorkspace}`, newList); 
    }

    const newItem: ScanItem = { 
      id: crypto.randomUUID(), 
      workspace: activeWorkspace, 
      barcode_id: currentBarcode, 
      copro: finalCopro, 
      nama_penerima: selectedCategory === tabs[1] ? "" : selectedPenerima, 
      kategori: selectedCategory, 
      waktu_diterima: new Date().toLocaleString("id-ID"), 
      waktu_dikembalikan: null, 
      timestamp_diterima: Date.now() 
    };
    
    const newData = [newItem, ...latestItemsRef.current]; 
    latestItemsRef.current = newData; 
    setScannedItems(newData); 
    setBarcodeData(""); 
    inputRef.current?.focus(); 
    
    await upsertScanData(newItem); 
    await recordGlobalHistory(`Scan Masuk: ${currentBarcode}`, newData);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === "Enter") e.preventDefault(); };
  const handleKeyUp = (e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === "Enter") submitBarcodeData(); };
  
  // ================= FUNGSI LIST ACTION & MODAL =================
  const confirmDeleteRowAction = async () => { 
    if (deleteConfirm.itemId) { 
      saveHistory(); 
      const newData = latestItemsRef.current.filter((item) => item.id !== deleteConfirm.itemId); 
      latestItemsRef.current = newData; 
      setScannedItems(newData); 
      await deleteScanData(deleteConfirm.itemId); 
      await recordGlobalHistory(`Hapus Barcode: ${deleteConfirm.barcodeId}`, newData); 
    } 
    setDeleteConfirm({ isOpen: false, itemId: null, barcodeId: "" }); 
  };

  const confirmResetDataAction = async () => { 
    const now = Date.now(); 
    localStorage.setItem(`winteq_dash_last_reset_${activeWorkspace}`, now.toString()); 
    setLastResetTime(now); 
    setResetConfirmOpen(false); 
    setAlertModal({ isOpen: true, title: "Tampilan Direset", message: "Tampilan tabel di Dashboard berhasil dibersihkan. Semua data tetap tersimpan aman di database dan halaman Scan Log." }); 
    await recordGlobalHistory("Membersihkan Tampilan Dashboard", latestItemsRef.current); 
  };
  
  const handleListAction = async () => {
    // LOGIKA WORKSPACE
    if (listModal.type === 'workspace') {
      if (listModal.mode === 'delete') {
        if (listModal.oldName === "Main Log") return;
        await deleteWorkspace(listModal.oldName);
        if (activeWorkspace === listModal.oldName) { 
          localStorage.setItem("winteq_active_workspace", "Main Log"); 
          window.dispatchEvent(new Event("workspaceChanged")); 
        } else { 
          const wsData = await getWorkspaces(); 
          setWorkspaces(wsData); 
        }
      } else {
        const val = listModal.newName.trim(); 
        if (!val) return;
        
        if (listModal.mode === 'add') { 
          if (!workspaces.includes(val)) { 
            await addWorkspace(val); 
            localStorage.setItem("winteq_active_workspace", val); 
            window.dispatchEvent(new Event("workspaceChanged")); 
          } 
        } else if (listModal.mode === 'edit') { 
          if (listModal.oldName === "Main Log") return; 
          if (val !== listModal.oldName && !workspaces.includes(val)) { 
            await renameWorkspace(listModal.oldName, val); 
            if (activeWorkspace === listModal.oldName) {
              localStorage.setItem("winteq_active_workspace", val); 
            }
            window.dispatchEvent(new Event("workspaceChanged")); 
          } 
        }
      }
      setListModal({ ...listModal, isOpen: false }); 
      setTimeout(() => inputRef.current?.focus(), 100); 
      return;
    }

    // LOGIKA COPRO & PENERIMA
    let newCoproList = [...coproList]; 
    let newPenerimaList = [...penerimaList]; 
    let isCoproChanged = false; 
    let isPenerimaChanged = false;

    if (listModal.mode === 'delete') {
      if (listModal.type === 'copro') { 
        newCoproList = coproList.filter(c => c !== listModal.oldName); 
        setCoproList(newCoproList); 
        isCoproChanged = true; 
        if (selectedCopro === listModal.oldName) setSelectedCopro(newCoproList[0] || ""); 
      } else { 
        newPenerimaList = penerimaList.filter(p => p !== listModal.oldName); 
        setPenerimaList(newPenerimaList); 
        isPenerimaChanged = true; 
        if (selectedPenerima === listModal.oldName) setSelectedPenerima(""); 
      }
    } else {
      const val = listModal.newName.trim(); 
      if (!val) return;
      
      if (listModal.mode === 'add') {
        if (listModal.type === 'copro' && !coproList.includes(val)) { 
          newCoproList = [...coproList, val]; 
          setCoproList(newCoproList); 
          setSelectedCopro(val); 
          isCoproChanged = true; 
        } else if (listModal.type === 'penerima' && !penerimaList.includes(val)) { 
          newPenerimaList = [...penerimaList, val]; 
          setPenerimaList(newPenerimaList); 
          setSelectedPenerima(val); 
          isPenerimaChanged = true; 
        }
      } else if (listModal.mode === 'edit') {
        if (listModal.type === 'copro' && coproList.includes(val) && val !== listModal.oldName) return; 
        if (listModal.type === 'penerima' && penerimaList.includes(val) && val !== listModal.oldName) return; 
        
        saveHistory(); 
        if (listModal.type === 'copro') { 
          newCoproList = coproList.map(c => c === listModal.oldName ? val : c); 
          setCoproList(newCoproList); 
          setSelectedCopro(val); 
          isCoproChanged = true; 
          const newData = latestItemsRef.current.map(i => i.copro === listModal.oldName ? { ...i, copro: val } : i); 
          latestItemsRef.current = newData; 
          setScannedItems(newData); 
          newData.forEach(async item => { if(item.copro === val) await upsertScanData(item); }); 
          await recordGlobalHistory(`Ubah Copro: ${listModal.oldName} -> ${val}`, newData); 
        } else { 
          newPenerimaList = penerimaList.map(p => p === listModal.oldName ? val : p); 
          setPenerimaList(newPenerimaList); 
          setSelectedPenerima(val); 
          isPenerimaChanged = true; 
          const newData = latestItemsRef.current.map(i => i.nama_penerima === listModal.oldName ? { ...i, nama_penerima: val } : i); 
          latestItemsRef.current = newData; 
          setScannedItems(newData); 
          newData.forEach(async item => { if(item.nama_penerima === val) await upsertScanData(item); }); 
          await recordGlobalHistory(`Ubah Penerima: ${listModal.oldName} -> ${val}`, newData); 
        }
      }
    }
    
    if (isCoproChanged) await saveSetting(`copro_list_${activeWorkspace}`, newCoproList); 
    if (isPenerimaChanged) await saveSetting(`penerima_list_${activeWorkspace}`, newPenerimaList); 
    
    setListModal({ ...listModal, isOpen: false }); 
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleReturnCancel = () => { 
    setReturnModal({ isOpen: false, pendingBarcode: "", existingItemId: "" }); 
    setTimeout(() => inputRef.current?.focus(), 100); 
  };

  const handleReturnConfirm = async () => { 
    saveHistory(); 
    const updatedData = [...latestItemsRef.current]; 
    const idx = updatedData.findIndex(i => i.id === returnModal.existingItemId); 
    if (idx > -1) { 
      updatedData[idx] = { ...updatedData[idx], waktu_dikembalikan: new Date().toLocaleString("id-ID") }; 
      const itemToMove = updatedData.splice(idx, 1)[0]; 
      updatedData.unshift(itemToMove); 
      latestItemsRef.current = updatedData; 
      setScannedItems(updatedData); 
      await upsertScanData(itemToMove); 
      await recordGlobalHistory(`Pengembalian Drawing: ${returnModal.pendingBarcode}`, updatedData); 
      setAlertModal({ isOpen: true, title: "Drawing Dikembalikan!", message: `Drawing ${updatedData[0].barcode_id} berhasil dicatat sebagai SUDAH DIKEMBALIKAN.` }); 
    } 
    handleReturnCancel(); 
  };

  const handleDuplicateCancel = () => { 
    setDuplicateModal({ isOpen: false, pendingBarcode: "" }); 
    setTimeout(() => inputRef.current?.focus(), 100); 
  };

  const handleDuplicateReplace = async () => { 
    saveHistory(); 
    const pendingTrimmed = duplicateModal.pendingBarcode.trim(); 
    const finalCopro = selectedCopro === "" ? pendingTrimmed.substring(0, 6) : selectedCopro; 
    
    if (finalCopro && !coproList.includes(finalCopro)) { 
      const newList = [...coproList, finalCopro]; 
      setCoproList(newList); 
      await saveSetting(`copro_list_${activeWorkspace}`, newList); 
    } 

    const newItem: ScanItem = { 
      id: crypto.randomUUID(), 
      workspace: activeWorkspace, 
      barcode_id: pendingTrimmed, 
      copro: finalCopro, 
      nama_penerima: selectedCategory === tabs[1] ? "" : selectedPenerima, 
      kategori: selectedCategory, 
      waktu_diterima: new Date().toLocaleString("id-ID"), 
      waktu_dikembalikan: null, 
      timestamp_diterima: Date.now() 
    }; 
    
    const oldItem = latestItemsRef.current.find(item => item.barcode_id === pendingTrimmed && item.kategori === selectedCategory); 
    if (oldItem) await deleteScanData(oldItem.id); 

    const filtered = latestItemsRef.current.filter(item => item.barcode_id !== pendingTrimmed || item.kategori !== selectedCategory); 
    const newData = [newItem, ...filtered]; 
    latestItemsRef.current = newData; 
    setScannedItems(newData); 
    
    await upsertScanData(newItem); 
    await recordGlobalHistory(`Menimpa Barcode Duplikat: ${pendingTrimmed}`, newData); 
    handleDuplicateCancel(); 
  };

  const handleDuplicateAddAnyway = async () => { 
    saveHistory(); 
    const pendingTrimmed = duplicateModal.pendingBarcode.trim(); 
    const finalCopro = selectedCopro === "" ? pendingTrimmed.substring(0, 6) : selectedCopro; 
    
    if (finalCopro && !coproList.includes(finalCopro)) { 
      const newList = [...coproList, finalCopro]; 
      setCoproList(newList); 
      await saveSetting(`copro_list_${activeWorkspace}`, newList); 
    } 

    const newItem: ScanItem = { 
      id: crypto.randomUUID(), 
      workspace: activeWorkspace, 
      barcode_id: pendingTrimmed, 
      copro: finalCopro, 
      nama_penerima: selectedCategory === tabs[1] ? "" : selectedPenerima, 
      kategori: selectedCategory, 
      waktu_diterima: new Date().toLocaleString("id-ID"), 
      waktu_dikembalikan: null, 
      timestamp_diterima: Date.now() 
    }; 
    const newData = [newItem, ...latestItemsRef.current]; 
    latestItemsRef.current = newData; 
    setScannedItems(newData); 
    
    await upsertScanData(newItem); 
    await recordGlobalHistory(`Menambahkan Barcode Duplikat: ${pendingTrimmed}`, newData); 
    handleDuplicateCancel(); 
  };

  const displayedItems = scannedItems.filter(item => item.kategori === selectedCategory && item.timestamp_diterima > lastResetTime).slice(0, 10);
  
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
    const workbook = XLSX.utils.book_new(); 
    XLSX.utils.book_append_sheet(workbook, ws, "10_Log_Terbaru"); 
    XLSX.writeFile(workbook, `Laporan_${activeWorkspace}_${selectedCategory.replace(/\s+/g, '_')}.xlsx`); 
  };

  // =========================================================================
  // SKELETON LOADER TINGGI PRESISI BIKIN HALAMAN GAK RUNTUH
  // =========================================================================
  if (!isDataLoaded) return (
    <div className="flex flex-col h-full w-full bg-slate-50 animate-in fade-in duration-300">
      <div className="bg-white px-6 py-4 shadow-sm border-b border-gray-200 flex justify-between items-center z-10 shrink-0 h-[68px]">
        <div className="h-7 w-64 bg-slate-200 rounded animate-pulse"></div>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4 shadow-sm"></div>
        <p className="font-bold text-blue-500 animate-pulse tracking-wide">Memuat Workspace...</p>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full w-full animate-in fade-in duration-300 relative">
      <style>{`.thin-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; } .thin-scrollbar::-webkit-scrollbar-track { background: transparent; } .thin-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 10px; } .thin-scrollbar::-webkit-scrollbar-thumb:hover { background-color: #94a3b8; }`}</style>
      
      <div className="bg-white px-6 py-4 shadow-sm border-b border-gray-200 flex justify-between items-center z-10 shrink-0 h-[68px]">
        <h2 className="text-xl font-bold text-gray-800">
          Dashboard Scan: <span className="text-blue-600">{activeWorkspace}</span>
        </h2>
      </div>

      {/* OVERLAY SKELETON LOADING CANTIK SAAT GANTI TAB */}
      {isSwitching && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-50/80 backdrop-blur-sm transition-all duration-300 m-4 sm:m-6 rounded-xl">
           <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-3 shadow-md"></div>
           <p className="text-sm font-extrabold text-blue-700 animate-pulse tracking-wide">Memuat Data {activeWorkspace}...</p>
        </div>
      )}

      {/* ===================== SEMUA MODAL AREA ===================== */}
      <Modal isOpen={deleteConfirm.isOpen} title="Hapus Barcode?" type="danger" icon="trash" onClose={() => setDeleteConfirm({ isOpen: false, itemId: null, barcodeId: "" })} onConfirm={confirmDeleteRowAction} description={<>Yakin menghapus barcode <span className="font-semibold text-red-700">"{deleteConfirm.barcodeId}"</span>?</>}>
        <button onClick={() => setDeleteConfirm({ isOpen: false, itemId: null, barcodeId: "" })} className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg">Batal (Esc)</button>
        <button onClick={confirmDeleteRowAction} className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg flex items-center"><TrashIcon className="w-4 h-4 mr-1.5" /> Hapus (Enter)</button>
      </Modal>

      <Modal isOpen={resetConfirmOpen} title="Peringatan: Reset Tampilan" type="warning" icon="warning" onClose={() => setResetConfirmOpen(false)} onConfirm={confirmResetDataAction} description={<>Yakin ingin membersihkan tampilan <span className="font-semibold text-gray-800">{displayedItems.length}</span> log terbaru ini? (Data asli tetap aman di database dan halaman Scan Log).</>}>
        <button onClick={() => setResetConfirmOpen(false)} className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg">Batal (Esc)</button>
        <button onClick={confirmResetDataAction} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg flex items-center"><ArrowPathIcon className="w-4 h-4 mr-1.5" /> Bersihkan Tampilan</button>
      </Modal>

      <Modal isOpen={alertModal.isOpen} title={alertModal.title} type="warning" icon="warning" onClose={() => setAlertModal({ ...alertModal, isOpen: false })} onConfirm={() => setAlertModal({ ...alertModal, isOpen: false })} description={alertModal.message}>
        <button onClick={() => setAlertModal({ ...alertModal, isOpen: false })} className="px-5 py-2 bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-medium rounded-lg">Mengerti (Enter/Esc)</button>
      </Modal>

      <Modal isOpen={returnModal.isOpen} title="Konfirmasi Pengembalian" type="warning" icon="warning" onClose={handleReturnCancel} onConfirm={handleReturnConfirm} description={<>Drawing <span className="font-semibold text-blue-600">"{returnModal.pendingBarcode}"</span> sudah tercatat DITERIMA. Apakah Anda ingin mengembalikan drawing ini?</>}>
        <button onClick={handleReturnCancel} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg">Batal (Esc)</button>
        <button onClick={handleReturnConfirm} className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-lg flex items-center gap-1.5"><CheckCircleIcon className="w-4 h-4"/> Drawing Dikembalikan</button>
      </Modal>

      <Modal isOpen={duplicateModal.isOpen} title="Barcode Sudah Ada!" type="warning" icon="warning" onClose={handleDuplicateCancel} onConfirm={handleDuplicateCancel} description={<>Drawing <span className="font-semibold text-blue-600">"{duplicateModal.pendingBarcode}"</span> sudah tercatat di sistem untuk kategori ini. Apa yang ingin kamu lakukan?</>}>
        <button onClick={handleDuplicateCancel} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg">Batal (Esc)</button>
        <button onClick={handleDuplicateReplace} className="px-4 py-2 bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 text-sm font-medium rounded-lg flex items-center gap-1.5"><ExclamationTriangleIcon className="w-4 h-4"/> Timpa Data Lama</button>
        <button onClick={handleDuplicateAddAnyway} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg flex items-center gap-1.5"><PlusIcon className="w-4 h-4"/> Tetap Tambahkan (Dobel)</button>
      </Modal>

      <Modal isOpen={listModal.isOpen} title={listModal.mode === 'delete' ? `Hapus ${listModal.type === 'workspace' ? 'Log' : listModal.type.toUpperCase()}?` : `${listModal.mode === 'edit' ? 'Edit' : 'Tambah'} ${listModal.type === 'workspace' ? 'Log' : listModal.type.toUpperCase()}`} type={listModal.mode === 'delete' ? 'danger' : 'warning'} icon={listModal.mode === 'delete' ? 'trash' : 'warning'} onClose={() => setListModal({ ...listModal, isOpen: false })} onConfirm={handleListAction} description={listModal.mode === 'delete' ? (<>Yakin menghapus <span className="font-semibold text-red-700">"{listModal.oldName}"</span>?{listModal.type === 'workspace' && <><br/><br/><span className="text-xs font-medium text-red-600">Semua data dan riwayat di log ini akan terhapus permanen!</span></>}</>) : (<div className="pt-2"><input type="text" value={listModal.newName} onChange={(e) => setListModal({...listModal, newName: e.target.value})} onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }} onKeyUp={(e) => { if (e.key === 'Enter') handleListAction(); }} className="w-full p-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 transition-all text-gray-800" placeholder={`Masukkan Nama ${listModal.type === 'workspace' ? 'Log' : listModal.type}...`} autoFocus /></div>)}>
        <button onClick={() => setListModal({ ...listModal, isOpen: false })} className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg">Batal</button>
        <button onClick={handleListAction} className={`px-5 py-2 text-white text-sm font-medium rounded-lg flex items-center ${listModal.mode === 'delete' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}>{listModal.mode === 'delete' ? <TrashIcon className="w-4 h-4 mr-1.5" /> : (listModal.mode === 'edit' ? <PencilIcon className="w-4 h-4 mr-1.5" /> : <PlusIcon className="w-4 h-4 mr-1.5" />)}{listModal.mode === 'delete' ? 'Hapus' : (listModal.mode === 'edit' ? 'Simpan Perubahan' : 'Tambah')}</button>
      </Modal>

      {/* OVERFLOW-Y-AUTO DIHILANGKAN DARI SINI BIAR DROPDOWN BEBAS TEMBUS */}
      <div className="flex flex-col xl:flex-row gap-8 flex-1 p-4 sm:p-6 min-h-0 relative z-10">
        
        <div className="w-full xl:w-1/3 flex flex-col gap-6 shrink-0 z-20 relative">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <label className="block text-sm font-bold text-gray-700 mb-3 uppercase tracking-wider">Input Scanner</label>
            <p className="text-xs text-gray-500 mb-4">Arahkan alat ke barcode. Sistem otomatis mendeteksi Penerimaan/Pengembalian.</p>
            <div className="flex gap-2">
              <input 
                type="text" ref={inputRef} value={barcodeData} onChange={(e) => setBarcodeData(e.target.value)} onKeyDown={handleKeyDown} onKeyUp={handleKeyUp} 
                disabled={anyModalOpen || (typeof document !== 'undefined' && document.body.classList.contains("global-modal-open"))} 
                className="w-full p-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-base disabled:opacity-50 text-gray-800" 
                placeholder="Scan Nomer Drawing..." autoFocus 
                onBlur={() => { setTimeout(() => { if (!anyModalOpen && !document.body.classList.contains("global-modal-open")) inputRef.current?.focus(); }, 50); }} 
              />
              <button onClick={submitBarcodeData} disabled={anyModalOpen || barcodeData.trim() === ""} className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 rounded-lg transition-colors shadow-sm shrink-0">Add</button>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-5 transition-all">
            <div className="flex items-center space-x-2 border-b border-gray-100 pb-3">
              <Cog6ToothIcon className="w-5 h-5 text-gray-500" />
              <label className="block text-sm font-bold text-gray-700 uppercase tracking-wider">Pengaturan Scan</label>
            </div>
            
            {/* 1. DROPDOWN KATEGORI LOG (WORKSPACE) */}
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-2 uppercase">1. Kategori Log</p>
              <div className="flex space-x-2 relative">
                <div className="relative flex-1" ref={workspaceRef}>
                  <div className="w-full p-3 border-2 border-blue-200 rounded-lg bg-blue-50/50 text-blue-800 font-bold text-sm cursor-pointer flex justify-between items-center shadow-inner" onClick={() => setWorkspaceDropdownOpen(!workspaceDropdownOpen)}>
                    <span className="truncate pr-2">{activeWorkspace}</span>
                    <ChevronDownIcon className="w-4 h-4 text-blue-500 shrink-0" />
                  </div>
                  {workspaceDropdownOpen && (
                    <div className="absolute z-[100] top-full left-0 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto thin-scrollbar">
                      {workspaces.map(ws => (
                        <div key={ws} className="flex justify-between items-center px-4 py-2.5 hover:bg-slate-50 cursor-pointer group" onClick={() => {
                          localStorage.setItem("winteq_active_workspace", ws);
                          window.dispatchEvent(new Event("workspaceChanged"));
                          setWorkspaceDropdownOpen(false);
                        }}>
                          <span className={`text-sm ${activeWorkspace === ws ? 'font-bold text-blue-600' : 'text-gray-700 font-medium'}`}>{ws}</span>
                          {ws !== "Main Log" && (
                            <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={(e) => { e.stopPropagation(); setListModal({ isOpen: true, mode: 'edit', type: 'workspace', oldName: ws, newName: ws }); setWorkspaceDropdownOpen(false); }} className="text-blue-500 hover:bg-blue-100 p-1.5 rounded transition-colors" title="Edit"><PencilIcon className="w-4 h-4" /></button>
                              <button onClick={(e) => { e.stopPropagation(); setListModal({ isOpen: true, mode: 'delete', type: 'workspace', oldName: ws, newName: "" }); setWorkspaceDropdownOpen(false); }} className="text-red-500 hover:bg-red-100 p-1.5 rounded transition-colors" title="Hapus"><TrashIcon className="w-4 h-4" /></button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <button onClick={() => setListModal({ isOpen: true, mode: 'add', type: 'workspace', oldName: "", newName: "" })} className="bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200 p-3 rounded-lg flex items-center justify-center shrink-0" title="Tambah Log Baru"><PlusIcon className="w-5 h-5" /></button>
              </div>
            </div>

            <div className="mt-2">
              <p className="text-xs font-semibold text-gray-500 mb-2 uppercase">2. Kategori Drawing</p>
              <div className="flex flex-col 2xl:flex-row bg-gray-100 p-1.5 rounded-lg gap-1.5 overflow-x-auto thin-scrollbar">
                <button onClick={() => setSelectedCategory(tabs[1])} className={`flex-1 py-2 px-3 text-[10px] 2xl:text-xs font-bold rounded-md transition-all uppercase whitespace-nowrap shrink-0 ${selectedCategory === tabs[1] ? 'bg-blue-600 text-white shadow-md' : 'bg-transparent text-gray-500 hover:bg-blue-50 hover:text-blue-600'}`}>{tabs[1]}</button>
                <button onClick={() => setSelectedCategory(tabs[2])} className={`flex-1 py-2 px-3 text-[10px] 2xl:text-xs font-bold rounded-md transition-all uppercase whitespace-nowrap shrink-0 ${selectedCategory === tabs[2] ? 'bg-blue-600 text-white shadow-md' : 'bg-transparent text-gray-500 hover:bg-blue-50 hover:text-blue-600'}`}>{tabs[2]}</button>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-500 mb-2 uppercase">3. COPRO</p>
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
            
            {/* 4. PENERIMA */}
            {selectedCategory !== tabs[1] && (
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2 uppercase">4. Nama Penerima</p>
                <div className="flex space-x-2 relative">
                  <div className="relative flex-1" ref={penerimaRef}>
                    <div className="w-full p-3 border-2 border-gray-300 rounded-lg bg-white text-gray-700 text-sm flex justify-between items-center cursor-pointer" onClick={() => setPenerimaDropdownOpen(!penerimaDropdownOpen)}>
                      <span>{selectedPenerima || "-- Biarkan Kosong --"}</span>
                      <ChevronDownIcon className="w-4 h-4 text-gray-500" />
                    </div>
                    {penerimaDropdownOpen && (
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
                  <button onClick={() => setListModal({ isOpen: true, mode: 'add', type: 'penerima', oldName: "", newName: "" })} className="bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 p-3 rounded-lg flex items-center justify-center shrink-0" title="Tambah Penerima Baru"><PlusIcon className="w-5 h-5" /></button>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* KOTAK TABEL */}
        <div className="w-full xl:w-2/3 flex flex-col bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden z-10 relative">
          <div className="p-3 sm:p-4 border-b border-gray-100 flex flex-col 2xl:flex-row justify-between items-start 2xl:items-center bg-gray-50/50 gap-3 2xl:gap-0 shrink-0">
            <h3 className="font-bold text-gray-800 uppercase text-sm truncate w-full 2xl:w-auto pr-2">
              10 Log Terbaru: <span className="text-blue-700 font-extrabold">{selectedCategory}</span>
            </h3>
            <div className="flex items-center gap-2 flex-nowrap shrink-0 overflow-x-auto w-full 2xl:w-auto thin-scrollbar pb-1 2xl:pb-0">
              <div className="flex bg-gray-100 rounded-md p-1 border border-gray-200 shrink-0">
                <button onClick={handleUndo} disabled={pastStates.length === 0} className={`p-1.5 rounded flex items-center transition-all ${pastStates.length > 0 ? "bg-white text-gray-700 shadow-sm hover:text-blue-600" : "text-gray-400 cursor-not-allowed opacity-60"}`}><ArrowUturnLeftIcon className="w-4 h-4" /></button>
                <button onClick={handleRedo} disabled={futureStates.length === 0} className={`p-1.5 rounded flex items-center transition-all ml-1 ${futureStates.length > 0 ? "bg-white text-gray-700 shadow-sm hover:text-blue-600" : "text-gray-400 cursor-not-allowed opacity-60"}`}><ArrowUturnRightIcon className="w-4 h-4" /></button>
              </div>
              <button onClick={exportToExcelWithAlert} className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold py-1.5 px-3 rounded-md shadow-sm flex items-center shrink-0 whitespace-nowrap">
                <DocumentArrowDownIcon className="w-4 h-4 mr-1.5" /> Unduh Excel
              </button>
              {displayedItems.length > 0 && (
                <button onClick={() => setResetConfirmOpen(true)} className="bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold py-1.5 px-3 rounded-md border border-red-200 shrink-0 whitespace-nowrap">
                  Bersihkan Tampilan
                </button>
              )}
            </div>
          </div>
          
          <div className="flex-1 overflow-auto bg-white">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead className="sticky top-0 bg-gray-50 shadow-sm z-10 border-b border-gray-200">
                <tr className="text-xs uppercase tracking-wider text-gray-600">
                  <th className="p-4 font-bold text-center w-12">No</th>
                  <th className="p-4 font-bold">Nomer Drawing</th>
                  <th className="p-4 font-bold text-center">Status</th>
                  <th className="p-4 font-bold text-center w-24">
                    <div className="flex justify-center">
                      <TrashIcon className="w-5 h-5 text-gray-500" title="Aksi" />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {displayedItems.length === 0 ? (
                  <tr><td colSpan={4} className="p-16 text-center text-gray-400">Belum ada data pindaian di kategori ini sejak dibersihkan.</td></tr>
                ) : (
                  displayedItems.map((item, index) => {
                    const isReturned = item.waktu_dikembalikan !== null;
                    return (
                      <tr key={item.id} className="border-b border-gray-100 hover:bg-blue-50/30 transition-colors">
                        <td className="p-4 text-gray-600 text-center">{index + 1}</td>
                        <td className="p-4">
                          <div className="font-bold text-gray-900">{item.barcode_id}</div>
                          <div className="text-xs text-gray-500 mt-1">Copro: {item.copro || "-"} | <span className="uppercase">{item.kategori}</span></div>
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
    </div>
  );
}