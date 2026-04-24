"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LockClosedIcon, UserIcon, ArrowRightOnRectangleIcon, EyeIcon, EyeSlashIcon } from "@heroicons/react/24/solid";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  // STATE BARU: Buat Lihat/Sembunyi Password
  const [showPassword, setShowPassword] = useState(false); 
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    // KUNCI SAKTI: Cuma 1 Akun Hardcoded
    setTimeout(() => {
      if (username === "faisal" && password === "faisal123") {
        // Pake sessionStorage biar kalau Tab ditutup, loginnya langsung HANGUS
        sessionStorage.setItem("winteq_auth", "token_rahasia_faisal_xyz");
        router.push("/scan-log");
      } else {
        setError("Username atau Password salah!");
        setIsLoading(false);
      }
    }, 800); // Kasih efek mikir dikit biar elegan
  };

  return (
    // UBAH BACKGROUND UTAMA JADI PUTIH/CERAH
    <div className="min-h-screen w-full flex items-center justify-center bg-white relative overflow-hidden font-sans">
      
      {/* Efek Lampu Neon Belakang Disesuaikan Biar Gak Terlalu Gelap */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-100/70 blur-[150px] rounded-full pointer-events-none"></div>

      {/* UBAH CARD JADI PUTIH, TAMBAH BORDER NEON BIRU ASTRA EFEK RGB */}
      <div className="w-full max-w-md p-9 bg-white border-2 border-blue-600 rounded-3xl relative z-10 shadow-[0_0_12px_2px_rgba(59,130,246,0.6),0_0_4px_1px_rgba(168,85,247,0.4)]">
        
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-300/50">
              <LockClosedIcon className="w-6 h-6 text-white" />
            </div>
          </div>
          {/* Teks Winteq System Ganti Warna Hitam */}
          <h1 className="text-3xl font-black text-slate-950 tracking-wider">WINTEQ <span className="text-blue-500">SYSTEM</span></h1>
          <p className="text-slate-600 text-sm mt-2 font-medium">Secured Data Portal</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-center">
            <p className="text-sm font-bold text-red-600">{error}</p>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider pl-1">Username</label>
            <div className="relative">
              <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              {/* INPUT USERNAME UBAH JADI TERANG */}
              <input 
                type="text" 
                value={username} 
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
                className="w-full bg-slate-100 border border-slate-300 text-black px-12 py-3.5 rounded-xl outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-medium"
                placeholder="Masukkan username"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider pl-1">Password</label>
            <div className="relative">
              <LockClosedIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              {/* INPUT PASSWORD UBAH JADI TERANG, TYPE DINAMIS */}
              <input 
                type={showPassword ? "text" : "password"} // Type ganti text kalau mata ditekan
                value={password} 
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-100 border border-slate-300 text-black px-12 py-3.5 rounded-xl outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-medium"
                placeholder="••••••••"
                required
              />
              {/* TOMBOL MATA DI UJUNG KANAN */}
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-blue-600 transition-colors p-1"
                title={showPassword ? "Sembunyikan password" : "Lihat password"}
              >
                {showPassword ? (
                  <EyeSlashIcon className="w-5 h-5" />
                ) : (
                  <EyeIcon className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={isLoading || !username || !password}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-200/50 disabled:opacity-50 disabled:cursor-not-allowed mt-4"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              <><ArrowRightOnRectangleIcon className="w-5 h-5" /> MASUK SISTEM</>
            )}
          </button>
        </form>
        
        <p className="text-center text-xs text-slate-600 mt-8 font-medium">
          Astra Otoparts &copy; {new Date().getFullYear()} <br/>
          Strictly Confidential. Unauthorized access prohibited.
        </p>
      </div>
    </div>
  );
}