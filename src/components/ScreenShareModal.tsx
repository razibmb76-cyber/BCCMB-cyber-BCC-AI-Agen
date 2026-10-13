import React, { useState, useEffect, useRef } from 'react';
import { X, Play, Square, Eye, RefreshCw, AlertTriangle, CheckCircle, Monitor } from 'lucide-react';

interface ScreenShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  stream: MediaStream | null;
  onStartShare: () => Promise<void>;
  onStopShare: () => void;
  onAnalyzeFrame: (frameBase64: string, promptText?: string) => Promise<void>;
  captureFrame: () => string | null;
  isAutoAnalyzing: boolean;
  onToggleAutoAnalyze: (active: boolean) => void;
}

export const ScreenShareModal: React.FC<ScreenShareModalProps> = ({
  isOpen,
  onClose,
  stream,
  onStartShare,
  onStopShare,
  onAnalyzeFrame,
  captureFrame,
  isAutoAnalyzing,
  onToggleAutoAnalyze,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (videoRef.current) {
      if (stream) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.srcObject = null;
      }
    }
  }, [stream, isOpen]);

  const handleInstantAnalyze = async () => {
    setError(null);
    const frame = captureFrame();
    if (!frame) {
      setError('স্ক্রিন ফ্রেম ক্যাপচার করা সম্ভব হয়নি। আগে স্ক্রিন শেয়ার শুরু করুন।');
      return;
    }
    setAnalyzing(true);
    try {
      await onAnalyzeFrame(frame, 'এই স্ক্রিনে এখন কী হচ্ছে? স্পষ্টভাবে এবং পয়েন্ট আকারে বিশ্লেষণ করো।');
      onClose();
    } catch (err: any) {
      setError(err.message || 'বিশ্লেষণ ব্যর্থ হয়েছে');
    } finally {
      setAnalyzing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-2">
            <Monitor className="w-5 h-5 text-blue-600" />
            <div>
              <h3 className="text-base font-bold text-slate-900">লাইভ স্ক্রিন শেয়ার ও বিশ্লেষণ</h3>
              <p className="text-xs text-slate-500">আপনার ডেস্কটপ বা ব্রাউজার স্ক্রিন এআই দিয়ে পর্যবেক্ষণ করুন</p>
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
        <div className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Video Preview Canvas */}
          <div className="relative rounded-xl overflow-hidden bg-slate-900 aspect-video flex items-center justify-center border border-slate-800">
            {stream ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="text-center p-6 text-slate-400">
                <Monitor className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p className="text-sm font-medium">স্ক্রিন শেয়ার বর্তমানে বন্ধ রয়েছে</p>
                <p className="text-xs text-slate-500 mt-1">নিচের "শেয়ার শুরু করুন" বাটনে ক্লিক করুন</p>
              </div>
            )}

            {stream && (
              <div className="absolute top-3 left-3 bg-emerald-500/90 text-white text-[11px] font-bold px-2 py-0.5 rounded flex items-center gap-1.5 backdrop-blur-xs">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                লাইভ শেয়ার চলছে
              </div>
            )}
          </div>

          {/* Action Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2">
              {!stream ? (
                <button
                  type="button"
                  onClick={onStartShare}
                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>শেয়ার শুরু করুন</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onStopShare}
                  className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>শেয়ার বন্ধ করুন</span>
                </button>
              )}

              {stream && (
                <button
                  type="button"
                  disabled={analyzing}
                  onClick={handleInstantAnalyze}
                  className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all shadow-xs"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>{analyzing ? 'বিশ্লেষণ হচ্ছে...' : 'এখনকার স্ক্রিন বিশ্লেষণ'}</span>
                </button>
              )}
            </div>

            {stream && (
              <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isAutoAnalyzing}
                  onChange={(e) => onToggleAutoAnalyze(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>অটো-বিশ্লেষণ (প্রতি ১৫ সেকেন্ডে)</span>
              </label>
            )}
          </div>

          {/* Security & Disclaimer Notice */}
          <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-[11px] text-amber-800 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
            <p className="leading-relaxed">
              <strong>নিরাপত্তা সতর্কতা:</strong> পাসওয়ার্ড, ব্যাংকিং তথ্য, বা ব্যক্তিগত সংবেদনশীল তথ্য স্ক্রিনে
              রাখবেন না। স্ক্রিনশট শুধুমাত্র বর্তমান সেশনের বিশ্লেষণের উদ্দেশ্যে এআই প্রক্রিয়ায় প্রেরণ করা হয়।
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
