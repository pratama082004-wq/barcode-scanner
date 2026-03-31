"use client";

import { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx-js-style";
import { 
  TrashIcon, ArrowPathIcon, ArrowUturnLeftIcon, ArrowUturnRightIcon, 
  PlusIcon, ChevronDownIcon, DocumentDuplicateIcon, PencilIcon, 
  ChevronLeftIcon, ChevronRightIcon, PlusCircleIcon, Squares2X2Icon,
  DocumentArrowDownIcon, ArrowsUpDownIcon
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
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');

  const [resizingCol, setResizingCol] = useState<{ id: string, startX: number, startWidth: number } | null>(null);
  const [draggedColId, setDraggedColId] = useState<string | null>(null);

  const [selection, setSelection] = useState<{startR: number, startC: number, endR: number, endC: number} | null>(null);
  const [isDraggingGrid, setIsDraggingGrid] = useState<boolean>(false);

  const [exportMenuOpen, setExportMenuOpen] = useState<boolean>(false);
  const [selectedExportSheets, setSelectedExportSheets] = useState<string[]>([]);
  const [exportFormat, setExportFormat] = useState<'single' | 'multiple'>('single');

  const [pastStates, setPastStates] = useState<{items: ScanItem[], layouts: Record<string, ColumnDef[]>, sheetsList: string[]}[]>([]);
  const [futureStates, setFutureStates] = useState<{items: ScanItem[], layouts: Record<string, ColumnDef[]>, sheetsList: string[]}[]>([]);

  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, itemId: null as string | null, barcodeId: "" });
  const [resetConfirmOpen, setResetConfirmOpen] = useState<boolean>(false);
  const [alertModal, setAlertModal] = useState({ isOpen: false, title: "", message: "" });
  const [deleteColConfirm, setDeleteColConfirm] = useState({ isOpen: false, colId: "", colName: "" });
  const [deleteSheetConfirm, setDeleteSheetConfirm] = useState({ isOpen: false, sheetName: "" });

  const anyModalOpen = deleteConfirm.isOpen || resetConfirmOpen || alertModal.isOpen || showNewSheetModal || editingSheet !== null || deleteColConfirm.isOpen || deleteSheetConfirm.isOpen;
  
  const menuRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null); 

  useEffect(() => {
    setIsMounted(true);
    const savedData = localStorage.getItem("winteq_scanner_data");
    const savedSheets = localStorage.getItem("winteq_scanner_sheets");
    const savedLayouts = localStorage.getItem("winteq_scanner_layouts");
    
    // BACA MEMORI UI SETTINGS DARI LOCAL STORAGE
    const savedActiveSheet = localStorage.getItem("winteq_scanlog_activeSheet");
    const savedSortOrder = localStorage.getItem("winteq_scanlog_sortOrder");
    const savedViewGrid = localStorage.getItem("winteq_scanlog_viewGrid");

    if (savedData) setScannedItems(JSON.parse(savedData));
    if (savedSheets) {
      const parsedSheets = JSON.parse(savedSheets);
      setSheets(parsedSheets);
      setSelectedExportSheets(parsedSheets); 
      
      // Pastikan savedActiveSheet masih ada di daftar sheet, kalau dihapus balik ke All Data
      if (savedActiveSheet && parsedSheets.includes(savedActiveSheet)) {
        setActiveSheet(savedActiveSheet);
      }
    }
    if (savedLayouts) setSheetLayouts(JSON.parse(savedLayouts));
    
    if (savedSortOrder === 'newest' || savedSortOrder === 'oldest') setSortOrder(savedSortOrder);
    if (savedViewGrid) setViewGrid(savedViewGrid === 'true');
  }, []);

  useEffect(() => {
    if (isMounted) {
      localStorage.setItem("winteq_scanner_data", JSON.stringify(scannedItems));
      localStorage.setItem("winteq_scanner_sheets", JSON.stringify(sheets));
      localStorage.setItem("winteq_scanner_layouts", JSON.stringify(sheetLayouts));
      
      // SIMPAN MEMORI UI SETTINGS KE LOCAL STORAGE
      localStorage.setItem("winteq_scanlog_activeSheet", activeSheet);
      localStorage.setItem("winteq_scanlog_sortOrder", sortOrder);
      localStorage.setItem("winteq_scanlog_viewGrid", String(viewGrid));
    }
  }, [scannedItems, sheets, sheetLayouts, activeSheet, sortOrder, viewGrid, isMounted]);

  const currentLayout = activeSheet === "All Data"
    ? [...BASE_COLUMNS, { id: 'category', name: 'KATEGORI', type: 'base', width: 200 }]
    : (sheetLayouts[activeSheet] || BASE_COLUMNS);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => { 
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpenFor(null); 
      if (tableRef.current && !tableRef.current.contains(e.target as Node)) setSelection(null);
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) setExportMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const baseDisplayedItems = activeSheet === "All Data" ? scannedItems : scannedItems.filter(item => (item.category || "Default") === activeSheet);
  const displayedItems = sortOrder === 'newest' ? baseDisplayedItems : [...baseDisplayedItems].reverse();

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

  const saveHistory = () => { setPastStates((prev) => [...prev.slice(-19), { items: scannedItems, layouts: sheetLayouts, sheetsList: sheets }]); setFutureStates([]); };
  const handleUndo = () => { if (pastStates.length === 0) return; const previousState = pastStates[pastStates.length - 1]; setPastStates((prev) => prev.slice(0, -1)); setFutureStates((prev) => [...prev, { items: scannedItems, layouts: sheetLayouts, sheetsList: sheets }]); setScannedItems(previousState.items); setSheetLayouts(previousState.layouts); setSheets(previousState.sheetsList); };
  const handleRedo = () => { if (futureStates.length === 0) return; const nextState = futureStates[futureStates.length - 1]; setFutureStates((prev) => prev.slice(0, -1)); setPastStates((prev) => [...prev, { items: scannedItems, layouts: sheetLayouts, sheetsList: sheets }]); setScannedItems(nextState.items); setSheetLayouts(nextState.layouts); setSheets(nextState.sheetsList); };

  useEffect(() => {
    const handleMouseUpGlobal = () => setIsDraggingGrid(false);
    window.addEventListener('mouseup', handleMouseUpGlobal);
    return () => window.removeEventListener('mouseup', handleMouseUpGlobal);
  }, []);

  const getGridDataString = () => {
    if (!selection) return "";
    const minR = Math.min(selection.startR, selection.endR); const maxR = Math.max(selection.startR, selection.endR);
    const minC = Math.min(selection.startC, selection.endC); const maxC = Math.max(selection.startC, selection.endC);
    let tsv = "";
    for (let r = minR; r <= maxR; r++) {
      let rowData = []; const item = displayedItems[r];
      if (!item) continue;
      for (let c = minC; c <= maxC; c++) {
        const col = currentLayout[c]; let val = "";
        if (col.id === 'no') val = (r + 1).toString();
        else if (col.id === 'barcode_id') val = item.barcode_id;
        else if (col.id === 'created_at') val = item.created_at;
        else if (col.id === 'category') val = item.category || 'Default';
        else val = item.custom_data?.[col.id] || "";
        rowData.push(val.replace(/\t/g, " ").replace(/\n/g, " ")); 
      }
      tsv += rowData.join("\t") + "\n";
    }
    return tsv.trimEnd();
  };

  const handleGridPaste = (clipboardText: string) => {
    if (!selection) return;
    const minR = Math.min(selection.startR, selection.endR); const minC = Math.min(selection.startC, selection.endC);
    const rows = clipboardText.split(/\r\n|\n|\r/);
    
    saveHistory();
    setScannedItems(prevItems => {
      const newItems = [...prevItems];
      for (let i = 0; i < rows.length; i++) {
        const targetR = minR + i; if (targetR >= displayedItems.length) break; 
        const targetItem = displayedItems[targetR];
        const globalIdx = newItems.findIndex(x => x.id === targetItem.id);
        if (globalIdx === -1) continue;

        const cols = rows[i].split("\t");
        let updatedItem = { ...newItems[globalIdx], custom_data: { ...(newItems[globalIdx].custom_data || {}) } };
        
        for (let j = 0; j < cols.length; j++) {
          const targetC = minC + j; if (targetC >= currentLayout.length) break;
          const colDef = currentLayout[targetC]; const val = cols[j];
          if (colDef.type === 'custom') updatedItem.custom_data[colDef.id] = val;
          else if (colDef.id === 'category') updatedItem.category = val;
          else if (colDef.id === 'barcode_id') updatedItem.barcode_id = val;
        }
        newItems[globalIdx] = updatedItem;
      }
      return newItems;
    });
  };

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (anyModalOpen) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); handleUndo(); } 
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); handleRedo(); }
    };
    window.addEventListener('keydown', handleGlobalKeyDown); return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [pastStates, futureStates, scannedItems, sheetLayouts, sheets, anyModalOpen]);

  useEffect(() => {
    const handleCopy = (e: ClipboardEvent) => {
      if (anyModalOpen || !selection) return;
      const textSelected = window.getSelection()?.toString();
      if (textSelected && textSelected.length > 0) return; 
      const tsv = getGridDataString();
      if (tsv) { e.preventDefault(); e.clipboardData?.setData('text/plain', tsv); }
    };
    const handlePaste = (e: ClipboardEvent) => {
      if (anyModalOpen || !selection) return;
      const activeEl = document.activeElement;
      const isInputActive = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');
      if (isInputActive && selection.startR === selection.endR && selection.startC === selection.endC) return; 
      e.preventDefault();
      const clipboardData = e.clipboardData?.getData('Text');
      if (clipboardData) handleGridPaste(clipboardData);
    };
    window.addEventListener('copy', handleCopy); window.addEventListener('paste', handlePaste);
    return () => { window.removeEventListener('copy', handleCopy); window.removeEventListener('paste', handlePaste); };
  }, [selection, displayedItems, currentLayout, scannedItems]);

  const handleCellKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement | HTMLSelectElement>, rIdx: number, cIdx: number) => {
    if (e.key === "Enter" && e.shiftKey) return;
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter"].includes(e.key)) {
      let nextR = rIdx; let nextC = cIdx; let shouldMove = false;

      if (e.key === "ArrowUp") { nextR--; shouldMove = true; } 
      else if (e.key === "ArrowDown" || e.key === "Enter") { nextR++; shouldMove = true; } 
      else if (e.key === "ArrowLeft" && (e.currentTarget.tagName === 'SELECT' || (e.currentTarget as HTMLInputElement).selectionStart === 0)) { nextC--; shouldMove = true; } 
      else if (e.key === "ArrowRight" && (e.currentTarget.tagName === 'SELECT' || (e.currentTarget as HTMLInputElement).selectionEnd === (e.currentTarget as HTMLInputElement).value.length)) { nextC++; shouldMove = true; }

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
        if (targetElement) { e.preventDefault(); targetElement.focus(); }
      }
    }
  };

  const handleAddColumn = (insertAfterIndex: number) => {
    saveHistory(); 
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
    saveHistory();
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
    setSelectedExportSheets(prev => prev.map(s => s === oldName ? newName : s));
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
    setSelectedExportSheets(prev => prev.filter(s => s !== sheetToDelete));
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
    setSelectedExportSheets([...selectedExportSheets, newName]); 
    setSheetLayouts({...sheetLayouts, [newName]: sheetLayouts[sheetToDup] || BASE_COLUMNS});
    const itemsToCopy = scannedItems.filter(i => i.category === sheetToDup);
    const duplicatedItems = itemsToCopy.map(i => ({ ...i, id: crypto.randomUUID(), category: newName }));
    setScannedItems([...scannedItems, ...duplicatedItems]);
    setActiveSheet(newName); setMenuOpenFor(null);
  };
  
  const handleMoveSheet = (sheet: string, direction: 'left' | 'right') => {
    const idx = sheets.indexOf(sheet);
    if ((direction === 'left' && idx <= 1) || (direction === 'right' && idx === sheets.length - 1)) return;
    saveHistory(); 
    const newSheets = [...sheets]; const swapIdx = direction === 'left' ? idx - 1 : idx + 1;
    [newSheets[idx], newSheets[swapIdx]] = [newSheets[swapIdx], newSheets[idx]];
    setSheets(newSheets); setMenuOpenFor(null);
  };
  const handleDragStart = (e: React.DragEvent, sheet: string) => { setDraggedSheet(sheet); e.dataTransfer.effectAllowed = 'move'; };
  const handleDrop = (e: React.DragEvent, targetSheet: string) => {
    e.preventDefault(); if (!draggedSheet || draggedSheet === targetSheet || targetSheet === "All Data") return;
    saveHistory();
    const newSheets = [...sheets]; const draggedIdx = newSheets.indexOf(draggedSheet); const targetIdx = newSheets.indexOf(targetSheet);
    newSheets.splice(draggedIdx, 1); newSheets.splice(targetIdx, 0, draggedSheet);
    setSheets(newSheets); setDraggedSheet(null);
  };

  const handleCategoryChange = (id: string, newCategory: string) => { saveHistory(); setScannedItems(prev => prev.map(item => item.id === id ? { ...item, category: newCategory } : item)); };
  const confirmDeleteRowAction = () => { if (deleteConfirm.itemId) { saveHistory(); setScannedItems((prev) => prev.filter((item) => item.id !== deleteConfirm.itemId)); } setDeleteConfirm({ isOpen: false, itemId: null, barcodeId: "" }); };
  const confirmResetDataAction = () => { saveHistory(); if (activeSheet === "All Data") setScannedItems([]); else setScannedItems((prev) => prev.filter(item => (item.category || "Default") !== activeSheet)); setResetConfirmOpen(false); };
  
  const handleExportCheckboxToggle = (sheetName: string) => {
    if (sheetName === "All Data") {
      if (selectedExportSheets.length === sheets.length) setSelectedExportSheets([]);
      else setSelectedExportSheets([...sheets]);
    } else {
      let newSelected: string[];
      if (selectedExportSheets.includes(sheetName)) {
        newSelected = selectedExportSheets.filter(s => s !== sheetName && s !== "All Data");
      } else {
        newSelected = [...selectedExportSheets, sheetName];
        const allIndividuals = sheets.filter(s => s !== "All Data");
        const isAllIndividualSelected = allIndividuals.every(s => newSelected.includes(s));
        if (isAllIndividualSelected && !newSelected.includes("All Data")) {
          newSelected.push("All Data");
        }
      }
      setSelectedExportSheets(newSelected);
    }
  };

  const createStyledWorksheet = (targetSheet: string) => {
    const baseItems = targetSheet === "All Data" ? scannedItems : scannedItems.filter(i => (i.category || "Default") === targetSheet);
    const items = sortOrder === 'newest' ? baseItems : [...baseItems].reverse();
    
    const layout = targetSheet === "All Data" ? [...BASE_COLUMNS, { id: 'category', name: 'KATEGORI', type: 'base', width: 200 }] : (sheetLayouts[targetSheet] || BASE_COLUMNS);

    const headers = layout.map(col => col.name);

    const rows = items.length === 0 
      ? [layout.map((_, i) => i === 0 ? "Belum ada data pindaian di kategori ini." : "")]
      : items.map((item, index) => {
          return layout.map(col => {
            if (col.id === 'no') return index + 1; 
            if (col.id === 'barcode_id') return item.barcode_id;
            if (col.id === 'created_at') return item.created_at;
            if (col.id === 'category') return item.category || 'Default';
            return item.custom_data?.[col.id] || "";
          });
        });

    const aoaData = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(aoaData);

    ws['!cols'] = layout.map(col => ({ wpx: col.width }));

    for (const key in ws) {
      if (key[0] === '!') continue; 

      const cell = ws[key];
      const rowIndex = parseInt(key.replace(/[A-Z]/g, ''));
      
      const colLetter = key.replace(/[0-9]/g, '');
      const colIndex = XLSX.utils.decode_col(colLetter);
      const colDef = layout[colIndex];

      let hAlign = "left";
      if (colDef && (colDef.id === 'no' || colDef.id === 'created_at' || colDef.id === 'category')) {
        hAlign = "center";
      }

      cell.s = {
        font: { name: "Arial", sz: 11, color: { rgb: "1F2937" } }, 
        alignment: { horizontal: hAlign, vertical: "top", wrapText: true } 
      };

      if (viewGrid) {
        cell.s.border = {
          top: { style: "thin", color: { rgb: "9CA3AF" } },    
          bottom: { style: "thin", color: { rgb: "9CA3AF" } },
          left: { style: "thin", color: { rgb: "9CA3AF" } },
          right: { style: "thin", color: { rgb: "9CA3AF" } }
        };
      } else {
        cell.s.border = {
          bottom: { style: "thin", color: { rgb: "D1D5DB" } } 
        };
      }

      if (rowIndex === 1) {
        cell.s.font.bold = true;
        cell.s.font.color = { rgb: "111827" }; 
        cell.s.fill = { fgColor: { rgb: "E5E7EB" } }; 
        cell.s.alignment.horizontal = "center"; 
        cell.s.alignment.vertical = "center";
        
        if (!viewGrid) {
           cell.s.border = {
             bottom: { style: "medium", color: { rgb: "9CA3AF" } } 
           };
        }
      }
    }

    return ws;
  };

  const executeExport = async () => {
    if (selectedExportSheets.length === 0) {
      setAlertModal({ isOpen: true, title: "Pilih Kategori", message: "Silakan centang minimal satu kategori untuk diunduh." });
      return;
    }

    setExportMenuOpen(false);

    if (exportFormat === 'single') {
      const workbook = XLSX.utils.book_new();
      const sortedSheets = [...selectedExportSheets].sort((a, b) => a === "All Data" ? -1 : b === "All Data" ? 1 : 0);
      
      sortedSheets.forEach(sheetName => {
        const worksheet = createStyledWorksheet(sheetName);
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.substring(0, 31)); 
      });
      XLSX.writeFile(workbook, `Laporan_Gabungan_Winteq.xlsx`);
      
    } else {
      for (let i = 0; i < selectedExportSheets.length; i++) {
        const sheetName = selectedExportSheets[i];
        const worksheet = createStyledWorksheet(sheetName);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.substring(0, 31));
        XLSX.writeFile(workbook, `Laporan_${sheetName.replace(/\s+/g, '_')}_Winteq.xlsx`);
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
  };

  const handleCreateNewSheet = () => {
    const sheetName = newSheetName.trim();
    if (sheetName && !sheets.includes(sheetName) && sheetName !== "Default") { 
      saveHistory(); 
      setSheets([...sheets, sheetName]); 
      setSelectedExportSheets([...selectedExportSheets, sheetName]); 
      setActiveSheet(sheetName); 
    }
    setShowNewSheetModal(false); setNewSheetName("");
  };

  if (!isMounted) return null;

  const thBorderClass = viewGrid ? "border border-gray-400 bg-gray-100" : "border-b border-gray-300 bg-white";
  const tdBorderClass = viewGrid ? "border border-gray-300" : "border-b border-gray-200";

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
          
          <div className="p-4 sm:p-5 border-b border-gray-100 flex flex-col xl:flex-row justify-between items-start xl:items-center bg-gray-50/50 gap-4 xl:gap-0 shrink-0 relative">
            <div className="flex items-center space-x-4">
              <h3 className="font-bold text-gray-800 text-lg">{activeSheet === "All Data" ? "Semua Data Pindaian" : `Kategori: ${activeSheet}`}</h3>
              <div className="bg-blue-100 text-blue-800 text-sm font-bold px-3 py-1.5 rounded-md border border-blue-200 shadow-sm flex items-center">
                Total: <span className="ml-1 text-blue-900">{displayedItems.length}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button 
                onClick={() => { setSortOrder(prev => prev === 'newest' ? 'oldest' : 'newest'); setSelection(null); }} 
                className="p-2 mr-2 rounded-lg transition-colors flex items-center shadow-sm bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                title="Urutkan Data"
              >
                <ArrowsUpDownIcon className="w-4 h-4 md:mr-1.5" />
                <span className="text-sm font-medium hidden md:inline">
                  {sortOrder === 'newest' ? 'Terbaru' : 'Terlama'}
                </span>
              </button>

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

              <div className="relative" ref={exportMenuRef}>
                <button 
                  onClick={() => setExportMenuOpen(!exportMenuOpen)} 
                  className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium py-2 px-4 rounded-lg shadow-sm flex items-center transition-colors"
                >
                  <DocumentArrowDownIcon className="w-4 h-4 mr-1.5" />
                  Unduh Excel
                  <ChevronDownIcon className={`w-3.5 h-3.5 ml-2 transition-transform ${exportMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {exportMenuOpen && (
                  <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden flex flex-col">
                    <div className="p-3 border-b border-gray-100 bg-gray-50">
                      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Pilih Data Kategori</h4>
                    </div>
                    <div className="max-h-48 overflow-y-auto p-2">
                      {sheets.map(sheet => (
                        <label key={sheet} className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={sheet === "All Data" ? selectedExportSheets.length === sheets.length : selectedExportSheets.includes(sheet)}
                            onChange={() => handleExportCheckboxToggle(sheet)}
                            className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                          />
                          <span className={`ml-3 text-sm ${sheet === "All Data" ? "font-bold text-gray-800" : "text-gray-600"}`}>{sheet}</span>
                        </label>
                      ))}
                    </div>
                    
                    <div className="p-3 border-t border-gray-100 bg-gray-50">
                      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Format Unduhan</h4>
                      <div className="space-y-2">
                        <label className="flex items-center cursor-pointer">
                          <input type="radio" name="exportFormat" value="single" checked={exportFormat === 'single'} onChange={() => setExportFormat('single')} className="w-4 h-4 text-green-600 border-gray-300 focus:ring-green-500" />
                          <span className="ml-3 text-sm text-gray-700">Download dalam satu File</span>
                        </label>
                        <label className="flex items-center cursor-pointer">
                          <input type="radio" name="exportFormat" value="multiple" checked={exportFormat === 'multiple'} onChange={() => setExportFormat('multiple')} className="w-4 h-4 text-green-600 border-gray-300 focus:ring-green-500" />
                          <span className="ml-3 text-sm text-gray-700">Download File terpisah</span>
                        </label>
                      </div>
                    </div>

                    <div className="p-3 border-t border-gray-100">
                      <button onClick={executeExport} className="w-full bg-green-600 hover:bg-green-700 text-white text-sm font-bold py-2.5 rounded-lg transition-colors flex items-center justify-center">
                        Eksekusi Unduhan
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {displayedItems.length > 0 && <button onClick={() => setResetConfirmOpen(true)} className="bg-red-50 hover:bg-red-100 text-red-600 text-sm font-medium py-2 px-4 rounded-lg border border-red-200">{activeSheet === "All Data" ? "Reset Semua" : "Kosongkan Sheet"}</button>}
            </div>
          </div>
          
          <div className="flex-1 overflow-auto bg-white relative">
            <table ref={tableRef} className="w-max min-w-full text-left border-collapse table-fixed outline-none">
              <thead className="sticky top-0 shadow-sm z-10">
                <tr className="text-xs tracking-wider text-gray-600">
                  
                  {currentLayout.map((col, idx) => (
                    <th 
                      key={col.id} 
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
              <tbody className={`text-sm ${isDraggingGrid ? 'select-none' : ''}`}>
                {displayedItems.length === 0 ? (
                  <tr><td colSpan={currentLayout.length + 1} className="p-16 text-center text-gray-400">Belum ada data di sheet ini.</td></tr>
                ) : (
                  displayedItems.map((item, index) => (
                    <tr key={item.id} className="hover:bg-blue-50/40 transition-colors group">
                      {currentLayout.map((col, idx) => {
                        
                        const isSelected = selection && 
                          index >= Math.min(selection.startR, selection.endR) && 
                          index <= Math.max(selection.startR, selection.endR) && 
                          idx >= Math.min(selection.startC, selection.endC) && 
                          idx <= Math.max(selection.startC, selection.endC);
                          
                        const activeBg = isSelected ? "bg-blue-100/60 ring-1 ring-blue-500/50" : "";

                        let cellContent;
                        if (col.id === 'no') {
                          cellContent = <span id={`cell-${index}-${idx}`} tabIndex={0} onKeyDown={(e) => handleCellKeyDown(e as any, index, idx)} className="block outline-none text-center w-full">{index + 1}</span>;
                        } else if (col.id === 'barcode_id') {
                          cellContent = (
                            <input id={`cell-${index}-${idx}`} type="text" value={item.barcode_id} onChange={(e) => {
                                saveHistory(); setScannedItems(prev => prev.map(i => i.id === item.id ? { ...i, barcode_id: e.target.value } : i));
                              }} onKeyDown={(e) => handleCellKeyDown(e, index, idx)} onFocus={() => setSelection({ startR: index, startC: idx, endR: index, endC: idx })}
                              className="w-full bg-transparent outline-none focus:ring-1 focus:ring-blue-400 rounded px-1 font-medium text-gray-900" 
                            />
                          );
                        } else if (col.id === 'created_at') {
                          cellContent = <span id={`cell-${index}-${idx}`} tabIndex={0} onKeyDown={(e) => handleCellKeyDown(e as any, index, idx)} className="block text-gray-600 outline-none text-center w-full">{item.created_at}</span>;
                        } else if (col.id === 'category') {
                          cellContent = sheets.length === 1 
                            ? <span id={`cell-${index}-${idx}`} tabIndex={0} className="px-3 py-1 bg-gray-100 text-gray-500 rounded text-xs outline-none flex justify-center w-full">Default</span>
                            : (
                              <select id={`cell-${index}-${idx}`} value={item.category || "Default"} onChange={(e) => handleCategoryChange(item.id, e.target.value)} onKeyDown={(e) => handleCellKeyDown(e, index, idx)} onFocus={() => setSelection({ startR: index, startC: idx, endR: index, endC: idx })} className="text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-700 py-1 px-1 outline-none w-full cursor-pointer hover:bg-gray-50 text-center">
                                <option value="Default">Default</option>
                                {sheets.filter(s => s !== "All Data").map(sheet => <option key={sheet} value={sheet}>{sheet}</option>)}
                              </select>
                            );
                        } else {
                          cellContent = (
                            <div className="grid w-full min-w-0">
                              <div className="invisible col-start-1 row-start-1 px-2 py-1.5 whitespace-pre-wrap break-all min-h-[36px] font-sans text-sm pointer-events-none w-full overflow-hidden">
                                {item.custom_data?.[col.id] || ' '}{'\u200b'}
                              </div>
                              <textarea 
                                id={`cell-${index}-${idx}`}
                                value={item.custom_data?.[col.id] || ''} 
                                onChange={(e) => handleCustomDataChange(item.id, col.id, e.target.value)}
                                onKeyDown={(e) => handleCellKeyDown(e, index, idx)}
                                onFocus={() => setSelection({ startR: index, startC: idx, endR: index, endC: idx })}
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
                            className={`p-3 align-top border-r border-gray-100 transition-colors ${tdBorderClass} ${activeBg}`}
                            onMouseDown={() => { setIsDraggingGrid(true); setSelection({ startR: index, startC: idx, endR: index, endC: idx }); }}
                            onMouseEnter={() => { if (isDraggingGrid) setSelection(prev => prev ? { ...prev, endR: index, endC: idx } : null); }}
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