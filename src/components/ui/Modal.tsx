// src/components/ui/Modal.tsx
import { ReactNode } from "react";
import { ExclamationTriangleIcon, TrashIcon, ArrowPathIcon } from "@heroicons/react/24/outline";

type ModalProps = {
  isOpen: boolean;
  title: string;
  description: ReactNode; // Mengizinkan teks biasa atau elemen HTML (seperti <span>)
  type?: "danger" | "severe" | "warning"; // Tema warna
  icon?: "trash" | "reset" | "warning"; // Pilihan ikon
  children: ReactNode; // Tempat untuk menyisipkan tombol-tombol kustom dari luar
};

export default function Modal({ isOpen, title, description, type = "warning", icon = "warning", children }: ModalProps) {
  if (!isOpen) return null;

  // Konfigurasi Tema (Warna & Border)
  const themes = {
    danger: { bg: "bg-red-100", text: "text-red-600", border: "border-red-200", topBorder: "border-gray-100" },
    severe: { bg: "bg-red-100", text: "text-red-600", border: "border-red-200", topBorder: "border-t-8 border-t-red-600" },
    warning: { bg: "bg-yellow-100", text: "text-yellow-600", border: "border-yellow-200", topBorder: "border-l-8 border-l-yellow-500" }
  };
  const theme = themes[type];

  // Render Ikon Dinamis
  const renderIcon = () => {
    if (icon === "trash") return <TrashIcon className="w-6 h-6" />;
    if (icon === "reset") return <ArrowPathIcon className="w-6 h-6" />;
    return <ExclamationTriangleIcon className="w-6 h-6" />;
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all ease-out">
      <div className={`bg-white rounded-2xl shadow-2xl p-6 md:p-8 max-w-lg w-full border transform transition-all ${theme.topBorder}`}>
        <div className="flex items-center space-x-3.5 mb-5">
          <div className={`${theme.bg} p-2.5 rounded-full ${theme.text} flex-shrink-0 shadow-sm border ${theme.border}`}>
            {renderIcon()}
          </div>
          <h3 className={`text-xl font-bold ${type === 'severe' ? 'text-red-700 uppercase tracking-wide' : 'text-gray-800'}`}>
            {title}
          </h3>
        </div>
        <div className="text-gray-600 text-sm md:text-base mb-8 leading-relaxed">
          {description}
        </div>
        {/* Area Tombol yang Fleksibel */}
        <div className="flex flex-col sm:flex-row justify-end space-y-2.5 sm:space-y-0 sm:space-x-3">
          {children}
        </div>
      </div>
    </div>
  );
}