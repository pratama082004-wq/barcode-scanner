"use client";

import { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import { 
  TrashIcon, ArrowPathIcon, ArrowUturnLeftIcon, ArrowUturnRightIcon, 
  PlusIcon, ChevronDownIcon, DocumentDuplicateIcon, PencilIcon, 
  ChevronLeftIcon, ChevronRightIcon, PlusCircleIcon, Squares2X2Icon 
} from "@heroicons/react/24/outline";
import Modal from "./ui/Modal"; 

type ScanItem = { 
  id: string; 
  barcode_id: string; 
  created_at: string; 
  category?: string; 
  custom_data?: Record<string, string>; 
};

type ColumnDef = {
  id: string;
  name: string;
  type: 'base' | 'custom';
  width: number;
};

const BASE_COLUMNS: ColumnDef[] = [
  { id: 'no', name: 'NO', type: 'base', width: 60 },
  { id: 'barcode_id', name: 'ID BARCODE', type: 'base', width: 220 },
  { id: 'created_at', name: 'WAKTU SCAN', type: 'base', width: 200 }
];

export default function ScanLog() {
  const [scannedItems, setScannedItems] = useState<ScanItem[]>([]);
  const [isMounted, setIsMounted] = useState<boolean>(false);
  
  const [sheets, setSheets] = useState<string[]>(["All Data"]);
  const [activeSheet, setActiveSheet] = useState<string>("All Data");
  const [showNewSheetModal, setShowNewSheetModal] = useState(false);
  const [newSheetName, setNewSheetName] = useState("");

  const [sheetLayouts, setSheetLayouts] = useState<Record<string, ColumnDef[]>>({});

  const [menuOpenFor, setMenuOpenFor] = useState<string | null>(null);
  const [editingSheet, setEditingSheet] = useState<string | null>(null);
  const [editSheetName, setEditSheetName] = useState("");
  const [draggedSheet, setDraggedSheet] = useState<string | null>(null);
  
  const [viewGrid, setViewGrid] = useState<boolean>(false);
  const [resizingCol, setResizingCol] = useState<{ id: string, startX: number, startWidth: number } | null>(null);
  const [draggedColId, setDraggedColId] = useState<string | null>(null);

  const [pastStates, setPastStates] = useState<ScanItem[][]>([]);
  const [futureStates, setFutureStates] = useState<ScanItem[][]>([]);

  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, itemId: null as string | null, barcodeId: "" });
  const [resetConfirmOpen, setResetConfirmOpen] = useState<boolean>(false);
  const [alertModal, setAlertModal] = useState({ isOpen: false, title: "", message: "" });
  const [deleteColConfirm, setDeleteColConfirm] = useState({ isOpen: false, colId: "", colName: "" });
  const [deleteSheetConfirm, setDeleteSheetConfirm] = useState({ isOpen: false, sheetName: "" });

  const anyModalOpen = deleteConfirm.isOpen || resetConfirmOpen || alertModal.isOpen || showNewSheetModal || editingSheet !== null || deleteColConfirm.isOpen || deleteSheetConfirm.isOpen;
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMounted(true);
    const savedData = localStorage.getItem("winteq_scanner_data");
    const savedSheets = localStorage.getItem("winteq_scanner_sheets");
    const savedLayouts = localStorage.getItem("winteq_scanner_layouts");
    if (savedData) setScannedItems(JSON.parse(savedData));
    if (savedSheets) setSheets(JSON.parse(savedSheets));
    if (savedLayouts) setSheetLayouts(JSON.parse(savedLayouts));
  }, []);

  useEffect(() => {
    if (isMounted) {
      localStorage.setItem("winteq_scanner_data", JSON.stringify(scannedItems));
      localStorage.setItem("winteq_scanner_sheets", JSON.stringify(sheets));
      localStorage.setItem("winteq_scanner_layouts", JSON.stringify(sheetLayouts));
    }
  }, [scannedItems, sheets, sheetLayouts, isMounted]);

  const currentLayout = activeSheet === "All Data"
    ? [...BASE_COLUMNS, { id: 'category', name: 'KATEGORI', type: 'base', width: 200 }]
    : (sheetLayouts[activeSheet] || BASE_COLUMNS);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpenFor(null); };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const displayedItems = activeSheet === "All Data" ? scannedItems : scannedItems.filter(item => (item.category || "Default") === activeSheet);

  useEffect(() => {
    if (!resizingCol) return;
    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(80, resizingCol.startWidth + (e.clientX - resizingCol.startX));
      setSheetLayouts(prev => {
        const layout = [...(prev[activeSheet] || BASE_COLUMNS)];
        const idx = layout.findIndex(c => c.id === resizingCol.id);
        if (idx > -1) { layout[idx] = { ...layout[idx], width: newWidth }; return { ...prev, [activeSheet]: layout }; }
        return prev;
      });
    };
    const handleMouseUp = () => setResizingCol(null);
    window.addEventListener('mousemove', handleMouseMove); window.addEventListener('mouseup', handleMouseUp);
    return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
  }, [resizingCol, activeSheet]);

  const saveHistory = () => { setPastStates((prev) => [...prev.slice(-19), scannedItems]); setFutureStates([]); };
  const handleUndo = () => { if (pastStates.length === 0) return; const previousState = pastStates[pastStates.length - 1]; setPastStates((prev) => prev.slice(0, -1)); setFutureStates((prev) => [...prev, scannedItems]); setScannedItems(previousState); };
  const handleRedo = () => { if (futureStates.length === 0) return; const nextState = futureStates[futureStates.length - 1]; setFutureStates((prev) => prev.slice(0, -1)); setPastStates((prev) => [...prev, scannedItems]); setScannedItems(nextState); };

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (anyModalOpen) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); handleUndo(); } 
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); handleRedo(); }
    };
    window.addEventListener('keydown', handleGlobalKeyDown); return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [pastStates, futureStates, scannedItems, anyModalOpen]);

  const handleCellKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>, rIdx: number, cIdx: number) => {
    if (e.key === "Enter" && e.shiftKey) return;

    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter"].includes(e.key)) {
      let nextR = rIdx; let nextC = cIdx; let shouldMove = false;

      if (e.key === "ArrowUp") { nextR--; shouldMove = true; } 
      else if (e.key === "ArrowDown" || e.key === "Enter") { nextR++; shouldMove = true; } 
      else if (e.key === "ArrowLeft" && e.currentTarget.selectionStart === 0) { nextC--; shouldMove = true; } 
      else if (e.key === "ArrowRight" && e.currentTarget.selectionEnd === e.currentTarget.value.length) { nextC++; shouldMove = true; }

      if (shouldMove) {
        let targetElement: HTMLElement | null = null;
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
          let tempC = nextC;
          while(tempC >= 0 && tempC < currentLayout.length) {
            targetElement = document.getElementById(`cell-${nextR}-${tempC}`);
            if (targetElement) break;
            e.key === "ArrowLeft" ? tempC-- : tempC++;
          }
        } else {
          targetElement = document.getElementById(`cell-${nextR}-${nextC}`);
        }

        if (targetElement) { e.preventDefault(); (targetElement as HTMLInputElement).focus(); }
      }
    }
  };

  const handleAddColumn = (insertAfterIndex: number) => {
    const newCol: ColumnDef = { id: `custom_${Date.now()}`, name: 'KOLOM BARU', type: 'custom', width: 180 };
    const layout = [...(sheetLayouts[activeSheet] || BASE_COLUMNS)];
    layout.splice(insertAfterIndex + 1, 0, newCol);
    setSheetLayouts({ ...sheetLayouts, [activeSheet]: layout });
  };

  const handleRenameColumn = (colId: string, newName: string) => {
    setSheetLayouts(prev => {
      const layout = [...(prev[activeSheet] || BASE_COLUMNS)];
      const idx = layout.findIndex(c => c.id === colId);
      if (idx > -1) { layout[idx] = { ...layout[idx], name: newName }; return { ...prev, [activeSheet]: layout }; }
      return prev;
    });
  };

  const confirmDeleteColumnAction = () => {
    if (!deleteColConfirm.colId) return;
    saveHistory();
    setSheetLayouts(prev => {
      const layout = [...(prev[activeSheet] || BASE_COLUMNS)];
      const newLayout = layout.filter(c => c.id !== deleteColConfirm.colId);
      return { ...prev, [activeSheet]: newLayout };
    });
    setDeleteColConfirm({ isOpen: false, colId: "", colName: "" });
  };

  const handleCustomDataChange = (itemId: string, colId: string, value: string) => {
    saveHistory();
    setScannedItems(prev => prev.map(item => 
      item.id === itemId ? { ...item, custom_data: { ...(item.custom_data || {}), [colId]: value } } : item
    ));
  };

  const handleColDragStart = (e: React.DragEvent, colId: string) => { setDraggedColId(colId); e.dataTransfer.effectAllowed = 'move'; };
  const handleColDrop = (e: React.DragEvent, targetColId: string) => {
    e.preventDefault();
    if (!draggedColId || draggedColId === targetColId) return;
    const layout = [...(sheetLayouts[activeSheet] || BASE_COLUMNS)];
    const fromIdx = layout.findIndex(c => c.id === draggedColId);
    const toIdx = layout.findIndex(c => c.id === targetColId);
    if (layout[fromIdx].type !== 'custom') return; 
    const [moved] = layout.splice(fromIdx, 1);
    layout.splice(toIdx, 0, moved);
    setSheetLayouts({ ...sheetLayouts, [activeSheet]: layout });
    setDraggedColId(null);
  };

  const handleRenameStart = (sheet: string) => { setEditSheetName(sheet); setEditingSheet(sheet); setMenuOpenFor(null); };
  
  const handleRenameSubmit = (oldName: string) => {
    const newName = editSheetName.trim();
    if (!newName || newName === oldName || newName === "All Data") return setEditingSheet(null);
    if (sheets.includes(newName)) { 
      setAlertModal({ isOpen: true, title: "Nama Tidak Valid", message: `Nama sheet "${newName}" sudah digunakan!` });
      setEditingSheet(null); return; 
    }
    saveHistory();
    setSheets(sheets.map(s => s === oldName ? newName : s));
    setScannedItems(scannedItems.map(i => i.category === oldName ? { ...i, category: newName } : i));
    
    const newLayouts = { ...sheetLayouts };
    if(newLayouts[oldName]) { newLayouts[newName] = newLayouts[oldName]; delete newLayouts[oldName]; }
    setSheetLayouts(newLayouts);

    if (activeSheet === oldName) setActiveSheet(newName);
    setEditingSheet(null);
  };

  const requestDeleteSheet = (sheetToDelete: string) => { setDeleteSheetConfirm({ isOpen: true, sheetName: sheetToDelete }); setMenuOpenFor(null); };

  const confirmDeleteSheetAction = () => {
    const sheetToDelete = deleteSheetConfirm.sheetName;
    if (!sheetToDelete) return;
    saveHistory();
    setSheets(sheets.filter(s => s !== sheetToDelete));
    setScannedItems(scannedItems.filter(i => i.category !== sheetToDelete));
    
    const newLayouts = { ...sheetLayouts };
    delete newLayouts[sheetToDelete];
    setSheetLayouts(newLayouts);

    if (activeSheet === sheetToDelete) setActiveSheet("All Data");
    setDeleteSheetConfirm({ isOpen: false, sheetName: "" });
  };

  const handleDuplicateSheet = (sheetToDup: string) => {
    saveHistory();
    let newName = `${sheetToDup} (Copy)`; let counter = 1;
    while (sheets.includes(newName)) { counter++; newName = `${sheetToDup} (Copy ${counter})`; }
    setSheets([...sheets, newName]);
    setSheetLayouts({...sheetLayouts, [newName]: sheetLayouts[sheetToDup] || BASE_COLUMNS});
    const itemsToCopy = scannedItems.filter(i => i.category === sheetToDup);
    const duplicatedItems = itemsToCopy.map(i => ({ ...i, id: crypto.randomUUID(), category: newName }));
    setScannedItems([...scannedItems, ...duplicatedItems]);
    setActiveSheet(newName); setMenuOpenFor(null);
  };
  
  const handleMoveSheet = (sheet: string, direction: 'left' | 'right') => {
    const idx = sheets.indexOf(sheet);
    if ((direction === 'left' && idx <= 1) || (direction === 'right' && idx === sheets.length - 1)) return;
    const newSheets = [...sheets]; const swapIdx = direction === 'left' ? idx - 1 : idx + 1;
    [newSheets[idx], newSheets[swapIdx]] = [newSheets[swapIdx], newSheets[idx]];
    setSheets(newSheets); setMenuOpenFor(null);
  };
  const handleDragStart = (e: React.DragEvent, sheet: string) => { setDraggedSheet(sheet); e.dataTransfer.effectAllowed = 'move'; };
  const handleDrop = (e: React.DragEvent, targetSheet: string) => {
    e.preventDefault(); if (!draggedSheet || draggedSheet === targetSheet || targetSheet === "All Data") return;
    const newSheets = [...sheets]; const draggedIdx = newSheets.indexOf(draggedSheet); const targetIdx = newSheets.indexOf(targetSheet);
    newSheets.splice(draggedIdx, 1); newSheets.splice(targetIdx, 0, draggedSheet);
    setSheets(newSheets); setDraggedSheet(null);
  };

  const handleCategoryChange = (id: string, newCategory: string) => { saveHistory(); setScannedItems(prev => prev.map(item => item.id === id ? { ...item, category: newCategory } : item)); };
  const confirmDeleteRowAction = () => { if (deleteConfirm.itemId) { saveHistory(); setScannedItems((prev) => prev.filter((item) => item.id !== deleteConfirm.itemId)); } setDeleteConfirm({ isOpen: false, itemId: null, barcodeId: "" }); };
  const confirmResetDataAction = () => { saveHistory(); if (activeSheet === "All Data") setScannedItems([]); else setScannedItems((prev) => prev.filter(item => (item.category || "Default") !== activeSheet)); setResetConfirmOpen(false); };
  
  const exportToExcelWithAlert = () => {
    if (displayedItems.length === 0) return setAlertModal({ isOpen: true, title: "Data Kosong", message: "Belum ada data pindaian barcode di sheet ini." });
    
    const worksheetData = displayedItems.map((item, i) => {
      const row: any = {};
      currentLayout.forEach(col => {
        if (col.id === 'no') row[col.name] = i + 1;
        else if (col.id === 'barcode_id') row[col.name] = item.barcode_id;
        else if (col.id === 'created_at') row[col.name] = item.created_at;
        else if (col.id === 'category') row[col.name] = item.category || 'Default';
        else row[col.name] = item.custom_data?.[col.id] || "";
      });
      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, activeSheet.substring(0, 31)); 
    XLSX.writeFile(workbook, `Laporan_Winteq_${activeSheet.replace(/\s+/g, '_')}.xlsx`);
  };

  const handleCreateNewSheet = () => {
    const sheetName = newSheetName.trim();
    if (sheetName && !sheets.includes(sheetName) && sheetName !== "Default") { setSheets([...sheets, sheetName]); setActiveSheet(sheetName); }
    setShowNewSheetModal(false); setNewSheetName("");
  };

  if (!isMounted) return null;

  const thBorderClass = viewGrid ? "border border-gray-300 bg-gray-100" : "border-b border-gray-200 bg-white";
  const tdBorderClass = viewGrid ? "border border-gray-300" : "border-b border-gray-100";

  return (
    <>
      <Modal isOpen={deleteConfirm.isOpen} title="Hapus Barcode?" type="danger" icon="trash" onClose={() => setDeleteConfirm({ isOpen: false, itemId: null, barcodeId: "" })} onConfirm={confirmDeleteRowAction} description={<>Yakin menghapus barcode <span className="font-semibold text-red-700">"{deleteConfirm.barcodeId}"</span>?</>}>
        <button onClick={() => setDeleteConfirm({ isOpen: false, itemId: null, barcodeId: "" })} className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg">Batal (Esc)</button>
        <button onClick={confirmDeleteRowAction} className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg flex items-center"><TrashIcon className="w-4 h-4 mr-1.5" /> Hapus (Enter)</button>
      </Modal>

      <Modal isOpen={deleteColConfirm.isOpen} title="Hapus Kolom Kustom?" type="danger" icon="trash" onClose={() => setDeleteColConfirm({ isOpen: false, colId: "", colName: "" })} onConfirm={confirmDeleteColumnAction} description={<>Yakin menghapus kolom <span className="font-semibold text-red-700">"{deleteColConfirm.colName}"</span>? Data di dalam kolom ini akan ikut hilang.</>}>
        <button onClick={() => setDeleteColConfirm({ isOpen: false, colId: "", colName: "" })} className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg">Batal (Esc)</button>
        <button onClick={confirmDeleteColumnAction} className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg flex items-center"><TrashIcon className="w-4 h-4 mr-1.5" /> Hapus Kolom (Enter)</button>
      </Modal>

      <Modal isOpen={deleteSheetConfirm.isOpen} title="Hapus Kategori Sheet?" type="danger" icon="trash" onClose={() => setDeleteSheetConfirm({ isOpen: false, sheetName: "" })} onConfirm={confirmDeleteSheetAction} description={<>Yakin menghapus sheet kategori <span className="font-semibold text-red-700">"{deleteSheetConfirm.sheetName}"</span> dan <span className="font-bold">SEMUA datanya</span> secara permanen?</>}>
        <button onClick={() => setDeleteSheetConfirm({ isOpen: false, sheetName: "" })} className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg">Batal (Esc)</button>
        <button onClick={confirmDeleteSheetAction} className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg flex items-center"><TrashIcon className="w-4 h-4 mr-1.5" /> Hapus Sheet (Enter)</button>
      </Modal>

      <Modal isOpen={resetConfirmOpen} title={activeSheet === "All Data" ? "Reset Semua Data?" : `Kosongkan Sheet ${activeSheet}?`} type="severe" icon="reset" onClose={() => setResetConfirmOpen(false)} onConfirm={confirmResetDataAction} description={<>Yakin 100% menghapus <span className="font-semibold text-gray-800">{displayedItems.length}</span> data dari tampilan ini?</>}>
        <button onClick={() => setResetConfirmOpen(false)} className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg">Batal (Esc)</button>
        <button onClick={confirmResetDataAction} className="px-5 py-2 bg-red-700 hover:bg-red-800 text-white text-sm font-medium rounded-lg flex items-center"><ArrowPathIcon className="w-4 h-4 mr-1.5" /> Bersihkan (Enter)</button>
      </Modal>

      <Modal isOpen={alertModal.isOpen} title={alertModal.title} type="warning" icon="warning" onClose={() => setAlertModal({ isOpen: false, title: "", message: "" })} onConfirm={() => setAlertModal({ isOpen: false, title: "", message: "" })} description={alertModal.message}>
        <button onClick={() => setAlertModal({ isOpen: false, title: "", message: "" })} className="px-5 py-2 bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-medium rounded-lg">Mengerti (Enter/Esc)</button>
      </Modal>

      <Modal isOpen={showNewSheetModal} title="Buat Kategori Kertas Baru" type="warning" icon="warning" onClose={() => setShowNewSheetModal(false)} onConfirm={handleCreateNewSheet} 
        description={
          <div className="pt-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">Nama Kategori (Contoh: Drawing Part Motor)</label>
            <input type="text" value={newSheetName} onChange={(e) => setNewSheetName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCreateNewSheet()} className="w-full p-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 transition-all text-gray-800" placeholder="Masukkan nama kategori..." autoFocus />
          </div>
        }>
        <button onClick={() => setShowNewSheetModal(false)} className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg">Batal</button>
        <button onClick={handleCreateNewSheet} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg flex items-center"><PlusIcon className="w-4 h-4 mr-1.5" /> Buat Sheet</button>
      </Modal>

      <div className="w-full h-[calc(100vh-8rem)] flex flex-col">
        <div className="bg-white rounded-t-xl shadow-sm border border-gray-100 flex-1 flex flex-col min-h-0 overflow-hidden">
          
          <div className="p-4 sm:p-5 border-b border-gray-100 flex flex-col xl:flex-row justify-between items-start xl:items-center bg-gray-50/50 gap-4 xl:gap-0 shrink-0">
            <div className="flex items-center space-x-4">
              <h3 className="font-bold text-gray-800 text-lg">{activeSheet === "All Data" ? "Semua Data Pindaian" : `Kategori: ${activeSheet}`}</h3>
              <div className="bg-blue-100 text-blue-800 text-sm font-bold px-3 py-1.5 rounded-md border border-blue-200 shadow-sm flex items-center">
                Total: <span className="ml-1 text-blue-900">{displayedItems.length}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button 
                onClick={() => setViewGrid(!viewGrid)} 
                className={`p-2 mr-2 rounded-lg transition-colors flex items-center shadow-sm ${viewGrid ? 'bg-blue-100 text-blue-700 border border-blue-200' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`} 
                title="Toggle View Grid"
              >
                <Squares2X2Icon className="w-4 h-4 md:mr-1.5" />
                <span className="text-sm font-medium hidden md:inline">View Grid</span>
              </button>

              <div className="flex bg-gray-100 rounded-lg p-1 border border-gray-200 mr-2">
                <button onClick={handleUndo} disabled={pastStates.length === 0} className={`p-1.5 rounded-md flex items-center transition-all ${pastStates.length > 0 ? "bg-white text-gray-700 shadow-sm hover:text-blue-600" : "text-gray-400 cursor-not-allowed opacity-60"}`} title="Undo (Ctrl+Z)"><ArrowUturnLeftIcon className="w-4 h-4" /></button>
                <button onClick={handleRedo} disabled={futureStates.length === 0} className={`p-1.5 rounded-md flex items-center transition-all ml-1 ${futureStates.length > 0 ? "bg-white text-gray-700 shadow-sm hover:text-blue-600" : "text-gray-400 cursor-not-allowed opacity-60"}`} title="Redo (Ctrl+Y)"><ArrowUturnRightIcon className="w-4 h-4" /></button>
              </div>

              <button onClick={exportToExcelWithAlert} className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium py-2 px-4 rounded-lg shadow-sm">Unduh Excel</button>
              {displayedItems.length > 0 && <button onClick={() => setResetConfirmOpen(true)} className="bg-red-50 hover:bg-red-100 text-red-600 text-sm font-medium py-2 px-4 rounded-lg border border-red-200">{activeSheet === "All Data" ? "Reset Semua" : "Kosongkan Sheet"}</button>}
            </div>
          </div>
          
          <div className="flex-1 overflow-auto bg-white relative">
            <table className="w-max min-w-full text-left border-collapse table-fixed">
              <thead className="sticky top-0 shadow-sm z-10">
                <tr className="text-xs tracking-wider text-gray-600">
                  
                  {currentLayout.map((col, idx) => (
                    <th 
                      key={col.id} 
                      /* KUNCI GANDA: Lebar dipaksa mutlak dan tidak bisa ditawar! */
                      style={{ width: col.width, minWidth: col.width, maxWidth: col.width }} 
                      className={`relative font-semibold select-none transition-colors ${thBorderClass}`}
                      draggable={col.type === 'custom'}
                      onDragStart={(e) => handleColDragStart(e, col.id)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => handleColDrop(e, col.id)}
                    >
                      <div className="flex items-center justify-between w-full h-full px-3 py-3 pr-4">
                        <div className="flex-1 min-w-0 pr-2">
                          {col.type === 'custom' ? (
                            <input 
                              type="text"
                              value={col.name} 
                              onChange={(e) => handleRenameColumn(col.id, e.target.value)} 
                              className="w-full bg-transparent border-none outline-none font-semibold text-gray-700 placeholder-gray-400 focus:bg-white focus:ring-1 focus:ring-blue-400 rounded px-1 -ml-1 uppercase"
                              placeholder="NAMA KOLOM"
                            />
                          ) : (
                            <span className="uppercase block truncate">{col.name}</span>
                          )}
                        </div>
                        
                        <div className="flex items-center space-x-1 flex-shrink-0">
                          {col.type === 'custom' && (
                            <button 
                              onClick={() => setDeleteColConfirm({ isOpen: true, colId: col.id, colName: col.name })}
                              className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1 rounded transition-colors"
                              title="Hapus Kolom Ini"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          )}
                          {activeSheet !== "All Data" && (
                            <button 
                              onClick={() => handleAddColumn(idx)}
                              className="text-blue-400 hover:text-blue-600 hover:bg-blue-50 p-1 rounded transition-colors"
                              title="Tambah Kolom di Kanan"
                            >
                              <PlusCircleIcon className="w-5 h-5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {col.type === 'custom' && (
                        <div 
                          className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-400 active:bg-blue-600 z-10 transition-colors"
                          onMouseDown={(e) => { e.preventDefault(); setResizingCol({ id: col.id, startX: e.clientX, startWidth: col.width }); }}
                        />
                      )}
                    </th>
                  ))}
                  
                  <th className={`p-3 font-semibold w-20 text-center uppercase sticky right-0 bg-gray-50 z-20 ${thBorderClass}`}>Aksi</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {displayedItems.length === 0 ? (
                  <tr><td colSpan={currentLayout.length + 1} className="p-16 text-center text-gray-400">Belum ada data di sheet ini.</td></tr>
                ) : (
                  displayedItems.map((item, index) => (
                    <tr key={item.id} className="hover:bg-blue-50/40 transition-colors group">
                      {currentLayout.map((col, idx) => {
                        let cellContent;
                        if (col.id === 'no') cellContent = index + 1;
                        else if (col.id === 'barcode_id') cellContent = <span className="font-medium text-gray-900">{item.barcode_id}</span>;
                        else if (col.id === 'created_at') cellContent = <span className="text-gray-600">{item.created_at}</span>;
                        else if (col.id === 'category') {
                          cellContent = sheets.length === 1 
                            ? <span className="px-3 py-1 bg-gray-100 text-gray-500 rounded text-xs">Default</span>
                            : (
                              <select value={item.category || "Default"} onChange={(e) => handleCategoryChange(item.id, e.target.value)} className="text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-700 py-1 px-1 outline-none w-full cursor-pointer hover:bg-gray-50">
                                <option value="Default">Default</option>
                                {sheets.filter(s => s !== "All Data").map(sheet => <option key={sheet} value={sheet}>{sheet}</option>)}
                              </select>
                            );
                        } else {
                          // UPDATE: Div "Break-All" untuk mematahkan teks raksasa
                          cellContent = (
                            <div className="grid w-full min-w-0">
                              <div className="invisible col-start-1 row-start-1 px-2 py-1.5 whitespace-pre-wrap break-all min-h-[36px] font-sans text-sm pointer-events-none w-full overflow-hidden">
                                {item.custom_data?.[col.id] || ' '}
                                {'\u200b'}
                              </div>
                              <textarea 
                                id={`cell-${index}-${idx}`}
                                value={item.custom_data?.[col.id] || ''} 
                                onChange={(e) => handleCustomDataChange(item.id, col.id, e.target.value)}
                                onKeyDown={(e) => handleCellKeyDown(e, index, idx)}
                                className="col-start-1 row-start-1 w-full h-full bg-transparent outline-none focus:bg-white focus:ring-1 focus:ring-blue-400 px-2 py-1.5 rounded transition-all text-gray-700 resize-none overflow-hidden font-sans text-sm break-all"
                                placeholder="Ketik..."
                                rows={1}
                              />
                            </div>
                          );
                        }
                        return (
                          <td 
                            key={col.id} 
                            style={{ width: col.width, minWidth: col.width, maxWidth: col.width }} 
                            className={`p-3 align-top ${tdBorderClass}`}
                          >
                            {cellContent}
                          </td>
                        );
                      })}
                      <td className={`p-3 text-center align-top sticky right-0 bg-white group-hover:bg-blue-50/10 transition-colors ${tdBorderClass}`}>
                        <button onClick={() => setDeleteConfirm({ isOpen: true, itemId: item.id, barcodeId: item.barcode_id })} className="p-2 text-red-500 hover:text-red-700 hover:bg-red-100 rounded-lg transition-colors"><TrashIcon className="w-5 h-5"/></button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* FOOTER: GOOGLE SHEETS STYLE TABS DENGAN DRAG & DROP SERTA DROPDOWN */}
        <div className="bg-gray-100 border border-t-0 border-gray-200 rounded-b-xl flex flex-wrap items-center px-2 min-h-12 shrink-0 shadow-sm z-20 pb-1 pt-1 gap-y-1">
          <button onClick={() => setShowNewSheetModal(true)} className="p-1.5 text-gray-500 hover:bg-gray-300 hover:text-gray-800 rounded mr-2 transition-colors flex-shrink-0" title="Tambah Sheet Baru"><PlusIcon className="w-5 h-5" /></button>
          <div className="h-6 w-px bg-gray-300 mx-1 mr-2 flex-shrink-0"></div>
          
          {sheets.map((sheet, index) => {
            const isAllData = sheet === "All Data"; const isActive = activeSheet === sheet; const isEditing = editingSheet === sheet; const isMenuOpen = menuOpenFor === sheet;
            return (
              <div key={sheet} draggable={!isAllData && !isEditing} onDragStart={(e) => handleDragStart(e, sheet)} onDragOver={(e) => {e.preventDefault(); e.dataTransfer.dropEffect = 'move';}} onDrop={(e) => handleDrop(e, sheet)} onContextMenu={(e) => { if (isAllData) return; e.preventDefault(); setMenuOpenFor(isMenuOpen ? null : sheet); }} className={`relative group flex items-center px-3 py-2 mx-0.5 text-sm font-medium transition-colors cursor-pointer border-b-2 rounded-t-md ${isActive ? "border-blue-600 text-blue-700 bg-white shadow-sm" : "border-transparent text-gray-600 hover:bg-gray-200"} ${draggedSheet === sheet ? "opacity-50" : ""}`} onClick={() => { if (!isEditing) setActiveSheet(sheet); }} onDoubleClick={() => { if (!isAllData) handleRenameStart(sheet); }}>
                {isEditing ? <input type="text" autoFocus value={editSheetName} onChange={(e) => setEditSheetName(e.target.value)} onBlur={() => handleRenameSubmit(sheet)} onKeyDown={(e) => e.key === 'Enter' && handleRenameSubmit(sheet)} className="bg-blue-50 text-blue-900 px-1 py-0.5 outline-none rounded w-24 focus:ring-1 focus:ring-blue-500" /> : <span className="select-none">{sheet}</span>}
                
                {!isAllData && !isEditing && <button onClick={(e) => { e.stopPropagation(); setMenuOpenFor(isMenuOpen ? null : sheet); }} className={`ml-1.5 p-0.5 rounded-full hover:bg-gray-200 transition-opacity ${isActive || isMenuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}><ChevronDownIcon className="w-3.5 h-3.5" /></button>}
                {isMenuOpen && (
                  <div ref={menuRef} className="absolute bottom-full left-0 mb-1 w-44 bg-white rounded-lg shadow-xl border border-gray-200 py-1.5 z-50 overflow-hidden" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => requestDeleteSheet(sheet)} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center"><TrashIcon className="w-4 h-4 mr-2" /> Delete</button>
                    <button onClick={() => handleDuplicateSheet(sheet)} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"><DocumentDuplicateIcon className="w-4 h-4 mr-2" /> Duplicate</button>
                    <button onClick={() => handleRenameStart(sheet)} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"><PencilIcon className="w-4 h-4 mr-2" /> Rename</button>
                    <div className="h-px bg-gray-200 my-1"></div>
                    <button onClick={() => handleMoveSheet(sheet, 'left')} disabled={index <= 1} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"><ChevronLeftIcon className="w-4 h-4 mr-2" /> Move left</button>
                    <button onClick={() => handleMoveSheet(sheet, 'right')} disabled={index === sheets.length - 1} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"><ChevronRightIcon className="w-4 h-4 mr-2" /> Move right</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}