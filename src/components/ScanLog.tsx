"use client";

import { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx-js-style";
import { 
  TrashIcon, ArrowPathIcon, ArrowUturnLeftIcon, ArrowUturnRightIcon, 
  ChevronDownIcon, Squares2X2Icon, DocumentArrowDownIcon, ArrowsUpDownIcon,
  MagnifyingGlassIcon, CheckCircleIcon, PlusCircleIcon, PlusIcon,
  BoltIcon, ExclamationTriangleIcon, PencilIcon
} from "@heroicons/react/24/outline";
import Modal from "./ui/Modal"; 
import { ScanItem } from "./DashboardScan"; 

type ColumnDef = {
  id: string;
  name: string;
  type: 'base' | 'custom';
  width: number;
};

const BASE_INTERNAL: ColumnDef[] = [
  { id: 'no', name: 'NO', type: 'base', width: 60 },
  { id: 'copro', name: 'COPRO', type: 'base', width: 140 },
  { id: 'barcode_id', name: 'NOMER DRAWING', type: 'base', width: 220 },
  { id: 'waktu_diterima', name: 'WAKTU DITERIMA', type: 'base', width: 180 },
];

const BASE_TANDA_TERIMA: ColumnDef[] = [
  { id: 'no', name: 'NO', type: 'base', width: 60 },
  { id: 'copro', name: 'COPRO', type: 'base', width: 140 },
  { id: 'barcode_id', name: 'NOMER DRAWING', type: 'base', width: 220 },
  { id: 'waktu_diterima', name: 'WAKTU DITERIMA', type: 'base', width: 180 },
  { id: 'nama_penerima', name: 'NAMA PENERIMA', type: 'base', width: 180 },
  { id: 'waktu_dikembalikan', name: 'WAKTU DIKEMBALIKAN', type: 'base', width: 250 }, 
  { id: 'status_drawing', name: 'STATUS DRAWING', type: 'base', width: 220 }, 
];

export default function ScanLog() {
  const [scannedItems, setScannedItems] = useState<ScanItem[]>([]);
  const [coproList, setCoproList] = useState<string[]>([]);
  const [penerimaList, setPenerimaList] = useState<string[]>([]);
  const [isMounted, setIsMounted] = useState<boolean>(false);
  
  const [sheets, setSheets] = useState<string[]>(["All Drawing", "Drawing App Internal", "Tanda Terima Drawing"]);
  const [activeSheet, setActiveSheet] = useState<string>("All Drawing");
  const [editingSheet, setEditingSheet] = useState<string | null>(null);
  const [editSheetName, setEditSheetName] = useState("");
  
  const [sheetLayouts, setSheetLayouts] = useState<Record<string, ColumnDef[]>>({});

  const [viewGrid, setViewGrid] = useState<boolean>(false);
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  
  const [scanMode, setScanMode] = useState<'direct' | 'dashboard'>('dashboard');
  const [directBarcode, setDirectBarcode] = useState("");
  
  const [scanCategory, setScanCategory] = useState<string>("");
  const [scanCopro, setScanCopro] = useState<string>("");
  const [scanPenerima, setScanPenerima] = useState<string>("");
  const directInputRef = useRef<HTMLInputElement>(null);

  const [coproDropdownOpen, setCoproDropdownOpen] = useState(false);
  const [penerimaDropdownOpen, setPenerimaDropdownOpen] = useState(false);
  const coproRef = useRef<HTMLDivElement>(null);
  const penerimaRef = useRef<HTMLDivElement>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterTime, setFilterTime] = useState("Semua"); 
  const [filterCopro, setFilterCopro] = useState("Semua");
  const [filterCategory, setFilterCategory] = useState("Semua"); 
  const [filterPenerima, setFilterPenerima] = useState("Semua");
  const [filterStatus, setFilterStatus] = useState("Semua"); 

  const [timeFilterMode, setTimeFilterMode] = useState("Semua"); 
  const [specificDate, setSpecificDate] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const timeFilterRef = useRef<HTMLDivElement>(null);

  const [exportMenuOpen, setExportMenuOpen] = useState<boolean>(false);
  const [selectedExportSheets, setSelectedExportSheets] = useState<string[]>([]);
  const [exportFormat, setExportFormat] = useState<'single' | 'multiple'>('single');

  const [resizingCol, setResizingCol] = useState<{ id: string, startX: number, startWidth: number } | null>(null);
  const [draggedColId, setDraggedColId] = useState<string | null>(null);
  const [deleteColConfirm, setDeleteColConfirm] = useState({ isOpen: false, colId: "", colName: "" });

  const [selection, setSelection] = useState<{startR: number, startC: number, endR: number, endC: number} | null>(null);
  const [isDraggingGrid, setIsDraggingGrid] = useState<boolean>(false);

  const [pastStates, setPastStates] = useState<{items: ScanItem[], layouts: Record<string, ColumnDef[]>}[]>([]);
  const [futureStates, setFutureStates] = useState<{items: ScanItem[], layouts: Record<string, ColumnDef[]>}[]>([]);

  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, itemId: null as string | null, barcodeId: "" });
  const [resetConfirmOpen, setResetConfirmOpen] = useState<boolean>(false);
  const [alertModal, setAlertModal] = useState({ isOpen: false, title: "", message: "" });
  
  const [listModal, setListModal] = useState({ isOpen: false, mode: 'add' as 'add' | 'edit' | 'delete', type: 'copro' as 'copro' | 'penerima', oldName: "", newName: "" });
  const [pendingPenerimaItemId, setPendingPenerimaItemId] = useState<string | null>(null);

  const [duplicateModal, setDuplicateModal] = useState({ isOpen: false, pendingBarcode: "", targetCategory: "" });
  const [returnModal, setReturnModal] = useState({ isOpen: false, pendingBarcode: "", existingItemId: "", targetCategory: "" });

  const anyModalOpen = deleteConfirm.isOpen || resetConfirmOpen || alertModal.isOpen || deleteColConfirm.isOpen || editingSheet !== null || duplicateModal.isOpen || returnModal.isOpen || listModal.isOpen;
  
  const tableRef = useRef<HTMLTableElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null); 

  // --- FUNGSI MATA-MATA HISTORY (BARU) ---
  const recordGlobalHistory = (actionName: string, newData: ScanItem[]) => {
    try {
      const currentHistoryStr = localStorage.getItem("winteq_activity_log");
      let historyLog = currentHistoryStr ? JSON.parse(currentHistoryStr) : [];
      const newEntry = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        action: actionName,
        dataSnapshot: newData
      };
      historyLog = [newEntry, ...historyLog].slice(0, 50); // Simpan max 50 log terbaru
      localStorage.setItem("winteq_activity_log", JSON.stringify(historyLog));
    } catch (e) {
      console.error("Gagal simpan history", e);
    }
  };

  const statesRef = useRef({ scannedItems, activeSheet, sheets, scanCategory, scanCopro, coproList, scanPenerima });
  useEffect(() => {
    statesRef.current = { scannedItems, activeSheet, sheets, scanCategory, scanCopro, coproList, scanPenerima };
  }, [scannedItems, activeSheet, sheets, scanCategory, scanCopro, coproList, scanPenerima]);

  useEffect(() => {
    setIsMounted(true);
    const savedData = localStorage.getItem("winteq_drawing_data");
    const savedCopro = localStorage.getItem("winteq_drawing_coprolist");
    const savedPenerima = localStorage.getItem("winteq_drawing_penerimalist");
    const savedLayouts = localStorage.getItem("winteq_drawing_layouts");
    const savedTabs = localStorage.getItem("winteq_drawing_tabs");
    
    const uiSheet = localStorage.getItem("winteq_log_activeSheet");
    const uiSort = localStorage.getItem("winteq_log_sortOrder");
    const uiGrid = localStorage.getItem("winteq_log_viewGrid");
    const uiScanMode = localStorage.getItem("winteq_log_scanMode");
    
    const uiDashCat = localStorage.getItem("winteq_dash_cat");
    const uiDashCopro = localStorage.getItem("winteq_dash_copro");
    const uiDashPenerima = localStorage.getItem("winteq_dash_penerima");

    if (savedData) setScannedItems(JSON.parse(savedData));
    if (savedCopro) setCoproList(JSON.parse(savedCopro));
    if (savedPenerima) setPenerimaList(JSON.parse(savedPenerima));
    
    if (savedTabs) {
      const parsedTabs = JSON.parse(savedTabs); setSheets(parsedTabs); setSelectedExportSheets(parsedTabs);
      if (uiDashCat && parsedTabs.includes(uiDashCat)) setScanCategory(uiDashCat); else setScanCategory(parsedTabs[2] || "Tanda Terima Drawing");
      if (uiSheet && parsedTabs.includes(uiSheet)) setActiveSheet(uiSheet); else setActiveSheet(parsedTabs[0]);
    } else { 
      setSelectedExportSheets(["All Drawing", "Drawing App Internal", "Tanda Terima Drawing"]); 
      setScanCategory("Tanda Terima Drawing");
    }

    if (uiDashCopro !== null) setScanCopro(uiDashCopro);
    if (uiDashPenerima !== null) setScanPenerima(uiDashPenerima);

    if (savedLayouts) {
      const parsed = JSON.parse(savedLayouts);
      const restoreLayout = (savedTab: ColumnDef[], defaultBase: ColumnDef[]) => {
        if (!savedTab || savedTab.length === 0) return defaultBase;
        
        let restored = savedTab.filter(c => c.id !== 'kategori').map(col => {
          if (col.id === 'copro' && col.width <= 100) return { ...col, width: 140 };
          if (col.id === 'waktu_dikembalikan' && col.width <= 220) return { ...col, width: 250 };
          if (col.id === 'status_drawing' && col.width <= 180) return { ...col, width: 220 };
          return col;
        });

        const titleIdx = restored.findIndex(c => c.name.toLowerCase() === 'title');
        const nomerDrawingIdx = restored.findIndex(c => c.id === 'barcode_id');
        if (titleIdx > -1 && nomerDrawingIdx > -1 && titleIdx !== nomerDrawingIdx + 1) {
          const [titleCol] = restored.splice(titleIdx, 1);
          const newNomerDrawingIdx = restored.findIndex(c => c.id === 'barcode_id');
          restored.splice(newNomerDrawingIdx + 1, 0, titleCol);
        }

        defaultBase.forEach((baseCol, index) => {
          if (!restored.some(c => c.id === baseCol.id)) {
            restored.splice(index, 0, baseCol);
          }
        });

        return restored;
      };
      
      setSheetLayouts({ 
        [sheets[1]]: restoreLayout(parsed[sheets[1]] || [], BASE_INTERNAL), 
        [sheets[2]]: restoreLayout(parsed[sheets[2]] || [], BASE_TANDA_TERIMA) 
      });
    } else {
      setSheetLayouts({ [sheets[1]]: BASE_INTERNAL, [sheets[2]]: BASE_TANDA_TERIMA });
    }

    if (uiSort === 'newest' || uiSort === 'oldest') setSortOrder(uiSort);
    if (uiGrid) setViewGrid(uiGrid === 'true');
    if (uiScanMode === 'direct' || uiScanMode === 'dashboard') setScanMode(uiScanMode as any);
  }, []);

  useEffect(() => {
    if (isMounted) {
      localStorage.setItem("winteq_drawing_data", JSON.stringify(scannedItems));
      localStorage.setItem("winteq_drawing_tabs", JSON.stringify(sheets)); 
      localStorage.setItem("winteq_drawing_layouts", JSON.stringify(sheetLayouts));
      localStorage.setItem("winteq_drawing_coprolist", JSON.stringify(coproList)); 
      localStorage.setItem("winteq_drawing_penerimalist", JSON.stringify(penerimaList)); 
      localStorage.setItem("winteq_log_activeSheet", activeSheet);
      localStorage.setItem("winteq_log_sortOrder", sortOrder);
      localStorage.setItem("winteq_log_viewGrid", String(viewGrid));
      localStorage.setItem("winteq_log_scanMode", scanMode);
      
      localStorage.setItem("winteq_dash_cat", scanCategory);
      localStorage.setItem("winteq_dash_copro", scanCopro);
      localStorage.setItem("winteq_dash_penerima", scanPenerima);
    }
  }, [scannedItems, sheets, sheetLayouts, coproList, penerimaList, activeSheet, sortOrder, viewGrid, scanMode, scanCategory, scanCopro, scanPenerima, isMounted]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => { 
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) setExportMenuOpen(false);
      if (tableRef.current && !tableRef.current.contains(e.target as Node)) setSelection(null);
      if (coproRef.current && !coproRef.current.contains(e.target as Node)) setCoproDropdownOpen(false);
      if (penerimaRef.current && !penerimaRef.current.contains(e.target as Node)) setPenerimaDropdownOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside); return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getCurrentLayout = () => {
    if (activeSheet !== sheets[0]) return sheetLayouts[activeSheet] || (activeSheet === sheets[1] ? BASE_INTERNAL : BASE_TANDA_TERIMA);
    
    const tandaLayout = sheetLayouts[sheets[2]] || BASE_TANDA_TERIMA;
    const intLayout = sheetLayouts[sheets[1]] || BASE_INTERNAL;
    
    let all: ColumnDef[] = [];
    tandaLayout.forEach((col) => {
      all.push(col);
      if (col.id === 'status_drawing') all.push({ id: 'kategori', name: 'KATEGORI', type: 'base', width: 220 });
    });

    intLayout.forEach((col, idx) => {
      if (col.type === 'custom' && !all.some(c => c.name.toLowerCase() === col.name.toLowerCase())) {
        const prevCol = intLayout[idx - 1]; 
        let insertIdx = all.findIndex(c => c.name === prevCol?.name);
        if (insertIdx === -1 && prevCol) {
           insertIdx = all.findIndex(c => c.name.toLowerCase() === prevCol.name.toLowerCase());
        }
        if (insertIdx > -1) all.splice(insertIdx + 1, 0, col); else all.push(col); 
      }
    });
    return all;
  };

  const currentLayout = getCurrentLayout();

  useEffect(() => {
    if (!resizingCol || activeSheet === sheets[0]) return;
    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(80, resizingCol.startWidth + (e.clientX - resizingCol.startX));
      setSheetLayouts(prev => {
        const layout = [...(prev[activeSheet] || [])]; const idx = layout.findIndex(c => c.id === resizingCol.id);
        if (idx > -1) { layout[idx] = { ...layout[idx], width: newWidth }; return { ...prev, [activeSheet]: layout }; }
        return prev;
      });
    };
    const handleMouseUp = () => setResizingCol(null);
    window.addEventListener('mousemove', handleMouseMove); window.addEventListener('mouseup', handleMouseUp);
    return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
  }, [resizingCol, activeSheet, sheets]);

  const getFilteredItems = (targetTab: string) => {
    let result = [...scannedItems];
    
    if (targetTab !== sheets[0]) result = result.filter(item => item.kategori === targetTab);
    else if (filterCategory !== "Semua") result = result.filter(item => item.kategori === filterCategory);
    
    if (filterCopro !== "Semua") result = result.filter(item => item.copro === filterCopro);
    if (filterPenerima !== "Semua") result = result.filter(item => item.nama_penerima === filterPenerima);
    
    if (filterStatus !== "Semua") {
      if (filterStatus === "Selesai") result = result.filter(item => item.waktu_dikembalikan !== null);
      if (filterStatus === "Belum Selesai") result = result.filter(item => item.waktu_dikembalikan === null);
    }

    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase();
      const queryNoStrip = query.replace(/-/g, '');
      
      result = result.filter(item => {
        const barcodeLower = item.barcode_id.toLowerCase();
        const barcodeNoStrip = barcodeLower.replace(/-/g, '');
        const penerimaLower = (item.nama_penerima || "").toLowerCase();
        
        if (barcodeLower.includes(query) || barcodeNoStrip.includes(queryNoStrip)) return true;
        if (penerimaLower.includes(query)) return true;
        
        if (item.custom_data) {
          return Object.values(item.custom_data).some(val => val.toLowerCase().includes(query));
        }
        return false;
      });
    }

    if (timeFilterMode === "Spesifik" && specificDate) {
      const targetStart = new Date(specificDate + "T00:00:00").getTime();
      const targetEnd = new Date(specificDate + "T23:59:59.999").getTime();
      result = result.filter(item => item.timestamp_diterima >= targetStart && item.timestamp_diterima <= targetEnd);
    } 
    else if (timeFilterMode === "Rentang" && startDate && endDate) {
      const targetStart = new Date(startDate + "T00:00:00").getTime();
      const targetEnd = new Date(endDate + "T23:59:59.999").getTime();
      result = result.filter(item => item.timestamp_diterima >= targetStart && item.timestamp_diterima <= targetEnd);
    }

    return sortOrder === 'newest' ? result : result.reverse();
  };

  const displayedItems = getFilteredItems(activeSheet);

  const saveHistory = () => { setPastStates((prev) => [...prev.slice(-19), {items: scannedItems, layouts: sheetLayouts}]); setFutureStates([]); };
  const handleUndo = () => { 
    if (pastStates.length === 0) return; 
    const previousState = pastStates[pastStates.length - 1]; 
    setPastStates((prev) => prev.slice(0, -1)); 
    setFutureStates((prev) => [...prev, {items: scannedItems, layouts: sheetLayouts}]); 
    setScannedItems(previousState.items); 
    setSheetLayouts(previousState.layouts); 
    recordGlobalHistory("Undo Aksi (Scan Log)", previousState.items);
  };
  const handleRedo = () => { 
    if (futureStates.length === 0) return; 
    const nextState = futureStates[futureStates.length - 1]; 
    setFutureStates((prev) => prev.slice(0, -1)); 
    setPastStates((prev) => [...prev, {items: scannedItems, layouts: sheetLayouts}]); 
    setScannedItems(nextState.items); 
    setSheetLayouts(nextState.layouts); 
    recordGlobalHistory("Redo Aksi (Scan Log)", nextState.items);
  };

  const internalExecuteBarcode = (barcodeStr: string) => {
    const { scannedItems: curItems, activeSheet: cActiveSheet, sheets: cSheets, scanCategory: cScanCat, scanCopro: cScanCopro, coproList: cCoproList, scanPenerima: cScanPen } = statesRef.current;
    
    const targetCategory = cActiveSheet === cSheets[0] ? cScanCat : cActiveSheet;
    const existingItemIndex = curItems.findIndex(item => item.barcode_id === barcodeStr && item.kategori === targetCategory); // FIX DUPLIKAT PER KATEGORI

    if (existingItemIndex > -1) {
      const existingItem = curItems[existingItemIndex];
      if (targetCategory !== cSheets[1]) {
        if (!existingItem.waktu_dikembalikan) {
          setReturnModal({ isOpen: true, pendingBarcode: barcodeStr, existingItemId: existingItem.id, targetCategory });
          return;
        } else {
          setDuplicateModal({ isOpen: true, pendingBarcode: barcodeStr, targetCategory });
          return;
        }
      } else {
        setDuplicateModal({ isOpen: true, pendingBarcode: barcodeStr, targetCategory });
        return;
      }
    }

    saveHistory();
    const finalCopro = cScanCopro === "" ? barcodeStr.substring(0, 6) : cScanCopro;
    if (finalCopro && !cCoproList.includes(finalCopro)) { setCoproList(prev => [...new Set([...prev, finalCopro])]); }

    const newItem: ScanItem = {
      id: crypto.randomUUID(), barcode_id: barcodeStr, copro: finalCopro,
      nama_penerima: targetCategory === cSheets[1] ? "" : cScanPen,
      kategori: targetCategory, waktu_diterima: new Date().toLocaleString("id-ID"),
      waktu_dikembalikan: null, timestamp_diterima: Date.now()
    };

    setScannedItems(prev => {
      const newData = [newItem, ...prev];
      recordGlobalHistory(`Scan Masuk: ${barcodeStr}`, newData);
      return newData;
    });
  };

  useEffect(() => {
    let buffer = "";
    let lastTime = 0;
    let isScanning = false;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (anyModalOpen) return;
      if (e.key === 'Escape') { (document.activeElement as HTMLElement)?.blur(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); handleUndo(); return; } 
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); handleRedo(); return; }

      const now = performance.now();
      const elapsed = now - lastTime;

      if (elapsed > 60) { 
        buffer = ""; 
        isScanning = false;
      }

      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        buffer += e.key;
        if (buffer.length > 1 && elapsed < 40) {
          isScanning = true;
        }
        if (isScanning) {
          e.preventDefault();
          e.stopPropagation();
        }
      }

      if (e.key === 'Enter') {
        if (buffer.length >= 4 && elapsed < 50) {
          e.preventDefault();
          e.stopPropagation();
          const finalBarcode = buffer;
          buffer = "";
          isScanning = false;
          
          const activeEl = document.activeElement as HTMLElement;
          if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT')) {
            activeEl.blur(); 
          }
          
          internalExecuteBarcode(finalBarcode);
          return;
        }
        buffer = "";
        isScanning = false;
      }

      lastTime = now;

      if (scanMode === 'direct' && directInputRef.current) {
        const activeTag = document.activeElement?.tagName;
        const isTypingInsideInput = activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT';
        if (!isTypingInsideInput && e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
          directInputRef.current.focus();
        }
      }
    };
    
    window.addEventListener('keydown', handleGlobalKeyDown, true); 
    return () => window.removeEventListener('keydown', handleGlobalKeyDown, true);
  }, [pastStates, futureStates, anyModalOpen, scanMode]);

  useEffect(() => {
    const handleMouseUpGlobal = () => setIsDraggingGrid(false); window.addEventListener('mouseup', handleMouseUpGlobal); return () => window.removeEventListener('mouseup', handleMouseUpGlobal);
  }, []);

  const handleDirectScanSubmit = () => {
    if (directBarcode.trim() === "" || anyModalOpen) return;
    internalExecuteBarcode(directBarcode.trim());
    setDirectBarcode("");
  };

  const handleReturnCancel = () => { setReturnModal({ isOpen: false, pendingBarcode: "", existingItemId: "", targetCategory: "" }); setTimeout(() => directInputRef.current?.focus(), 100); };
  
  const handleReturnConfirm = () => {
    saveHistory();
    setScannedItems(prev => {
      const updated = [...prev]; const idx = updated.findIndex(i => i.id === returnModal.existingItemId);
      if (idx > -1) {
        updated[idx] = { ...updated[idx], waktu_dikembalikan: new Date().toLocaleString("id-ID") };
        const itemToMove = updated.splice(idx, 1)[0]; updated.unshift(itemToMove);
      }
      recordGlobalHistory(`Mengembalikan Drawing: ${returnModal.pendingBarcode}`, updated);
      return updated;
    });
    setAlertModal({ isOpen: true, title: "Drawing Dikembalikan!", message: `Drawing ${returnModal.pendingBarcode} berhasil dicatat sebagai SUDAH DIKEMBALIKAN.` });
    handleReturnCancel();
  };

  const handleDuplicateCancel = () => { setDuplicateModal({ isOpen: false, pendingBarcode: "", targetCategory: "" }); setTimeout(() => directInputRef.current?.focus(), 100); };
  
  const handleDuplicateReplace = () => {
    saveHistory();
    const pendingTrimmed = duplicateModal.pendingBarcode.trim();
    const finalCopro = scanCopro === "" ? pendingTrimmed.substring(0, 6) : scanCopro;
    if (finalCopro && !coproList.includes(finalCopro)) { setCoproList(prev => [...new Set([...prev, finalCopro])]); }

    const newItem: ScanItem = { 
      id: crypto.randomUUID(), barcode_id: pendingTrimmed, copro: finalCopro, 
      nama_penerima: duplicateModal.targetCategory === sheets[1] ? "" : scanPenerima,
      kategori: duplicateModal.targetCategory, waktu_diterima: new Date().toLocaleString("id-ID"), waktu_dikembalikan: null, timestamp_diterima: Date.now()
    };
    
    setScannedItems(prev => {
      const filtered = prev.filter(item => item.barcode_id !== pendingTrimmed || item.kategori !== duplicateModal.targetCategory);
      const newData = [newItem, ...filtered];
      recordGlobalHistory(`Menimpa Barcode Duplikat: ${pendingTrimmed}`, newData);
      return newData;
    });
    handleDuplicateCancel();
  };

  const handleDuplicateAddAnyway = () => {
    saveHistory();
    const pendingTrimmed = duplicateModal.pendingBarcode.trim();
    const finalCopro = scanCopro === "" ? pendingTrimmed.substring(0, 6) : scanCopro;
    if (finalCopro && !coproList.includes(finalCopro)) { setCoproList(prev => [...new Set([...prev, finalCopro])]); }

    const newItem: ScanItem = { 
      id: crypto.randomUUID(), barcode_id: pendingTrimmed, copro: finalCopro, 
      nama_penerima: duplicateModal.targetCategory === sheets[1] ? "" : scanPenerima,
      kategori: duplicateModal.targetCategory, waktu_diterima: new Date().toLocaleString("id-ID"), waktu_dikembalikan: null, timestamp_diterima: Date.now()
    };
    
    setScannedItems(prev => {
      const newData = [newItem, ...prev];
      recordGlobalHistory(`Menambahkan Barcode Duplikat: ${pendingTrimmed}`, newData);
      return newData;
    });
    handleDuplicateCancel();
  };

  const handleListAction = () => {
    if (listModal.mode === 'delete') {
      if (listModal.type === 'copro') { const newList = coproList.filter(c => c !== listModal.oldName); setCoproList(newList); if (scanCopro === listModal.oldName) setScanCopro(newList[0] || ""); } 
      else { const newList = penerimaList.filter(p => p !== listModal.oldName); setPenerimaList(newList); if (scanPenerima === listModal.oldName) setScanPenerima(""); }
    } else {
      const val = listModal.newName.trim(); if (!val) return;
      if (listModal.mode === 'add') {
        if (listModal.type === 'copro' && !coproList.includes(val)) { setCoproList([...coproList, val]); setScanCopro(val); } 
        else if (listModal.type === 'penerima' && !penerimaList.includes(val)) { setPenerimaList([...penerimaList, val]); setScanPenerima(val); }
      } else if (listModal.mode === 'edit') {
        if (listModal.type === 'copro' && coproList.includes(val) && val !== listModal.oldName) return; 
        if (listModal.type === 'penerima' && penerimaList.includes(val) && val !== listModal.oldName) return; 
        saveHistory(); 
        if (listModal.type === 'copro') {
          setCoproList(coproList.map(c => c === listModal.oldName ? val : c)); setScanCopro(val);
          setScannedItems(prev => {
            const newData = prev.map(i => i.copro === listModal.oldName ? { ...i, copro: val } : i);
            recordGlobalHistory(`Ubah Copro ${listModal.oldName} ke ${val}`, newData);
            return newData;
          });
        } else {
          setPenerimaList(penerimaList.map(p => p === listModal.oldName ? val : p)); setScanPenerima(val);
          setScannedItems(prev => {
            const newData = prev.map(i => i.nama_penerima === listModal.oldName ? { ...i, nama_penerima: val } : i);
            recordGlobalHistory(`Ubah Penerima ${listModal.oldName} ke ${val}`, newData);
            return newData;
          });
        }
      }
    }
    
    if (listModal.mode === 'add' && listModal.type === 'penerima' && pendingPenerimaItemId) {
      saveHistory();
      setScannedItems(prev => {
        const newData = prev.map(item => item.id === pendingPenerimaItemId ? { ...item, nama_penerima: listModal.newName.trim() } : item);
        recordGlobalHistory(`Tambah Penerima via Dropdown`, newData);
        return newData;
      });
    }
    
    setListModal({ ...listModal, isOpen: false }); setPendingPenerimaItemId(null); setTimeout(() => directInputRef.current?.focus(), 100);
  };

  const handleChangePenerima = (id: string, newPenerima: string) => {
    if (newPenerima === "__ADD_NEW__") {
      setPendingPenerimaItemId(id);
      setListModal({ isOpen: true, mode: 'add', type: 'penerima', oldName: "", newName: "" });
      return;
    }
    saveHistory();
    setScannedItems(prev => {
      const newData = prev.map(item => item.id === id ? { ...item, nama_penerima: newPenerima } : item);
      recordGlobalHistory(`Ganti Penerima ke ${newPenerima}`, newData);
      return newData;
    });
  };

  const handleCategoryChange = (itemId: string, newCategory: string) => {
    saveHistory();
    setScannedItems(prev => {
      const newData = prev.map(item => {
        if (item.id === itemId) {
          const oldCategory = item.kategori;
          if (oldCategory === newCategory) return item;

          const oldLayout = sheetLayouts[oldCategory] || [];
          const newLayout = sheetLayouts[newCategory] || [];
          const newCustomData = { ...(item.custom_data || {}) };

          oldLayout.forEach(oldCol => {
            if (oldCol.type === 'custom' && newCustomData[oldCol.id] !== undefined) {
              const matchingNewCol = newLayout.find(c => c.type === 'custom' && c.name.toLowerCase() === oldCol.name.toLowerCase());
              if (matchingNewCol) {
                newCustomData[matchingNewCol.id] = newCustomData[oldCol.id];
              }
            }
          });

          return { ...item, kategori: newCategory, custom_data: newCustomData, nama_penerima: newCategory === sheets[1] ? "" : item.nama_penerima };
        }
        return item;
      });
      recordGlobalHistory(`Ubah Kategori Data`, newData);
      return newData;
    });
  };

  const getGridDataString = () => {
    if (!selection) return "";
    const minR = Math.min(selection.startR, selection.endR); const maxR = Math.max(selection.startR, selection.endR); const minC = Math.min(selection.startC, selection.endC); const maxC = Math.max(selection.startC, selection.endC);
    let tsv = "";
    for (let r = minR; r <= maxR; r++) {
      let rowData = []; const item = displayedItems[r]; if (!item) continue;
      for (let c = minC; c <= maxC; c++) {
        const col = currentLayout[c]; let val = "";
        if (col.id === 'no') val = (r + 1).toString();
        else if (col.id === 'copro') val = item.copro;
        else if (col.id === 'barcode_id') val = item.barcode_id;
        else if (col.id === 'waktu_diterima') val = item.waktu_diterima;
        else if (col.id === 'nama_penerima') val = item.kategori === sheets[1] ? "-" : (item.nama_penerima || "-");
        else if (col.id === 'waktu_dikembalikan') val = item.kategori === sheets[1] ? "-" : (item.waktu_dikembalikan || "-");
        else if (col.id === 'status_drawing') val = item.kategori === sheets[1] ? "-" : (item.waktu_dikembalikan ? "SUDAH DIKEMBALIKAN" : "BELUM DIKEMBALIKAN");
        else if (col.id === 'kategori') val = item.kategori;
        else {
          const itemLayout = sheetLayouts[item.kategori] || [];
          const actualCol = itemLayout.find(x => x.name.toLowerCase() === col.name.toLowerCase());
          val = actualCol ? (item.custom_data?.[actualCol.id] || "") : "";
        }
        rowData.push(val.replace(/\t/g, " ").replace(/\n/g, " ")); 
      }
      tsv += rowData.join("\t") + "\n";
    }
    return tsv.trimEnd();
  };

  const handleGridPaste = (clipboardText: string) => {
    if (!selection) return;
    const minR = Math.min(selection.startR, selection.endR); const minC = Math.min(selection.startC, selection.endC); const rows = clipboardText.split(/\r\n|\n|\r/);
    saveHistory();
    setScannedItems(prevItems => {
      const newItems = [...prevItems];
      for (let i = 0; i < rows.length; i++) {
        const targetR = minR + i; if (targetR >= displayedItems.length) break; 
        const targetItem = displayedItems[targetR];
        const globalIdx = newItems.findIndex(x => x.id === targetItem.id); if (globalIdx === -1) continue;
        const cols = rows[i].split("\t"); let updatedItem = { ...newItems[globalIdx], custom_data: { ...(newItems[globalIdx].custom_data || {}) } };
        for (let j = 0; j < cols.length; j++) {
          const targetC = minC + j; if (targetC >= currentLayout.length) break;
          const colDef = currentLayout[targetC]; const val = cols[j];
          if (colDef.type === 'custom') { const itemLayout = sheetLayouts[targetItem.kategori] || []; const actualCol = itemLayout.find(x => x.name.toLowerCase() === colDef.name.toLowerCase()); if (actualCol) updatedItem.custom_data[actualCol.id] = val; }
          else if (colDef.id === 'copro') {
            updatedItem.copro = val;
            if (val && !coproList.includes(val)) { setCoproList(p => [...new Set([...p, val])]); }
          }
          else if (colDef.id === 'barcode_id') updatedItem.barcode_id = val;
          else if (colDef.id === 'nama_penerima' && targetItem.kategori !== sheets[1]) {
            updatedItem.nama_penerima = val;
            if (val && !penerimaList.includes(val)) { setPenerimaList(p => [...new Set([...p, val])]); }
          }
        }
        newItems[globalIdx] = updatedItem;
      }
      recordGlobalHistory("Paste Data ke Tabel Excel", newItems);
      return newItems;
    });
  };

  useEffect(() => {
    const handleCopy = (e: ClipboardEvent) => { if (anyModalOpen || !selection) return; const textSelected = window.getSelection()?.toString(); if (textSelected && textSelected.length > 0) return; const tsv = getGridDataString(); if (tsv) { e.preventDefault(); e.clipboardData?.setData('text/plain', tsv); } };
    const handlePaste = (e: ClipboardEvent) => { if (anyModalOpen || !selection) return; const activeEl = document.activeElement; const isInputActive = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA'); if (isInputActive && selection.startR === selection.endR && selection.startC === selection.endC) return; e.preventDefault(); const clipboardData = e.clipboardData?.getData('Text'); if (clipboardData) handleGridPaste(clipboardData); };
    window.addEventListener('copy', handleCopy); window.addEventListener('paste', handlePaste); return () => { window.removeEventListener('copy', handleCopy); window.removeEventListener('paste', handlePaste); };
  }, [selection, displayedItems, currentLayout, scannedItems]);

  const handleCellKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement | HTMLSelectElement>, rIdx: number, cIdx: number) => {
    if (e.key === "Enter" && e.shiftKey) return;
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter"].includes(e.key)) {
      let nextR = rIdx; let nextC = cIdx; let shouldMove = false;
      if (e.key === "ArrowUp") { nextR--; shouldMove = true; } else if (e.key === "ArrowDown" || e.key === "Enter") { nextR++; shouldMove = true; } else if (e.key === "ArrowLeft" && (e.currentTarget.tagName === 'SELECT' || (e.currentTarget as HTMLInputElement).selectionStart === 0)) { nextC--; shouldMove = true; } else if (e.key === "ArrowRight" && (e.currentTarget.tagName === 'SELECT' || (e.currentTarget as HTMLInputElement).selectionEnd === (e.currentTarget as HTMLInputElement).value.length)) { nextC++; shouldMove = true; }
      if (shouldMove) { let targetElement: HTMLElement | null = null; if (e.key === "ArrowLeft" || e.key === "ArrowRight") { let tempC = nextC; while(tempC >= 0 && tempC < currentLayout.length) { targetElement = document.getElementById(`cell-${nextR}-${tempC}`); if (targetElement) break; e.key === "ArrowLeft" ? tempC-- : tempC++; } } else { targetElement = document.getElementById(`cell-${nextR}-${nextC}`); } if (targetElement) { e.preventDefault(); targetElement.focus(); } }
    }
  };

  const handleAddColumn = (insertAfterIndex: number) => {
    if (activeSheet === sheets[0]) return;
    saveHistory(); 
    const newCol: ColumnDef = { id: `custom_${Date.now()}`, name: 'KOLOM BARU', type: 'custom', width: 180 };
    const layout = [...(sheetLayouts[activeSheet] || (activeSheet === sheets[1] ? BASE_INTERNAL : BASE_TANDA_TERIMA))];
    layout.splice(insertAfterIndex + 1, 0, newCol);
    setSheetLayouts({ ...sheetLayouts, [activeSheet]: layout });
  };

  const handleRenameColumn = (colId: string, newName: string) => {
    if (activeSheet === sheets[0]) return;
    setSheetLayouts(prev => {
      const layout = [...(prev[activeSheet] || [])];
      const idx = layout.findIndex(c => c.id === colId);
      if (idx > -1) { layout[idx] = { ...layout[idx], name: newName }; return { ...prev, [activeSheet]: layout }; }
      return prev;
    });
  };

  const confirmDeleteColumnAction = () => {
    if (!deleteColConfirm.colId || activeSheet === sheets[0]) return;
    saveHistory();
    setSheetLayouts(prev => {
      const layout = [...(prev[activeSheet] || [])];
      const newLayout = layout.filter(c => c.id !== deleteColConfirm.colId);
      return { ...prev, [activeSheet]: newLayout };
    });
    setDeleteColConfirm({ isOpen: false, colId: "", colName: "" });
  };

  const handleCustomDataChange = (itemId: string, colName: string, value: string) => {
    saveHistory();
    setScannedItems(prev => {
      const newData = prev.map(item => {
        if (item.id === itemId) {
          const itemLayout = sheetLayouts[item.kategori] || [];
          const actualCol = itemLayout.find(c => c.name.toLowerCase() === colName.toLowerCase());
          if (actualCol) return { ...item, custom_data: { ...(item.custom_data || {}), [actualCol.id]: value } };
        }
        return item;
      });
      recordGlobalHistory(`Ubah Data Custom Barcode`, newData);
      return newData;
    });
  };

  const handleCoproChange = (itemId: string, value: string) => { 
    saveHistory(); 
    setScannedItems(prev => {
      const newData = prev.map(item => item.id === itemId ? { ...item, copro: value } : item);
      recordGlobalHistory(`Ubah Copro Data`, newData);
      return newData;
    }); 
    if (value && !coproList.includes(value)) {
      setCoproList(prev => [...prev, value]);
    }
  };

  const handleColDragStart = (e: React.DragEvent, colId: string) => { if (activeSheet === sheets[0]) return; setDraggedColId(colId); e.dataTransfer.effectAllowed = 'move'; };
  const handleColDrop = (e: React.DragEvent, targetColId: string) => {
    e.preventDefault(); if (!draggedColId || draggedColId === targetColId || activeSheet === sheets[0]) return;
    saveHistory();
    const layout = [...(sheetLayouts[activeSheet] || [])]; const fromIdx = layout.findIndex(c => c.id === draggedColId); const toIdx = layout.findIndex(c => c.id === targetColId);
    if (layout[fromIdx].type !== 'custom') return; 
    const [moved] = layout.splice(fromIdx, 1); layout.splice(toIdx, 0, moved); setSheetLayouts({ ...sheetLayouts, [activeSheet]: layout }); setDraggedColId(null);
  };

  const confirmDeleteRowAction = () => { 
    if (deleteConfirm.itemId) { 
      saveHistory(); 
      setScannedItems((prev) => {
        const newData = prev.filter((item) => item.id !== deleteConfirm.itemId);
        recordGlobalHistory(`Hapus Barcode: ${deleteConfirm.barcodeId}`, newData);
        return newData;
      }); 
    } 
    setDeleteConfirm({ isOpen: false, itemId: null, barcodeId: "" }); 
  };
  
  const confirmResetDataAction = () => { 
    saveHistory(); 
    setScannedItems((prev) => {
      const newData = activeSheet === sheets[0] ? [] : prev.filter(item => item.kategori !== activeSheet);
      recordGlobalHistory(`Mengosongkan Tab ${activeSheet}`, newData);
      return newData;
    }); 
    setResetConfirmOpen(false); 
  };

  const handleRenameStart = (sheet: string) => { setEditSheetName(sheet); setEditingSheet(sheet); };
  const handleRenameSubmit = (oldName: string) => {
    const newName = editSheetName.trim(); if (!newName || newName === oldName) return setEditingSheet(null);
    if (sheets.includes(newName)) { setAlertModal({ isOpen: true, title: "Nama Tidak Valid", message: `Nama tab "${newName}" sudah digunakan!` }); setEditingSheet(null); return; }
    
    saveHistory();
    const newSheets = sheets.map(s => s === oldName ? newName : s); setSheets(newSheets);
    setSelectedExportSheets(prev => prev.map(s => s === oldName ? newName : s));
    
    setScannedItems(prev => {
      const newData = prev.map(i => i.kategori === oldName ? { ...i, kategori: newName } : i);
      recordGlobalHistory(`Ubah Nama Tab: ${oldName} ke ${newName}`, newData);
      return newData;
    });
    
    const newLayouts = { ...sheetLayouts };
    if(newLayouts[oldName]) { newLayouts[newName] = newLayouts[oldName]; delete newLayouts[oldName]; }
    setSheetLayouts(newLayouts);

    if (activeSheet === oldName) setActiveSheet(newName);
    if (filterCategory === oldName) setFilterCategory(newName);
    if (scanCategory === oldName) setScanCategory(newName);
    setEditingSheet(null);
  };

  const handleExportCheckboxToggle = (sheetName: string) => {
    if (sheetName === sheets[0]) { if (selectedExportSheets.length === sheets.length) setSelectedExportSheets([]); else setSelectedExportSheets([...sheets]); } 
    else {
      let newSelected: string[];
      if (selectedExportSheets.includes(sheetName)) newSelected = selectedExportSheets.filter(s => s !== sheetName && s !== sheets[0]);
      else { newSelected = [...selectedExportSheets, sheetName]; const allIndividuals = sheets.filter(s => s !== sheets[0]); if (allIndividuals.every(s => newSelected.includes(s)) && !newSelected.includes(sheets[0])) newSelected.push(sheets[0]); }
      setSelectedExportSheets(newSelected);
    }
  };

  const createStyledWorksheet = (targetSheet: string) => {
    const items = getFilteredItems(targetSheet);
    
    let expLayout: ColumnDef[] = [];
    if (targetSheet === sheets[0]) {
      const tLayout = sheetLayouts[sheets[2]] || BASE_TANDA_TERIMA;
      const iLayout = sheetLayouts[sheets[1]] || BASE_INTERNAL;
      expLayout = [];
      tLayout.forEach((col) => {
        expLayout.push(col);
        if (col.id === 'status_drawing') {
          expLayout.push({ id: 'kategori', name: 'KATEGORI', type: 'base', width: 220 });
        }
      });
      iLayout.forEach((col, idx) => {
        if (col.type === 'custom' && !expLayout.some(c => c.name.toLowerCase() === col.name.toLowerCase())) {
          const prevCol = iLayout[idx - 1]; 
          const insertIdx = expLayout.findIndex(c => c.name === prevCol?.name);
          if (insertIdx > -1) expLayout.splice(insertIdx + 1, 0, col); else expLayout.push(col);
        }
      });
    } else { expLayout = sheetLayouts[targetSheet] || (targetSheet === sheets[1] ? BASE_INTERNAL : BASE_TANDA_TERIMA); }

    const headers = expLayout.map(col => col.name);
    const rows = items.length === 0 ? [headers.map((_, i) => i === 0 ? "Belum ada data." : "")] : items.map((item, index) => {
      return expLayout.map(col => {
        if (col.id === 'no') return index + 1;
        if (col.id === 'copro') return item.copro;
        if (col.id === 'barcode_id') return item.barcode_id;
        if (col.id === 'waktu_diterima') return item.waktu_diterima;
        if (col.id === 'nama_penerima') return item.kategori === sheets[1] ? "-" : (item.nama_penerima || "-");
        if (col.id === 'waktu_dikembalikan') return item.kategori === sheets[1] ? "-" : (item.waktu_dikembalikan || "-");
        if (col.id === 'status_drawing') return item.kategori === sheets[1] ? "-" : (item.waktu_dikembalikan ? "SUDAH DIKEMBALIKAN" : "BELUM DIKEMBALIKAN");
        if (col.id === 'kategori') return item.kategori;
        const itemLayout = sheetLayouts[item.kategori] || []; const actualCol = itemLayout.find(c => c.name.toLowerCase() === col.name.toLowerCase());
        return actualCol ? (item.custom_data?.[actualCol.id] || "") : "";
      });
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws['!cols'] = expLayout.map(col => ({ wpx: col.width }));
    for (const key in ws) {
      if (key[0] === '!') continue; const cell = ws[key]; const rowIndex = parseInt(key.replace(/[A-Z]/g, ''));
      cell.s = { font: { name: "Arial", sz: 11, color: { rgb: "1F2937" } }, alignment: { horizontal: "center", vertical: "top", wrapText: true } };
      if (viewGrid) cell.s.border = { top: { style: "thin", color: { rgb: "9CA3AF" } }, bottom: { style: "thin", color: { rgb: "9CA3AF" } }, left: { style: "thin", color: { rgb: "9CA3AF" } }, right: { style: "thin", color: { rgb: "9CA3AF" } } };
      else cell.s.border = { bottom: { style: "thin", color: { rgb: "D1D5DB" } } };
      if (rowIndex === 1) { cell.s.font.bold = true; cell.s.font.color = { rgb: "111827" }; cell.s.fill = { fgColor: { rgb: "E5E7EB" } }; cell.s.alignment.vertical = "center"; if (!viewGrid) cell.s.border = { bottom: { style: "medium", color: { rgb: "9CA3AF" } } }; }
    }
    return ws;
  };

  const executeExport = async () => {
    if (selectedExportSheets.length === 0) return setAlertModal({ isOpen: true, title: "Pilih Kategori", message: "Centang minimal satu." });
    setExportMenuOpen(false);
    if (exportFormat === 'single') {
      const workbook = XLSX.utils.book_new(); const sortedSheets = [...selectedExportSheets].sort((a, b) => a === sheets[0] ? -1 : b === sheets[0] ? 1 : 0);
      sortedSheets.forEach(sheetName => { XLSX.utils.book_append_sheet(workbook, createStyledWorksheet(sheetName), sheetName.substring(0, 31)); }); XLSX.writeFile(workbook, `Laporan_Drawing_Winteq.xlsx`);
    } else {
      for (let i = 0; i < selectedExportSheets.length; i++) {
        const sheetName = selectedExportSheets[i]; const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, createStyledWorksheet(sheetName), sheetName.substring(0, 31)); XLSX.writeFile(workbook, `Laporan_${sheetName.replace(/\s+/g, '_')}.xlsx`);
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
  };

  if (!isMounted) return null;
  const thBorderClass = viewGrid ? "border border-gray-400 bg-gray-100" : "border-b border-gray-300 bg-white"; const tdBorderClass = viewGrid ? "border border-gray-300" : "border-b border-gray-200";

  return (
    <>
      <style>{`.thin-scrollbar::-webkit-scrollbar { width: 6px; } .thin-scrollbar::-webkit-scrollbar-track { background: transparent; } .thin-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 10px; } .thin-scrollbar::-webkit-scrollbar-thumb:hover { background-color: #94a3b8; }`}</style>

      <div className="w-full h-[calc(100vh-8rem)] flex flex-col gap-4">
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 shrink-0 flex flex-wrap gap-4 items-start">
          <div className="flex-1 min-w-[250px]">
            <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase">Cari Bebas (Sapu Jagat)</label>
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input type="text" value={searchQuery} onChange={(e)=>setSearchQuery(e.target.value)} placeholder="Nomer, Penerima, Title..." className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"/>
            </div>
          </div>
          
          <div className="flex flex-col gap-1.5 min-w-[160px] w-auto relative" ref={timeFilterRef}>
             <label className="block text-xs font-bold text-gray-500 uppercase">Filter Waktu</label>
             <select value={timeFilterMode} onChange={(e) => { setTimeFilterMode(e.target.value); e.target.blur(); }} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50 focus:bg-white outline-none cursor-pointer">
               <option value="Semua">Semua Waktu</option>
               <option value="Spesifik">Tanggal Spesifik</option>
               <option value="Rentang">Rentang Waktu</option>
             </select>
             {(timeFilterMode === "Spesifik" || timeFilterMode === "Rentang") && (
               <div className="absolute top-[105%] left-0 mt-1 bg-white border border-gray-200 shadow-xl rounded-lg p-3 z-50 min-w-[220px]">
                 {timeFilterMode === "Spesifik" && (
                   <div>
                     <label className="block text-xs font-bold text-gray-500 mb-1">Pilih Tanggal</label>
                     <input type="date" value={specificDate} onChange={(e) => setSpecificDate(e.target.value)} className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700 outline-none focus:ring-2 focus:ring-blue-500" />
                   </div>
                 )}
                 {timeFilterMode === "Rentang" && (
                   <div className="flex flex-col gap-2">
                     <div>
                       <label className="block text-xs font-bold text-gray-500 mb-1">Dari Tanggal</label>
                       <input type="date" value={startDate} onChange={(e)=>setStartDate(e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-700 outline-none focus:ring-2 focus:ring-blue-500" />
                     </div>
                     <div>
                       <label className="block text-xs font-bold text-gray-500 mb-1">Sampai Tanggal</label>
                       <input type="date" value={endDate} onChange={(e)=>setEndDate(e.target.value)} className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-700 outline-none focus:ring-2 focus:ring-blue-500" />
                     </div>
                   </div>
                 )}
               </div>
             )}
          </div>

          <div className="w-32"><label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase">Filter Copro</label><select value={filterCopro} onChange={(e)=> { setFilterCopro(e.target.value); e.target.blur(); }} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50 focus:bg-white outline-none cursor-pointer"><option value="Semua">Semua</option>{coproList.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
          
          {activeSheet !== sheets[1] && (
            <>
              <div className="w-36"><label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase">Filter Penerima</label><select value={filterPenerima} onChange={(e)=> { setFilterPenerima(e.target.value); e.target.blur(); }} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50 focus:bg-white outline-none cursor-pointer"><option value="Semua">Semua</option>{penerimaList.map(p => <option key={p} value={p}>{p}</option>)}</select></div>
              <div className="w-40"><label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase">Status Drawing</label><select value={filterStatus} onChange={(e)=> { setFilterStatus(e.target.value); e.target.blur(); }} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50 focus:bg-white outline-none cursor-pointer"><option value="Semua">Semua Status</option><option value="Belum Selesai">Belum Dikembalikan</option><option value="Selesai">Sudah Dikembalikan</option></select></div>
            </>
          )}

          {activeSheet === sheets[0] && (<div className="w-44"><label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase">Kategori Drawing</label><select value={filterCategory} onChange={(e)=> { setFilterCategory(e.target.value); e.target.blur(); }} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50 focus:bg-white outline-none cursor-pointer"><option value="Semua">Semua Kategori</option>{sheets[1] && <option value={sheets[1]}>{sheets[1]}</option>}{sheets[2] && <option value={sheets[2]}>{sheets[2]}</option>}</select></div>)}
        </div>

        <div className="bg-white rounded-t-xl shadow-sm border border-gray-200 flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-gray-100 flex flex-col 2xl:flex-row justify-between items-start 2xl:items-center bg-gray-50/50 gap-4 shrink-0 relative">
            <div className="flex items-center space-x-3 shrink-0">
              <h3 className="font-bold text-gray-800 text-lg whitespace-nowrap">{activeSheet}</h3>
              <div className="bg-blue-100 text-blue-800 text-sm font-bold px-3 py-1.5 rounded-md border border-blue-200 shadow-sm shrink-0">
                Total: {displayedItems.length}
              </div>
            </div>

            <div className="flex flex-wrap items-center 2xl:justify-end gap-2 w-full">
              <div className="flex bg-gray-100 rounded-lg p-1 border border-gray-200 shrink-0">
                <button onClick={() => setScanMode('direct')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center ${scanMode === 'direct' ? 'bg-white text-blue-700 shadow-sm ring-1 ring-black/5' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'}`}>
                  <BoltIcon className="w-4 h-4 md:mr-1"/> <span className="hidden md:inline">Scan Langsung</span>
                </button>
                <button onClick={() => setScanMode('dashboard')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center ${scanMode === 'dashboard' ? 'bg-white text-blue-700 shadow-sm ring-1 ring-black/5' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'}`}>
                   <span className="hidden md:inline">Scan di Dashboard</span><span className="md:hidden">Dashboard</span>
                </button>
              </div>

              <button onClick={() => setSortOrder(prev => prev === 'newest' ? 'oldest' : 'newest')} className="p-2 rounded-lg transition-colors flex items-center shadow-sm bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 shrink-0"><ArrowsUpDownIcon className="w-4 h-4 md:mr-1.5" /><span className="text-sm font-medium hidden md:inline">{sortOrder === 'newest' ? 'Terbaru' : 'Terlama'}</span></button>
              <button onClick={() => setViewGrid(!viewGrid)} className={`p-2 rounded-lg transition-colors flex items-center shadow-sm shrink-0 ${viewGrid ? 'bg-blue-100 text-blue-700 border border-blue-200' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}><Squares2X2Icon className="w-4 h-4 md:mr-1.5" /><span className="text-sm font-medium hidden md:inline">View Grid</span></button>
              <div className="flex bg-gray-100 rounded-lg p-1 border border-gray-200 shrink-0"><button onClick={handleUndo} disabled={pastStates.length === 0} className={`p-1.5 rounded-md flex items-center ${pastStates.length > 0 ? "bg-white text-gray-700 hover:text-blue-600" : "text-gray-400 cursor-not-allowed opacity-60"}`}><ArrowUturnLeftIcon className="w-4 h-4" /></button><button onClick={handleRedo} disabled={futureStates.length === 0} className={`p-1.5 rounded-md flex items-center ml-1 ${futureStates.length > 0 ? "bg-white text-gray-700 hover:text-blue-600" : "text-gray-400 cursor-not-allowed opacity-60"}`}><ArrowUturnRightIcon className="w-4 h-4" /></button></div>
              <div className="relative shrink-0" ref={exportMenuRef}>
                <button onClick={() => setExportMenuOpen(!exportMenuOpen)} className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium py-2 px-4 rounded-lg shadow-sm flex items-center transition-colors"><DocumentArrowDownIcon className="w-4 h-4 mr-1.5" /> Unduh Excel <ChevronDownIcon className={`w-3.5 h-3.5 ml-2 transition-transform ${exportMenuOpen ? 'rotate-180' : ''}`} /></button>
                {exportMenuOpen && (
                  <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden flex flex-col">
                    <div className="p-3 border-b border-gray-100 bg-gray-50"><h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Pilih Data Kategori</h4></div>
                    <div className="max-h-48 overflow-y-auto p-2">{sheets.map(sheet => (<label key={sheet} className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer"><input type="checkbox" checked={sheet === sheets[0] ? selectedExportSheets.length === sheets.length : selectedExportSheets.includes(sheet)} onChange={() => handleExportCheckboxToggle(sheet)} className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500" /><span className={`ml-3 text-sm ${sheet === sheets[0] ? "font-bold text-gray-800" : "text-gray-600"}`}>{sheet}</span></label>))}</div>
                    <div className="p-3 border-t border-gray-100 bg-gray-50"><h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Format Unduhan</h4><div className="space-y-2"><label className="flex items-center cursor-pointer"><input type="radio" name="exportFormat" value="single" checked={exportFormat === 'single'} onChange={() => setExportFormat('single')} className="w-4 h-4 text-green-600 border-gray-300 focus:ring-green-500" /><span className="ml-3 text-sm text-gray-700">Download dalam satu File</span></label><label className="flex items-center cursor-pointer"><input type="radio" name="exportFormat" value="multiple" checked={exportFormat === 'multiple'} onChange={() => setExportFormat('multiple')} className="w-4 h-4 text-green-600 border-gray-300 focus:ring-green-500" /><span className="ml-3 text-sm text-gray-700">Download File terpisah</span></label></div></div>
                    <div className="p-3 border-t border-gray-100"><button onClick={executeExport} className="w-full bg-green-600 hover:bg-green-700 text-white text-sm font-bold py-2.5 rounded-lg transition-colors">Eksekusi Unduhan</button></div>
                  </div>
                )}
              </div>
              {displayedItems.length > 0 && <button onClick={() => setResetConfirmOpen(true)} className="bg-red-50 hover:bg-red-100 text-red-600 text-sm font-medium py-2 px-4 rounded-lg border border-red-200 shrink-0">Kosongkan Tab</button>}
            </div>
          </div>
          
          {scanMode === 'direct' && (
            <div className="bg-blue-50/50 border-b border-blue-100 p-3 flex flex-wrap items-center gap-3 shrink-0 relative z-40">
              <div className="flex items-center gap-1.5 bg-blue-100 text-blue-800 px-3 py-1.5 rounded-md font-bold text-sm shrink-0">
                <BoltIcon className="w-4 h-4" /> Fast Scan
              </div>
              
              {activeSheet === sheets[0] && (
                <select value={scanCategory} onChange={(e) => { setScanCategory(e.target.value); e.target.blur(); }} className="p-2 border border-blue-200 rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white cursor-pointer w-56 shrink-0 font-medium text-gray-700">
                  {sheets[1] && <option value={sheets[1]}>{sheets[1]}</option>}
                  {sheets[2] && <option value={sheets[2]}>{sheets[2]}</option>}
                </select>
              )}

              <div className="flex space-x-1 relative shrink-0">
                <div className="relative" ref={coproRef}>
                  <div 
                    className="p-2 border border-blue-200 rounded-md bg-white text-gray-700 text-sm cursor-pointer flex justify-between items-center min-w-[130px]"
                    onClick={() => setCoproDropdownOpen(!coproDropdownOpen)}
                  >
                    <span>{scanCopro || "Auto Copro"}</span>
                    <ChevronDownIcon className="w-4 h-4 text-gray-500 ml-2" />
                  </div>
                  {coproDropdownOpen && (
                    <div className="absolute z-[100] top-full left-0 w-48 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto thin-scrollbar">
                      <div className="px-4 py-2 hover:bg-gray-50 cursor-pointer text-sm text-gray-500 italic border-b border-gray-100" onClick={() => { setScanCopro(""); setCoproDropdownOpen(false); }}>
                        Auto Copro
                      </div>
                      {coproList.map(c => (
                        <div key={c} className="flex justify-between items-center px-4 py-2 hover:bg-gray-50 cursor-pointer group" onClick={() => { setScanCopro(c); setCoproDropdownOpen(false); }}>
                          <span className="text-sm text-gray-700">{c}</span>
                          <div className="flex space-x-1">
                            <button onClick={(e) => { e.stopPropagation(); setListModal({ isOpen: true, mode: 'edit', type: 'copro', oldName: c, newName: c }); setCoproDropdownOpen(false); }} className="text-blue-500 hover:bg-blue-100 p-1 rounded transition-colors" title="Edit"><PencilIcon className="w-3.5 h-3.5" /></button>
                            <button onClick={(e) => { e.stopPropagation(); setListModal({ isOpen: true, mode: 'delete', type: 'copro', oldName: c, newName: "" }); setCoproDropdownOpen(false); }} className="text-red-500 hover:bg-red-100 p-1 rounded transition-colors" title="Hapus"><TrashIcon className="w-3.5 h-3.5" /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <button onClick={() => setListModal({ isOpen: true, mode: 'add', type: 'copro', oldName: "", newName: "" })} className="bg-white text-blue-600 hover:bg-blue-50 border border-blue-200 px-2 rounded-md flex items-center justify-center" title="Tambah Copro Baru"><PlusIcon className="w-4 h-4" /></button>
              </div>

              <div className="flex space-x-1 relative shrink-0">
                <div className="relative" ref={penerimaRef}>
                  <div 
                    className={`p-2 border border-blue-200 rounded-md bg-white text-gray-700 text-sm flex justify-between items-center min-w-[140px] ${activeSheet === sheets[0] ? scanCategory === sheets[1] ? 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-70' : 'cursor-pointer' : activeSheet === sheets[1] ? 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-70' : 'cursor-pointer'}`}
                    onClick={() => { 
                      const targetCat = activeSheet === sheets[0] ? scanCategory : activeSheet;
                      if (targetCat !== sheets[1]) setPenerimaDropdownOpen(!penerimaDropdownOpen); 
                    }}
                  >
                    <span>{scanPenerima || "- Kosong -"}</span>
                    <ChevronDownIcon className="w-4 h-4 text-gray-500 ml-2" />
                  </div>
                  {penerimaDropdownOpen && (
                    <div className="absolute z-[100] top-full left-0 w-48 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto thin-scrollbar">
                      <div className="px-4 py-2 hover:bg-gray-50 cursor-pointer text-sm text-gray-500 italic border-b border-gray-100" onClick={() => { setScanPenerima(""); setPenerimaDropdownOpen(false); }}>
                        - Kosong -
                      </div>
                      {penerimaList.map(p => (
                        <div key={p} className="flex justify-between items-center px-4 py-2 hover:bg-gray-50 cursor-pointer group" onClick={() => { setScanPenerima(p); setPenerimaDropdownOpen(false); }}>
                          <span className="text-sm text-gray-700">{p}</span>
                          <div className="flex space-x-1">
                            <button onClick={(e) => { e.stopPropagation(); setListModal({ isOpen: true, mode: 'edit', type: 'penerima', oldName: p, newName: p }); setPenerimaDropdownOpen(false); }} className="text-blue-500 hover:bg-blue-100 p-1 rounded transition-colors" title="Edit"><PencilIcon className="w-3.5 h-3.5" /></button>
                            <button onClick={(e) => { e.stopPropagation(); setListModal({ isOpen: true, mode: 'delete', type: 'penerima', oldName: p, newName: "" }); setPenerimaDropdownOpen(false); }} className="text-red-500 hover:bg-red-100 p-1 rounded transition-colors" title="Hapus"><TrashIcon className="w-3.5 h-3.5" /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <button onClick={() => setListModal({ isOpen: true, mode: 'add', type: 'penerima', oldName: "", newName: "" })} disabled={activeSheet === sheets[0] ? scanCategory === sheets[1] : activeSheet === sheets[1]} className="bg-white text-blue-600 hover:bg-blue-50 border border-blue-200 px-2 rounded-md flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed" title="Tambah Penerima Baru"><PlusIcon className="w-4 h-4" /></button>
              </div>

              <input 
                type="text" ref={directInputRef} value={directBarcode} onChange={(e) => setDirectBarcode(e.target.value)} 
                onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }} onKeyUp={(e) => { if (e.key === "Enter") handleDirectScanSubmit(); }} 
                disabled={anyModalOpen} 
                className="flex-1 p-2 border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm min-w-[200px]" 
                placeholder="Tembak barcode langsung..." autoFocus 
              />
              <button onClick={handleDirectScanSubmit} disabled={anyModalOpen || directBarcode.trim() === ""} className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-md transition-colors shadow-sm shrink-0 text-sm">Scan</button>
            </div>
          )}

          <div className="flex-1 overflow-auto bg-white relative">
            <table ref={tableRef} className="w-max min-w-full text-left border-collapse table-fixed outline-none">
              <thead className="sticky top-0 shadow-sm z-10">
                <tr className="text-xs tracking-wider text-gray-600 bg-gray-50">
                  {currentLayout.map((col, idx) => {
                    const isMaster = activeSheet === sheets[0];
                    return (
                      <th key={col.id} style={{ width: col.width, minWidth: col.width, maxWidth: col.width }} className={`relative font-semibold select-none transition-colors ${thBorderClass}`} draggable={col.type === 'custom' && !isMaster} onDragStart={(e) => handleColDragStart(e, col.id)} onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleColDrop(e, col.id)}>
                        <div className="flex items-center justify-between w-full h-full px-2 py-3">
                          <div className="flex-1 min-w-0 pr-1">
                            {col.type === 'custom' && !isMaster ? (<input type="text" value={col.name} onChange={(e) => handleRenameColumn(col.id, e.target.value)} className="w-full bg-transparent border-none outline-none font-semibold text-gray-700 placeholder-gray-400 focus:bg-white focus:ring-1 focus:ring-blue-400 rounded px-1 -ml-1 uppercase text-center" placeholder="NAMA KOLOM"/>) : (<span className="uppercase block truncate text-center w-full">{col.name}</span>)}
                          </div>
                          <div className="flex items-center space-x-1 flex-shrink-0">
                            {col.type === 'custom' && !isMaster && (<button onClick={() => setDeleteColConfirm({ isOpen: true, colId: col.id, colName: col.name })} className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1 rounded transition-colors" title="Hapus Kolom Ini"><TrashIcon className="w-4 h-4" /></button>)}
                            {!isMaster && (<button onClick={() => handleAddColumn(idx)} className="text-blue-400 hover:text-blue-600 hover:bg-blue-50 p-1 rounded transition-colors" title="Tambah Kolom di Kanan"><PlusCircleIcon className="w-5 h-5" /></button>)}
                          </div>
                        </div>
                        {col.type === 'custom' && !isMaster && (<div className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-400 active:bg-blue-600 z-10 transition-colors" onMouseDown={(e) => { e.preventDefault(); setResizingCol({ id: col.id, startX: e.clientX, startWidth: col.width }); }}/>)}
                      </th>
                    );
                  })}
                  <th className={`p-4 font-bold text-center w-24 sticky right-0 bg-gray-50 z-20 ${thBorderClass}`}>AKSI</th>
                </tr>
              </thead>
              <tbody className={`text-sm ${isDraggingGrid ? 'select-none' : ''}`}>
                {displayedItems.length === 0 ? (
                  <tr><td colSpan={currentLayout.length + 1} className="p-16 text-center text-gray-400">Pencarian atau filter tidak menemukan data.</td></tr>
                ) : (
                  displayedItems.map((item, index) => {
                    const isReturned = item.waktu_dikembalikan !== null; const isMaster = activeSheet === sheets[0];
                    return (
                      <tr key={item.id} className="hover:bg-blue-50/40 transition-colors group">
                        {currentLayout.map((col, idx) => {
                          const isSelected = selection && index >= Math.min(selection.startR, selection.endR) && index <= Math.max(selection.startR, selection.endR) && idx >= Math.min(selection.startC, selection.endC) && idx <= Math.max(selection.startC, selection.endC);
                          const activeBg = isSelected ? "bg-blue-100/60 ring-1 ring-blue-500/50" : ""; let cellContent;
                          
                          if (col.id === 'no') { cellContent = <span id={`cell-${index}-${idx}`} tabIndex={0} onKeyDown={(e) => handleCellKeyDown(e as any, index, idx)} className="block outline-none text-center w-full font-medium text-gray-500">{index + 1}</span>; } 
                          else if (col.id === 'copro') { cellContent = (<input id={`cell-${index}-${idx}`} type="text" value={item.copro} onChange={(e) => handleCoproChange(item.id, e.target.value)} onKeyDown={(e) => handleCellKeyDown(e, index, idx)} onFocus={() => setSelection({ startR: index, startC: idx, endR: index, endC: idx })} className="w-full bg-transparent outline-none focus:ring-1 focus:ring-blue-400 rounded px-1 font-bold text-blue-800 text-center"/>); } 
                          else if (col.id === 'barcode_id') { cellContent = <span id={`cell-${index}-${idx}`} tabIndex={0} onKeyDown={(e) => handleCellKeyDown(e as any, index, idx)} className="block outline-none text-center w-full font-bold text-gray-900">{item.barcode_id}</span>; } 
                          else if (col.id === 'waktu_diterima') { cellContent = <span id={`cell-${index}-${idx}`} tabIndex={0} onKeyDown={(e) => handleCellKeyDown(e as any, index, idx)} className="block text-gray-600 outline-none text-center w-full">{item.waktu_diterima}</span>; } 
                          
                          else if (col.id === 'nama_penerima') { 
                            if (item.kategori === sheets[1]) {
                              cellContent = <span id={`cell-${index}-${idx}`} className="block text-gray-400 outline-none text-center w-full font-bold">-</span>;
                            } else {
                              cellContent = (
                                <select 
                                  id={`cell-${index}-${idx}`} value={item.nama_penerima || ""} 
                                  onChange={(e) => handleChangePenerima(item.id, e.target.value)} 
                                  onKeyDown={(e) => handleCellKeyDown(e, index, idx)} 
                                  onFocus={() => setSelection({ startR: index, startC: idx, endR: index, endC: idx })} 
                                  className="text-sm border border-transparent rounded focus:ring-blue-500 focus:border-blue-500 bg-transparent text-gray-700 py-1 px-1 outline-none w-full cursor-pointer hover:bg-white hover:border-gray-200 text-center"
                                >
                                  <option value="">- Kosong -</option>
                                  {penerimaList.map(p => <option key={p} value={p}>{p}</option>)}
                                  <option value="__ADD_NEW__" className="font-bold text-blue-600 bg-blue-50">+ Tambah Baru...</option>
                                </select>
                              );
                            }
                          } 
                          
                          else if (col.id === 'waktu_dikembalikan') { 
                            if (item.kategori === sheets[1]) {
                              cellContent = <span id={`cell-${index}-${idx}`} className="block text-gray-400 outline-none text-center w-full font-bold">-</span>;
                            } else {
                              cellContent = <span id={`cell-${index}-${idx}`} tabIndex={0} onKeyDown={(e) => handleCellKeyDown(e as any, index, idx)} className="block text-gray-600 outline-none text-center w-full">{item.waktu_dikembalikan || "-"}</span>; 
                            }
                          } 
                          else if (col.id === 'status_drawing') { 
                            cellContent = (
                              <div className="flex justify-center w-full" id={`cell-${index}-${idx}`} tabIndex={0} onKeyDown={(e) => handleCellKeyDown(e as any, index, idx)}>
                                {item.kategori === sheets[1] ? (
                                  <span className="text-gray-400 font-bold">-</span>
                                ) : isReturned ? (
                                  <span className="px-3 py-1.5 bg-green-100 text-green-700 rounded-md text-xs font-bold border border-green-200 inline-flex items-center"><CheckCircleIcon className="w-4 h-4 mr-1"/> SUDAH DIKEMBALIKAN</span>
                                ) : (
                                  <span className="px-3 py-1.5 bg-yellow-100 text-yellow-700 rounded-md text-xs font-bold border border-yellow-200">BELUM DIKEMBALIKAN</span>
                                )}
                              </div>
                            ); 
                          } 
                          
                          else if (col.id === 'kategori') { 
                            cellContent = (
                              <select 
                                id={`cell-${index}-${idx}`} value={item.kategori} 
                                onChange={(e) => handleCategoryChange(item.id, e.target.value)} 
                                onKeyDown={(e) => handleCellKeyDown(e, index, idx)} 
                                onFocus={() => setSelection({ startR: index, startC: idx, endR: index, endC: idx })} 
                                className="text-xs border border-transparent rounded focus:ring-blue-500 focus:border-blue-500 bg-gray-100 text-gray-700 py-1 px-1 outline-none w-full cursor-pointer hover:bg-white hover:border-gray-200 text-center font-medium"
                              >
                                {sheets.filter(s => s !== sheets[0]).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                              </select>
                            );
                          } 
                          
                          else {
                            const itemLayout = sheetLayouts[item.kategori] || []; const actualCol = itemLayout.find(c => c.name.toLowerCase() === col.name.toLowerCase());
                            if (isMaster && !actualCol) return <td key={col.id} style={{ width: col.width, minWidth: col.width, maxWidth: col.width }} className={`p-3 align-top bg-gray-50/50 ${tdBorderClass}`}><div className="w-full h-full bg-stripes opacity-10 rounded"></div></td>;
                            cellContent = (<div className="grid w-full min-w-0"><div className="invisible col-start-1 row-start-1 px-2 py-1.5 whitespace-pre-wrap break-all min-h-[36px] font-sans text-sm pointer-events-none w-full overflow-hidden">{actualCol ? (item.custom_data?.[actualCol.id] || ' ') : ' '}{'\u200b'}</div><textarea id={`cell-${index}-${idx}`} value={actualCol ? (item.custom_data?.[actualCol.id] || '') : ''} onChange={(e) => handleCustomDataChange(item.id, col.name, e.target.value)} onKeyDown={(e) => handleCellKeyDown(e, index, idx)} onFocus={() => setSelection({ startR: index, startC: idx, endR: index, endC: idx })} className="col-start-1 row-start-1 w-full h-full bg-transparent outline-none focus:bg-white focus:ring-1 focus:ring-blue-400 px-2 py-1.5 rounded transition-all text-gray-700 resize-none overflow-hidden font-sans text-sm break-all text-center" placeholder="Ketik..." rows={1}/></div>);
                          }
                          return (<td key={col.id} style={{ width: col.width, minWidth: col.width, maxWidth: col.width }} className={`p-3 align-middle transition-colors ${tdBorderClass} ${activeBg}`} onMouseDown={() => { setIsDraggingGrid(true); setSelection({ startR: index, startC: idx, endR: index, endC: idx }); }} onMouseEnter={() => { if (isDraggingGrid) setSelection(prev => prev ? { ...prev, endR: index, endC: idx } : null); }}>{cellContent}</td>);
                        })}
                        <td className={`p-3 text-center align-middle sticky right-0 bg-white group-hover:bg-blue-50/10 transition-colors ${tdBorderClass}`}>
                          <button onClick={() => setDeleteConfirm({ isOpen: true, itemId: item.id, barcodeId: item.barcode_id })} className="p-2 text-red-500 hover:text-red-700 hover:bg-red-100 rounded-lg transition-colors"><TrashIcon className="w-5 h-5"/></button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* TAB MASTER */}
        <div className="bg-gray-100 border border-t-0 border-gray-200 rounded-b-xl flex items-center px-2 min-h-12 shrink-0 shadow-sm z-20 pb-1 pt-1 overflow-x-auto">
          {sheets.map((sheet, index) => {
            const isActive = activeSheet === sheet; const isEditing = editingSheet === sheet;
            return (
              <div key={index} className={`relative flex items-center px-4 py-2 mx-1 text-sm font-bold transition-colors cursor-pointer border-b-2 rounded-t-md ${isActive ? "border-blue-600 text-blue-700 bg-white shadow-sm" : "border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-200"}`} onClick={() => { if (!isEditing) setActiveSheet(sheet); }} onDoubleClick={() => handleRenameStart(sheet)}>
                {isEditing ? (<input type="text" autoFocus value={editSheetName} onChange={(e) => setEditSheetName(e.target.value)} onBlur={() => handleRenameSubmit(sheet)} onKeyDown={(e) => e.key === 'Enter' && handleRenameSubmit(sheet)} className="bg-blue-50 text-blue-900 px-1 py-0.5 outline-none rounded w-32 focus:ring-1 focus:ring-blue-500 text-center" />) : (<span className="select-none">{sheet}</span>)}
              </div>
            );
          })}
        </div>
      </div>

      <Modal isOpen={deleteConfirm.isOpen} title="Hapus Barcode?" type="danger" icon="trash" onClose={() => setDeleteConfirm({ isOpen: false, itemId: null, barcodeId: "" })} onConfirm={confirmDeleteRowAction} description={<>Yakin menghapus barcode <span className="font-semibold text-red-700">"{deleteConfirm.barcodeId}"</span>?</>}>
        <button onClick={() => setDeleteConfirm({ isOpen: false, itemId: null, barcodeId: "" })} className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg">Batal (Esc)</button>
        <button onClick={confirmDeleteRowAction} className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg flex items-center"><TrashIcon className="w-4 h-4 mr-1.5" /> Hapus (Enter)</button>
      </Modal>

      <Modal isOpen={deleteColConfirm.isOpen} title="Hapus Kolom Kustom?" type="danger" icon="trash" onClose={() => setDeleteColConfirm({ isOpen: false, colId: "", colName: "" })} onConfirm={confirmDeleteColumnAction} description={<>Yakin menghapus kolom <span className="font-semibold text-red-700">"{deleteColConfirm.colName}"</span>? Data di dalam kolom ini akan ikut hilang.</>}>
        <button onClick={() => setDeleteColConfirm({ isOpen: false, colId: "", colName: "" })} className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg">Batal (Esc)</button>
        <button onClick={confirmDeleteColumnAction} className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg flex items-center"><TrashIcon className="w-4 h-4 mr-1.5" /> Hapus Kolom (Enter)</button>
      </Modal>

      <Modal isOpen={resetConfirmOpen} title={activeSheet === sheets[0] ? "Reset Semua Data?" : `Kosongkan Tab ${activeSheet}?`} type="severe" icon="reset" onClose={() => setResetConfirmOpen(false)} onConfirm={confirmResetDataAction} description={<>Yakin 100% menghapus <span className="font-semibold text-gray-800">{displayedItems.length}</span> data dari tampilan ini?</>}>
        <button onClick={() => setResetConfirmOpen(false)} className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg">Batal</button>
        <button onClick={confirmResetDataAction} className="px-5 py-2 bg-red-700 hover:bg-red-800 text-white text-sm font-medium rounded-lg flex items-center"><ArrowPathIcon className="w-4 h-4 mr-1.5" /> Bersihkan</button>
      </Modal>

      <Modal isOpen={alertModal.isOpen} title={alertModal.title} type="warning" icon="warning" onClose={() => setAlertModal({ isOpen: false, title: "", message: "" })} onConfirm={() => setAlertModal({ isOpen: false, title: "", message: "" })} description={alertModal.message}>
        <button onClick={() => setAlertModal({ isOpen: false, title: "", message: "" })} className="px-5 py-2 bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-medium rounded-lg">Mengerti</button>
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
    </>
  );
}