import React, { useEffect, useRef, useState } from 'react';
import { X, ShieldCheck, Mail, AlertCircle, ArrowRight, Sparkles } from 'lucide-react';
import { User } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: User, token: string) => void;
  googleClientId: string;
}

declare global {
  interface Window {
    google?: any;
  }
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  googleClientId,
}) => {
  const googleBtnRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quickEmail, setQuickEmail] = useState('razibmb76@gmail.com');
  const [quickName, setQuickName] = useState('Razib (Admin)');

  // Initialize Google Identity Services
  useEffect(() => {
    if (!isOpen) return;

    const handleCredentialResponse = async (response: any) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/auth/google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ credential: response.credential }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Google লগইন যাচাই ব্যর্থ হয়েছে');
        }
        onLoginSuccess(data.user, response.credential);
        onClose();
      } catch (err: any) {
        setError(err.message || 'লগইন প্রক্রিয়া সম্পন্ন করা সম্ভব হয়নি');
      } finally {
        setLoading(false);
      }
    };

    if (googleClientId && window.google?.accounts?.id && googleBtnRef.current) {
      try {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: handleCredentialResponse,
        });
        window.google.accounts.id.renderButton(googleBtnRef.current, {
          theme: 'outline',
          size: 'large',
          text: 'signin_with',
          shape: 'rectangular',
          width: 300,
        });
      } catch (e) {
        console.warn('Google GSI render error:', e);
      }
    }
  }, [isOpen, googleClientId, onClose, onLoginSuccess]);

  const handleDevLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/dev-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: quickEmail,
          name: quickName,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'লগইন ব্যর্থ হয়েছে');
      }
      onLoginSuccess(data.user, data.token);
      onClose();
    } catch (err: any) {
      setError(err.message || 'লগইন সম্ভব হয়নি');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">BCC AI অ্যাকাউন্টে প্রবেশ</h3>
              <p className="text-xs text-slate-500">নিরাপদ প্রমাণীকরণ ও চ্যাট সেভ</p>
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

        {/* Content */}
        <div className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-700">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Google Official Button */}
          <div className="flex flex-col items-center justify-center p-4 border border-dashed border-slate-200 rounded-xl bg-slate-50/60">
            <span className="text-xs font-medium text-slate-600 mb-3">Google অ্যাকাউন্ট দিয়ে সাইন-ইন:</span>
            <div ref={googleBtnRef} className="min-h-[44px] flex items-center justify-center" />
            {!googleClientId && (
              <p className="text-[11px] text-amber-700 mt-2 text-center">
                GOOGLE_CLIENT_ID যোগ করা না থাকলে নিচের টেস্ট লগইন ব্যবহার করুন
              </p>
            )}
          </div>

          <div className="relative flex items-center justify-center">
            <div className="border-t border-slate-200 w-full" />
            <span className="bg-white px-3 text-[11px] font-medium text-slate-400 uppercase tracking-wider absolute">
              অথবা সরাসরি প্রবেশ (ডেভেলপার / অ্যাডমিন)
            </span>
          </div>

          {/* Quick Sign-in Form */}
          <form onSubmit={handleDevLogin} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">ইমেইল ঠিকানা</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="email"
                  required
                  value={quickEmail}
                  onChange={(e) => setQuickEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">ব্যবহারকারীর নাম</label>
              <input
                type="text"
                required
                value={quickName}
                onChange={(e) => setQuickName(e.target.value)}
                placeholder="আপনার নাম"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
              />
            </div>

            <div className="pt-1">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2"
              >
                {loading ? (
                  <span>প্রক্রিয়াকরণ হচ্ছে...</span>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>প্রবেশ করুন ({quickEmail === 'razibmb76@gmail.com' ? 'অ্যাডমিন মোড' : 'সরাসরি'})</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </form>

          <p className="text-[11px] text-slate-400 text-center leading-relaxed">
            চ্যাটের ইতিহাস আপনার অ্যাকাউন্টে সুরক্ষিতভাবে সংরক্ষিত থাকে এবং যেকোনো ডিভাইস থেকে লগইন করলে পাওয়া যাবে।
          </p>
        </div>
      </div>
    </div>
  );
};
