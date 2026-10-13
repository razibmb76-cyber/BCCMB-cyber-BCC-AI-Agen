import React, { useState, useEffect } from 'react';
import { X, Activity, Smartphone, Server, CheckCircle2, XCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { User, SystemStatusData } from '../types';

interface DiagnosticModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  token: string;
}

export const DiagnosticModal: React.FC<DiagnosticModalProps> = ({
  isOpen,
  onClose,
  user,
  token,
}) => {
  const [deviceTestLogs, setDeviceTestLogs] = useState<string[]>([]);
  const [testingDevice, setTestingDevice] = useState(false);
  const [systemStatus, setSystemStatus] = useState<SystemStatusData | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  const runDeviceTest = async () => {
    setTestingDevice(true);
    const logs: string[] = [];
    const md = navigator.mediaDevices;

    logs.push(`নিরাপদ কনটেক্সট (HTTPS): ${window.isSecureContext ? '✅ হ্যাঁ' : '❌ না — স্ক্রিন শেয়ার চলবে না'}`);
    logs.push(
      `ডিভাইস ধরন: ${
        /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) ? '📱 মোবাইল / ট্যাবলেট' : '💻 কম্পিউটার / ডেস্কটপ'
      }`
    );
    const hasGetDisplayMedia = typeof navigator?.mediaDevices?.getDisplayMedia === 'function';
    const hasGetUserMedia = typeof navigator?.mediaDevices?.getUserMedia === 'function';

    logs.push(`getDisplayMedia API: ${hasGetDisplayMedia ? '✅ ব্রাউজারে উপলব্ধ' : '❌ উপলব্ধ নয়'}`);

    if (hasGetDisplayMedia) {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        stream.getTracks().forEach((t) => t.stop());
        logs.push('স্ক্রিন শেয়ার ক্যাপচার টেস্ট: ✅ সম্পূর্ণ কার্যক্ষম ও অনুমতি প্রাপ্ত');
      } catch (err: any) {
        logs.push(`স্ক্রিন শেয়ার পারমিশন: ❌ ${err.name || err.message} (অনুমতি দেওয়া হয়নি)`);
      }
    }

    logs.push(
      `ক্যামেরা ও মাইক্রোফোন সাপোর্ট: ${
        hasGetUserMedia ? '✅ উপলব্ধ (ছবি ও ভয়েস ইনপুট কাজ করবে)' : '❌ উপলব্ধ নয়'
      }`
    );

    setDeviceTestLogs(logs);
    setTestingDevice(false);
  };

  const fetchSystemStatus = async () => {
    if (!token || user?.role !== 'admin') return;
    setLoadingStatus(true);
    setStatusError(null);
    try {
      const res = await fetch('/api/status', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'সিস্টেম স্ট্যাটাস লোড করা যায়নি');
      }
      setSystemStatus(data);
    } catch (err: any) {
      setStatusError(err.message);
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      runDeviceTest();
      if (user?.role === 'admin') {
        fetchSystemStatus();
      }
    }
  }, [isOpen, user, token]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl max-w-xl w-full max-h-[85vh] shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60 shrink-0">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-600" />
            <div>
              <h3 className="text-base font-bold text-slate-900">ডায়াগনস্টিক ও সিস্টেম স্ট্যাটাস</h3>
              <p className="text-xs text-slate-500">ডিভাইস ও সার্ভার ইন্টিগ্রেশন নিরীক্ষা</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* Device & Browser Capabilities */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-blue-600" />
                ব্রাউজার ও ডিভাইস সামঞ্জস্যতা
              </span>
              <button
                type="button"
                onClick={runDeviceTest}
                disabled={testingDevice}
                className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
              >
                <RefreshCw className={`w-3 h-3 ${testingDevice ? 'animate-spin' : ''}`} />
                <span>রি-টেস্ট</span>
              </button>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 font-mono text-xs text-slate-700">
              {deviceTestLogs.map((log, i) => (
                <div key={i} className="leading-relaxed">
                  {log}
                </div>
              ))}
            </div>
          </div>

          {/* Admin System Status */}
          {user?.role === 'admin' && (
            <div className="space-y-2 border-t border-slate-100 pt-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Server className="w-4 h-4 text-indigo-600" />
                  সার্ভার ইন্টিগ্রেশন ও এপিআই স্ট্যাটাস (অ্যাডমিন)
                </span>
                <button
                  type="button"
                  onClick={fetchSystemStatus}
                  disabled={loadingStatus}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
                >
                  রিফ্রেশ
                </button>
              </div>

              {statusError ? (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>{statusError}</span>
                </div>
              ) : systemStatus ? (
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5 text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 bg-white rounded-lg border border-slate-200/60">
                      <div className="text-[11px] text-slate-400">Gemini 3.8 Core API</div>
                      <div className="font-bold flex items-center gap-1 mt-0.5">
                        {systemStatus.keys.gemini ? (
                          <span className="text-emerald-600 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> সক্রিয় (Active)
                          </span>
                        ) : (
                          <span className="text-rose-600 flex items-center gap-1">
                            <XCircle className="w-3.5 h-3.5" /> অনুপস্থিত
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="p-2 bg-white rounded-lg border border-slate-200/60">
                      <div className="text-[11px] text-slate-400">Google Client ID</div>
                      <div className="font-bold flex items-center gap-1 mt-0.5">
                        {systemStatus.keys.googleClientId ? (
                          <span className="text-emerald-600 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> কনফিগারড
                          </span>
                        ) : (
                          <span className="text-amber-600 flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5" /> ঐচ্ছিক
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-500 pt-1 space-y-1 font-mono">
                    <div>অ্যাডমিন ইমেইল: {systemStatus.adminEmail}</div>
                    <div>মোট নিবন্ধিত ইউজার: {systemStatus.stats.totalUsers}</div>
                    <div>সংরক্ষিত মেসেজ সংখ্যা: {systemStatus.stats.totalMessages}</div>
                    <div>সক্রিয় রুটসমূহ: {systemStatus.routes.join(', ')}</div>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-400 p-3 bg-slate-50 rounded-xl text-center">
                  স্ট্যাটাস লোড করা হচ্ছে...
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
