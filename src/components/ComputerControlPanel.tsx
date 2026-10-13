import React, { useState, useRef } from 'react';
import {
  X,
  Laptop,
  Play,
  Square,
  Check,
  AlertOctagon,
  Activity,
  Terminal,
  FileText,
  ShieldAlert,
  ChevronRight,
  Info
} from 'lucide-react';
import { ComputerStep, ComputerAction } from '../types';

interface ComputerControlPanelProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
}

export const ComputerControlPanel: React.FC<ComputerControlPanelProps> = ({
  isOpen,
  onClose,
  token,
}) => {
  const [helperUrl, setHelperUrl] = useState('http://127.0.0.1:8765');
  const [helperToken, setHelperToken] = useState('');
  const [pingStatus, setPingStatus] = useState<string | null>(null);
  const [goal, setGoal] = useState('');
  const [manualApproval, setManualApproval] = useState(true);
  const [isRunning, setIsRunning] = useState(false);

  // Approval step request
  const [pendingApproval, setPendingApproval] = useState<{
    desc: string;
    action: ComputerAction;
    thought: string;
    resolve: (approved: boolean) => void;
  } | null>(null);

  const [stepLogs, setStepLogs] = useState<string[]>([]);
  const [finalReport, setFinalReport] = useState<string | null>(null);

  const stopRequestedRef = useRef(false);

  // Call local helper running on PC
  const callHelper = async (path: string, body?: any) => {
    const res = await fetch(`${helperUrl}${path}`, {
      method: body ? 'POST' : 'GET',
      headers: {
        'X-Token': helperToken,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      throw new Error(`হেল্পার HTTP ${res.status}${res.status === 401 ? ' (ভুল টোকেন)' : ''}`);
    }
    return res.json();
  };

  const handlePing = async () => {
    setPingStatus('সংযোগ পরীক্ষা করা হচ্ছে...');
    try {
      const data = await callHelper('/ping');
      setPingStatus(`সংযুক্ত: স্ক্রিন রেজোলিউশন ${data.w || '1920'}×${data.h || '1080'}`);
    } catch (err: any) {
      setPingStatus(`ব্যর্থ: ${err.message} (লোকাল helper চালু আছে তো?)`);
    }
  };

  const formatActionDescription = (action: ComputerAction | null) => {
    if (!action) return 'কোনো অ্যাকশন নেই';
    const typeMap: Record<string, string> = {
      click: 'ক্লিক',
      double_click: 'ডাবল-ক্লিক',
      right_click: 'রাইট-ক্লিক',
      scroll: 'স্ক্রল',
      wait: 'অপেক্ষা',
      type: 'টাইপ',
      key: 'কী প্রেস',
    };
    const t = typeMap[action.type] || action.type;
    const details = [
      action.text ? `"${action.text}"` : '',
      action.key ? `[${action.key}]` : '',
      action.x != null && action.y != null ? `(${action.x}, ${action.y})` : '',
      action.dy != null ? `dy: ${action.dy}` : '',
    ].filter(Boolean);
    return `${t} ${details.join(' ')}`;
  };

  const requestApproval = (action: ComputerAction, thought: string): Promise<boolean> => {
    return new Promise((resolve) => {
      if (!manualApproval) {
        return resolve(true);
      }
      setPendingApproval({
        desc: formatActionDescription(action),
        action,
        thought,
        resolve: (ans: boolean) => {
          setPendingApproval(null);
          resolve(ans);
        },
      });
    });
  };

  const handleStop = () => {
    stopRequestedRef.current = true;
    if (pendingApproval) {
      pendingApproval.resolve(false);
    }
    setIsRunning(false);
  };

  const handleExecute = async () => {
    if (!goal.trim() || isRunning) return;

    setIsRunning(true);
    stopRequestedRef.current = false;
    setStepLogs([]);
    setFinalReport(null);

    const MAX_STEPS = 12;
    const RETRY_LIMIT = 2;
    const executedSteps: ComputerStep[] = [];
    let fails = 0;
    let finalStatus = 'step_limit';

    const addLog = (msg: string) => {
      setStepLogs((prev) => [...prev, msg]);
    };

    try {
      addLog(`🚀 কাজ শুরু: "${goal}"`);

      for (let i = 0; i < MAX_STEPS; i++) {
        if (stopRequestedRef.current) {
          finalStatus = 'stopped_by_user';
          addLog('⛔ ব্যবহারকারী কর্তৃক কাজ স্থগিত করা হয়েছে');
          break;
        }

        // 1. Capture screenshot from local helper
        addLog(`📸 ধাপ ${i + 1}: বর্তমান স্ক্রিনশট নেওয়া হচ্ছে...`);
        let shotB64: string;
        try {
          const shotData = await callHelper('/screenshot');
          shotB64 = shotData.b64;
        } catch (e: any) {
          // Fallback or demo simulation if testing without physical local helper
          addLog(`⚠ লোকাল স্ক্রিনশট পাওয়া যায়নি: ${e.message}`);
          addLog('তথ্য: পিসিতে local_helper.py রান করুন। ডেমো সিমুলেশনে টেস্ট করা হচ্ছে...');
          shotB64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
        }

        // 2. Call backend planner (/api/computer/step)
        const stepRes = await fetch('/api/computer/step', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            goal,
            screenshot_b64: shotB64,
            steps: executedSteps,
          }),
        });

        const planData = await stepRes.json();
        if (!stepRes.ok) {
          throw new Error(planData.error || 'প্ল্যানার ত্রুটি');
        }

        if (executedSteps.length > 0) {
          executedSteps[executedSteps.length - 1].verdict = planData.verdict;
        }

        if (planData.verdict === 'failed') {
          fails++;
          addLog(`↺ পূর্ববর্তী ধাপ ব্যর্থ হয়েছে (ব্যর্থতা ${fails}/${RETRY_LIMIT})`);
          if (fails > RETRY_LIMIT) {
            finalStatus = 'failed';
            break;
          }
        } else if (planData.verdict === 'ok') {
          fails = 0;
        }

        addLog(`🧠 চিন্তা (${i + 1}): ${planData.thought}`);

        if (planData.status !== 'continue') {
          finalStatus = planData.status;
          addLog(`🏁 সমাপ্তি স্ট্যাটাস: ${planData.status}`);
          break;
        }

        if (!planData.action) {
          finalStatus = 'done';
          break;
        }

        // 3. Human in the loop approval
        const approved = await requestApproval(planData.action, planData.thought);
        if (!approved) {
          finalStatus = 'stopped_by_user';
          addLog('⛔ ব্যবহারকারী এই ধাপটি বাতিল করেছেন');
          break;
        }

        // 4. Act on helper
        addLog(`⚡ প্রয়োগ: ${formatActionDescription(planData.action)}`);
        try {
          await callHelper('/act', planData.action);
        } catch (e: any) {
          addLog(`⚠ helper /act ত্রুটি: ${e.message}`);
        }

        executedSteps.push({
          thought: planData.thought,
          action: planData.action,
          verdict: 'none',
        });

        // Delay between steps
        await new Promise((r) => setTimeout(r, manualApproval ? 1200 : 3500));
      }
    } catch (err: any) {
      finalStatus = 'error';
      addLog(`❌ ত্রুটি: ${err.message}`);
    }

    // 5. Generate final report
    addLog('📝 চূড়ান্ত কাজের রিপোর্ট প্রস্তুত করা হচ্ছে...');
    try {
      const repRes = await fetch('/api/computer/report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          goal,
          status: finalStatus,
          steps: executedSteps,
        }),
      });
      const repData = await repRes.json();
      setFinalReport(repData.report || 'রিপোর্ট তৈরি সম্পন্ন');
    } catch (err: any) {
      setFinalReport(`রিপোর্ট তৈরিতে সমস্যা: ${err.message}`);
    }

    setIsRunning(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
              <Laptop className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">কম্পিউটার কন্ট্রোল ও অটোমেশন</h3>
                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded">
                  অ্যাডমিন মোড
                </span>
              </div>
              <p className="text-xs text-slate-500">স্ক্রিনশট দেখে সিদ্ধান্ত নেওয়া ও পিসিতে স্বয়ংক্রিয় অ্যাকশন</p>
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

        {/* Scrollable Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Helper Connection Info */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
              <span className="flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-indigo-600" />
                লোকাল ব্রিজ কনফিগারেশন (local_helper.py)
              </span>
              <button
                type="button"
                onClick={handlePing}
                className="text-indigo-600 hover:text-indigo-800 font-bold"
              >
                সংযোগ পরীক্ষা করুন
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <input
                type="text"
                value={helperUrl}
                onChange={(e) => setHelperUrl(e.target.value)}
                placeholder="http://127.0.0.1:8765"
                className="px-3 py-1.5 border border-slate-200 rounded-lg bg-white"
              />
              <input
                type="text"
                value={helperToken}
                onChange={(e) => setHelperToken(e.target.value)}
                placeholder="হেল্পার সিকিউরিটি টোকেন (ঐচ্ছিক)"
                className="px-3 py-1.5 border border-slate-200 rounded-lg bg-white"
              />
            </div>

            {pingStatus && (
              <div className="text-[11px] text-slate-600 flex items-center gap-1 font-mono">
                <Info className="w-3 h-3 text-indigo-500" />
                <span>{pingStatus}</span>
              </div>
            )}
          </div>

          {/* Goal & Task Input */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-800">
              কম্পিউটারকে কী করতে নির্দেশ দিতে চান?
            </label>
            <textarea
              rows={2}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              disabled={isRunning}
              placeholder="উদাহরণ: নোটপ্যাড খুলে 'BCC AI Agent স্বাগতম' লিখে সেভ করো"
              className="w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
            />

            {/* Quick Templates */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              <span className="text-[11px] text-slate-400 font-medium self-center mr-1">দ্রুত টেমপ্লেট:</span>
              {[
                "নোটপ্যাড খুলে 'বাংলাদেশ' লেখো",
                "ব্রাউজার খুলে গুগলে সার্চ করো",
                "সিস্টেম ক্যালকুলেটর ওপেন করো",
              ].map((tmpl) => (
                <button
                  key={tmpl}
                  type="button"
                  onClick={() => setGoal(tmpl)}
                  className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] rounded transition-colors"
                >
                  {tmpl}
                </button>
              ))}
            </div>
          </div>

          {/* Execution Settings & Trigger */}
          <div className="flex items-center justify-between gap-3 pt-2">
            <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={manualApproval}
                onChange={(e) => setManualApproval(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>প্রতিটি পদক্ষেপ আমি নিজ হাতে অনুমোদন করব (নিরাপদ মোড)</span>
            </label>

            <div className="flex items-center gap-2">
              {isRunning && (
                <button
                  type="button"
                  onClick={handleStop}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-xs"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>স্থগিত করো</span>
                </button>
              )}

              <button
                type="button"
                disabled={isRunning || !goal.trim()}
                onClick={handleExecute}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-xs"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{isRunning ? 'অটোমেশন চলছে...' : 'শুরু করুন'}</span>
              </button>
            </div>
          </div>

          {/* Human in the loop Approval Prompt Modal */}
          {pendingApproval && (
            <div className="p-4 bg-indigo-50 border-2 border-indigo-500 rounded-xl space-y-3 animate-in fade-in duration-150">
              <div className="flex items-start gap-2.5">
                <ShieldAlert className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="text-xs font-bold text-indigo-950 uppercase tracking-wide">
                    পদক্ষেপ অনুমোদন অনুরোধ
                  </h4>
                  <p className="text-xs text-indigo-800 mt-1">
                    <strong>প্রস্তাবিত অ্যাকশন:</strong> {pendingApproval.desc}
                  </p>
                  <p className="text-[11px] text-indigo-600 italic mt-0.5">
                    "AI যুক্তি: {pendingApproval.thought}"
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => pendingApproval.resolve(false)}
                  className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-100 transition-colors"
                >
                  ✖ বাতিল করো
                </button>
                <button
                  type="button"
                  onClick={() => pendingApproval.resolve(true)}
                  className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 shadow-xs transition-colors flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>✔ অনুমোদন দিন</span>
                </button>
              </div>
            </div>
          )}

          {/* Execution Step Logs */}
          {stepLogs.length > 0 && (
            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                <Terminal className="w-3.5 h-3.5 text-slate-500" />
                পদক্ষেপ লগ:
              </span>
              <div className="p-3 bg-slate-900 text-slate-100 rounded-xl font-mono text-[11px] max-h-48 overflow-y-auto space-y-1">
                {stepLogs.map((log, idx) => (
                  <div key={idx} className="leading-relaxed">
                    {log}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Final Report */}
          {finalReport && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
              <span className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-emerald-600" />
                চূড়ান্ত কাজের রিপোর্ট:
              </span>
              <div className="text-xs text-emerald-950 whitespace-pre-wrap leading-relaxed font-sans">
                {finalReport}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
