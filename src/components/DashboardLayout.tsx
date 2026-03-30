"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation"; // Import pendeteksi URL
import { ClipboardDocumentCheckIcon, Cog6ToothIcon, Bars3Icon, XMarkIcon, TableCellsIcon } from "@heroicons/react/24/outline";
import Link from "next/link";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true); 
  const pathname = usePathname(); // Membaca URL saat ini (misal: '/' atau '/scan-log')

  useEffect(() => {
    if (window.innerWidth < 768) setIsSidebarOpen(false);
  }, []);

  return (
    <div className="flex h-screen bg-gray-50 font-sans text-gray-800 overflow-hidden">
      
      <aside className={`transition-all duration-300 ease-in-out bg-slate-900 text-white shrink-0 flex flex-col z-20 ${isSidebarOpen ? "w-64" : "w-20"}`}>
        <div className="h-16 flex items-center justify-start px-5 border-b border-slate-700">
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 -ml-1 rounded-md hover:bg-slate-800 text-slate-300 focus:outline-none transition-colors flex-shrink-0">
            {isSidebarOpen ? <XMarkIcon className="w-6 h-6" /> : <Bars3Icon className="w-6 h-6" />}
          </button>
          <div className={`overflow-hidden whitespace-nowrap transition-all duration-300 ${isSidebarOpen ? "ml-4 w-auto opacity-100" : "w-0 opacity-0"}`}>
            <h1 className="text-xl font-bold tracking-wider text-blue-400">WINTEQ</h1>
          </div>
        </div>

        <nav className="flex-1 py-6 space-y-2 overflow-hidden">
          
          {/* MENU 1: DASHBOARD SCAN */}
          {/* Logika: Jika pathname adalah '/', maka beri warna biru. Jika bukan, beri warna abu-abu */}
          <Link href="/" className={`flex items-center px-4 py-3 mx-3 rounded-lg font-medium transition-colors group ${pathname === '/' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
            <ClipboardDocumentCheckIcon className={`w-6 h-6 flex-shrink-0 ml-1 ${pathname === '/' ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} />
            <span className={`ml-4 whitespace-nowrap transition-all duration-300 ${isSidebarOpen ? "opacity-100" : "opacity-0 hidden"}`}>
              Dashboard Scan
            </span>
          </Link>
          
          {/* MENU 2: SCAN LOG */}
          {/* Logika: Jika pathname adalah '/scan-log', maka beri warna biru. Jika bukan, beri warna abu-abu */}
          <Link href="/scan-log" className={`flex items-center px-4 py-3 mx-3 rounded-lg font-medium transition-colors group ${pathname === '/scan-log' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
            <TableCellsIcon className={`w-6 h-6 flex-shrink-0 ml-1 ${pathname === '/scan-log' ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} />
            <span className={`ml-4 whitespace-nowrap transition-all duration-300 ${isSidebarOpen ? "opacity-100" : "opacity-0 hidden"}`}>
              Scan Log
            </span>
          </Link>

          {/* MENU 3: PENGATURAN */}
          <Link href="#" className="flex items-center px-4 py-3 mx-3 text-slate-400 hover:bg-slate-800 hover:text-white rounded-lg transition-colors group">
            <Cog6ToothIcon className="w-6 h-6 flex-shrink-0 ml-1 text-slate-400 group-hover:text-white" />
            <span className={`ml-4 whitespace-nowrap transition-all duration-300 ${isSidebarOpen ? "opacity-100" : "opacity-0 hidden"}`}>
              Pengaturan
            </span>
          </Link>

        </nav>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden min-w-0 transition-all duration-300">
        <header className="bg-white shadow-sm border-b px-8 py-4 flex justify-between items-center z-10 h-16">
          
          {/* JUDUL HEADER DINAMIS: Berubah sesuai halaman */}
          <h2 className="text-xl font-semibold text-gray-800">
            {pathname === '/scan-log' ? 'Master Data: Scan Log' : 'Dashboard Utama'}
          </h2>

          <div className="flex items-center space-x-4">
            <span className="text-sm font-medium text-gray-500 hidden md:block">
              {new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
            <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold border border-blue-200 shadow-sm cursor-pointer hover:bg-blue-200 transition-colors">A</div>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-8">
          {children}
        </div>
      </main>
    </div>
  );
}