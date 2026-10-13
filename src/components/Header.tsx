import React from 'react';
import { Bot, Shield, User as UserIcon, LogOut, Activity, Laptop, MonitorUp, Sparkles } from 'lucide-react';
import { User, RouteType } from '../types';

interface HeaderProps {
  user: User | null;
  onLogout: () => void;
  onOpenLogin: () => void;
  onOpenScreenShare: () => void;
  onOpenComputerControl: () => void;
  onOpenDiagnostics: () => void;
  selectedRoute: RouteType | 'auto';
  onSelectRoute: (route: RouteType | 'auto') => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  onLogout,
  onOpenLogin,
  onOpenScreenShare,
  onOpenComputerControl,
  onOpenDiagnostics,
  selectedRoute,
  onSelectRoute,
}) => {
  const routes: { id: RouteType | 'auto'; label: string; desc: string }[] = [
    { id: 'auto', label: 'স্বয়ংক্রিয়', desc: 'স্মার্ট রাউটার' },
    { id: 'chat', label: 'চ্যাট', desc: 'প্রশ্ন ও উত্তর' },
    { id: 'code', label: 'কোডিং', desc: 'প্রোগ্রামিং ও স্ক্রিপ্ট' },
    { id: 'image', label: 'ইমেজ', desc: 'ছবি ও চিত্রশিল্প' },
    { id: 'video', label: 'ভিডিও', desc: 'স্টোরিবোর্ড ও প্রম্পট' },
    { id: 'analyze', label: 'বিশ্লেষণ', desc: 'স্ক্রিনশট ও ডেটা' },
  ];

  return (
    <header className="border-b border-slate-200 bg-white sticky top-0 z-30 shadow-xs">
      {/* Top Navbar */}
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm shadow-blue-200">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">BCC AI Agent</h1>
              <span className="text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                বাংলা সহকারী
              </span>
            </div>
            <p className="text-xs text-slate-500 hidden sm:block">
              মাল্টি-মডেল রাউটার · ইমেজ ক্রিয়েশন · স্ক্রিন বিশ্লেষণ · কম্পিউটার কন্ট্রোল
            </p>
          </div>
        </div>

        {/* User Account / Navigation Buttons */}
        <div className="flex items-center gap-2">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="text-right hidden md:block">
                <div className="text-xs font-semibold text-slate-800 flex items-center justify-end gap-1.5">
                  {user.role === 'admin' ? (
                    <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded text-[11px] font-bold border border-emerald-200">
                      <Shield className="w-3 h-3" /> অ্যাডমিন
                    </span>
                  ) : (
                    <span className="text-slate-600 font-medium">সাধারণ ব্যবহারকারী</span>
                  )}
                  <span>{user.name}</span>
                </div>
                <div className="text-[11px] text-slate-500 truncate max-w-[180px]">{user.email}</div>
              </div>

              {/* Action Buttons */}
              <button
                type="button"
                onClick={onOpenScreenShare}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                title="লাইভ স্ক্রিন শেয়ার ও বিশ্লেষণ"
              >
                <MonitorUp className="w-3.5 h-3.5 text-blue-600" />
                <span className="hidden sm:inline">স্ক্রিন শেয়ার</span>
              </button>

              {user.role === 'admin' && (
                <button
                  type="button"
                  onClick={onOpenComputerControl}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50/50 text-xs font-medium text-indigo-700 hover:bg-indigo-100/60 transition-colors"
                  title="কম্পিউটার কন্ট্রোল (অ্যাডমিন)"
                >
                  <Laptop className="w-3.5 h-3.5 text-indigo-600" />
                  <span className="hidden sm:inline">পিসি কন্ট্রোল</span>
                </button>
              )}

              <button
                type="button"
                onClick={onOpenDiagnostics}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                title="সিস্টেম স্ট্যাটাস ও টেস্ট"
              >
                <Activity className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={onLogout}
                className="p-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 transition-colors"
                title="লগআউট"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onOpenDiagnostics}
                className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs transition-colors"
                title="সিস্টেম স্ট্যাটাস"
              >
                <Activity className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onOpenLogin}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
              >
                <UserIcon className="w-3.5 h-3.5" />
                <span>লগইন করুন</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Route Filter Tabs (Zero-pill segmented buttons) */}
      <div className="border-t border-slate-100 bg-slate-50/80 px-4 py-1.5">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-2 overflow-x-auto">
          <div className="flex items-center gap-1 min-w-max">
            <span className="text-[11px] text-slate-500 font-medium mr-1.5 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-blue-600" /> মোড:
            </span>
            {routes.map((rt) => {
              const active = selectedRoute === rt.id;
              return (
                <button
                  key={rt.id}
                  type="button"
                  onClick={() => onSelectRoute(rt.id)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                    active
                      ? 'bg-white text-blue-700 shadow-xs border border-slate-200 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                  }`}
                >
                  {rt.label}
                </button>
              );
            })}
          </div>

          <div className="text-[11px] text-slate-400 hidden lg:block">
            {selectedRoute === 'auto'
              ? 'রোবট আপনার প্রশ্ন বুঝে সঠিক মডেলে পাঠাবে'
              : routes.find((r) => r.id === selectedRoute)?.desc}
          </div>
        </div>
      </div>
    </header>
  );
};
