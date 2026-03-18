"use client";

import { useState, useEffect } from "react";
import { 
  ClipboardDocumentCheckIcon, 
  CubeIcon, 
  Cog6ToothIcon, 
  Bars3Icon, 
  XMarkIcon 
} from "@heroicons/react/24/outline";
import Link from "next/link"; // Persiapan untuk pindah-pindah halaman nanti

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true); 

  useEffect(() => {
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  }, []);

  return (
    <div className="flex h-screen bg-gray-50 font-sans text-gray-800 overflow-hidden">
      
      {/* Sidebar Component */}
      <aside 
        className={`transition-all duration-300 ease-in-out bg-slate-900 text-white shrink-0 flex flex-col z-20 ${
          isSidebarOpen ? "w-64" : "w-20"
        }`}
      >
        <div className="h-16 flex items-center justify-start px-5 border-b border-slate-700">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 -ml-1 rounded-md hover:bg-slate-800 text-slate-300 focus:outline-none transition-colors flex-shrink-0"
          >
            {isSidebarOpen ? <XMarkIcon className="w-6 h-6" /> : <Bars3Icon className="w-6 h-6" />}
          </button>
          <div className={`overflow-hidden whitespace-nowrap transition-all duration-300 ${isSidebarOpen ? "ml-4 w-auto opacity-100" : "w-0 opacity-0"}`}>
            <h1 className="text-xl font-bold tracking-wider text-blue-400">WINTEQ</h1>
          </div>
        </div>

        <nav className="flex-1 py-6 space-y-2 overflow-hidden">
          {/* Menggunakan Link agar siap untuk multi-page */}
          <Link href="/" className="flex items-center px-4 py-3 mx-3 bg-blue-600 rounded-lg font-medium transition-colors shadow-sm group">
            <ClipboardDocumentCheckIcon className="w-6 h-6 flex-shrink-0 ml-1 text-white" />
            <span className={`ml-4 whitespace-nowrap transition-all duration-300 ${isSidebarOpen ? "opacity-100" : "opacity-0 hidden"}`}>
              Dashboard Scan
            </span>
          </Link>
          <Link href="#" className="flex items-center px-4 py-3 mx-3 text-slate-400 hover:bg-slate-800 hover:text-white rounded-lg transition-colors group">
            <CubeIcon className="w-6 h-6 flex-shrink-0 ml-1 text-slate-400 group-hover:text-white" />
            <span className={`ml-4 whitespace-nowrap transition-all duration-300 ${isSidebarOpen ? "opacity-100" : "opacity-0 hidden"}`}>
              Inventaris (Segera)
            </span>
          </Link>
          <Link href="#" className="flex items-center px-4 py-3 mx-3 text-slate-400 hover:bg-slate-800 hover:text-white rounded-lg transition-colors group">
            <Cog6ToothIcon className="w-6 h-6 flex-shrink-0 ml-1 text-slate-400 group-hover:text-white" />
            <span className={`ml-4 whitespace-nowrap transition-all duration-300 ${isSidebarOpen ? "opacity-100" : "opacity-0 hidden"}`}>
              Pengaturan
            </span>
          </Link>
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden min-w-0 transition-all duration-300">
        
        {/* Header Component */}
        <header className="bg-white shadow-sm border-b px-8 py-4 flex justify-between items-center z-10 h-16">
          <h2 className="text-xl font-semibold text-gray-800">Dashboard Utama</h2>
          <div className="flex items-center space-x-4">
            <span className="text-sm font-medium text-gray-500 hidden md:block">
              {new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
            <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold border border-blue-200 shadow-sm cursor-pointer hover:bg-blue-200 transition-colors">
              A
            </div>
          </div>
        </header>

        {/* Dynamic Content (Halaman yang sedang dibuka akan dirender di sini) */}
        <div className="flex-1 overflow-auto p-8">
          {children}
        </div>
      </main>
    </div>
  );
}