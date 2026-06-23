import React from 'react';
import { LogOut, Image, Mail, Smartphone, RefreshCw, Cpu, ShieldCheck } from 'lucide-react';
import { User } from 'firebase/auth';

interface HeaderProps {
  user: User | null;
  needsAuth: boolean;
  onLogout: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  totalPhotosCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  needsAuth,
  onLogout,
  onRefresh,
  isRefreshing,
  totalPhotosCount,
}) => {
  return (
    <header className="border-b border-gray-100 bg-white/85 backdrop-blur-md sticky top-0 z-40 w-full">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          
          {/* Logo & Name */}
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-tr from-amber-500 to-rose-600 text-white p-2.5 rounded-2xl shadow-md flex items-center justify-center">
              <Image className="h-6 w-6" />
            </div>
            <div>
              <h1 className="font-display font-semibold text-xl text-gray-900 tracking-tight flex items-center gap-2">
                Gmail Photo Gallery
              </h1>
              <p className="text-xs text-gray-500 font-sans">
                Suas fotos recebidas por e-mail, organizadas e seguras
              </p>
            </div>
          </div>

          {/* User Profile & Actions */}
          {!needsAuth && user && (
            <div className="flex items-center flex-wrap justify-center sm:justify-end gap-3 sm:gap-4 w-full sm:w-auto">
              
              {/* Sync Button */}
              <button
                onClick={onRefresh}
                disabled={isRefreshing}
                className="flex items-center gap-2 px-3.5 py-2 bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-100/60 rounded-xl transition-all duration-200 text-sm font-medium disabled:opacity-60 cursor-pointer shadow-xs active:scale-95"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>{isRefreshing ? 'Sincronizando...' : 'Sincronizar'}</span>
                {totalPhotosCount > 0 && (
                  <span className="ml-1 bg-rose-600 text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
                    {totalPhotosCount}
                  </span>
                )}
              </button>

              {/* User Account Info */}
              <div className="flex items-center gap-2 bg-gray-50/80 px-3 py-1.5 rounded-xl border border-gray-100">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'Avatar'}
                    referrerPolicy="no-referrer"
                    className="h-7 w-7 rounded-lg ring-1 ring-gray-200"
                  />
                ) : (
                  <div className="h-7 w-7 rounded-lg bg-gray-200 text-gray-600 font-bold text-xs flex items-center justify-center">
                    {(user.displayName || 'U').charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="text-left hidden md:block">
                  <p className="text-xs font-semibold text-gray-800 line-clamp-1 max-w-[150px]">
                    {user.displayName}
                  </p>
                  <p className="text-[10px] text-gray-400 font-mono line-clamp-1 max-w-[150px]">
                    {user.email}
                  </p>
                </div>
              </div>

              {/* Logout Button */}
              <button
                onClick={onLogout}
                title="Desconectar do app"
                className="p-2.5 text-gray-400 hover:text-gray-900 bg-gray-50/80 hover:bg-gray-100 border border-gray-100 rounded-xl transition duration-200 cursor-pointer group active:scale-95"
              >
                <LogOut className="h-4.5 w-4.5 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
