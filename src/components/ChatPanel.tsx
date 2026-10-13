import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Paperclip,
  Image as ImageIcon,
  Check,
  Copy,
  Trash2,
  Sparkles,
  Bot,
  User as UserIcon,
  Download,
  AlertCircle,
  Monitor
} from 'lucide-react';
import { ChatMessage, RouteType } from '../types';

interface ChatPanelProps {
  messages: ChatMessage[];
  loading: boolean;
  onSendMessage: (text: string, imageBase64?: string) => Promise<void>;
  onClearChat: () => void;
  selectedRoute: RouteType | 'auto';
  isScreenSharing: boolean;
  onCaptureScreenFrame: () => string | null;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  loading,
  onSendMessage,
  onClearChat,
  selectedRoute,
  isScreenSharing,
  onCaptureScreenFrame,
}) => {
  const [inputText, setInputText] = useState('');
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [attachedImageName, setAttachedImageName] = useState<string | null>(null);
  const [includeScreenOnSend, setIncludeScreenOnSend] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // Handle image upload with client-side resize to 1280px max for speed
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAttachedImageName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 1280;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const compressed = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
          setAttachedImage(compressed);
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputText.trim();
    let imgToSend = attachedImage;

    if (!imgToSend && includeScreenOnSend && isScreenSharing) {
      const frame = onCaptureScreenFrame();
      if (frame) {
        imgToSend = frame;
      }
    }

    if ((!text && !imgToSend) || loading) return;

    setInputText('');
    setAttachedImage(null);
    setAttachedImageName(null);

    await onSendMessage(text, imgToSend || undefined);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleStarterPrompt = (promptText: string) => {
    setInputText(promptText);
    textareaRef.current?.focus();
  };

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center max-w-xl mx-auto text-center py-12 px-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-200 mb-4">
              <Bot className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">স্বাগতম BCC AI Agent-এ!</h2>
            <p className="text-sm text-slate-600 mb-8 leading-relaxed">
              বাংলা ও ইংরেজি ভাষার সর্বাধুনিক মাল্টি-মডেল সহকারী। কোডিং, ইমেজ ক্রিয়েশন, ভিডিও স্টোরিবোর্ড,
              স্ক্রিন বিশ্লেষণ বা যেকোনো প্রশ্নের উত্তর পাওয়ার জন্য নিচের অপশন থেকে শুরু করুন।
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full text-left">
              <button
                type="button"
                onClick={() =>
                  handleStarterPrompt('একটি আধুনিক React + Tailwind কাউন্টার কম্পোনেন্ট এবং সুন্দর এনিমেশন লিখে দাও')
                }
                className="p-3.5 bg-white hover:bg-slate-50 rounded-xl border border-slate-200 hover:border-blue-300 text-xs text-slate-800 transition-all shadow-2xs group"
              >
                <div className="font-semibold text-blue-700 flex items-center gap-1.5 mb-1">
                  <span>💻 কোডিং সহায়তা</span>
                </div>
                <div className="text-slate-500 line-clamp-2">
                  "একটি আধুনিক React + Tailwind কাউন্টার কম্পোনেন্ট লিখে দাও"
                </div>
              </button>

              <button
                type="button"
                onClick={() =>
                  handleStarterPrompt(
                    'সবুজ শ্যামল বাংলাদেশের সুন্দর একটি ভবিষ্যৎ হাই-টেক গ্রিন সিটির ছবি কনসেপ্ট আর্ট তৈরি করো'
                  )
                }
                className="p-3.5 bg-white hover:bg-slate-50 rounded-xl border border-slate-200 hover:border-blue-300 text-xs text-slate-800 transition-all shadow-2xs group"
              >
                <div className="font-semibold text-indigo-700 flex items-center gap-1.5 mb-1">
                  <span>🎨 ইমেজ জেনারেশন</span>
                </div>
                <div className="text-slate-500 line-clamp-2">
                  "ভবিষ্যতের হাই-টেক গ্রিন বাংলাদেশ সিটির ছবি কনসেপ্ট আর্ট তৈরি করো"
                </div>
              </button>

              <button
                type="button"
                onClick={() =>
                  handleStarterPrompt(
                    'ডিজিটাল নিরাপত্তা ও ফিশিং সচেতনতার ওপর একটি ১ মিনিটের সোশ্যাল মিডিয়া ভিডিও স্ক্রিপ্ট ও প্রম্পট দাও'
                  )
                }
                className="p-3.5 bg-white hover:bg-slate-50 rounded-xl border border-slate-200 hover:border-blue-300 text-xs text-slate-800 transition-all shadow-2xs group"
              >
                <div className="font-semibold text-purple-700 flex items-center gap-1.5 mb-1">
                  <span>🎬 ভিডিও স্টোরিবোর্ড</span>
                </div>
                <div className="text-slate-500 line-clamp-2">
                  "সাইবার সিকিউরিটি সচেতনতার ১ মিনিটের ভিডিও স্টোরিবোর্ড ও সিন প্রম্পট"
                </div>
              </button>

              <button
                type="button"
                onClick={() =>
                  handleStarterPrompt('এই স্ক্রিনশট বা ডেটাটি পর্যালোচনা করে গুরুত্বপূর্ণ ৫টি পয়েন্ট তুলে ধরো')
                }
                className="p-3.5 bg-white hover:bg-slate-50 rounded-xl border border-slate-200 hover:border-blue-300 text-xs text-slate-800 transition-all shadow-2xs group"
              >
                <div className="font-semibold text-emerald-700 flex items-center gap-1.5 mb-1">
                  <span>📊 ভিজ্যুয়াল বিশ্লেষণ</span>
                </div>
                <div className="text-slate-500 line-clamp-2">
                  "স্ক্রিনশট বা ছবি সংযুক্ত করে স্বয়ংক্রিয় এআই বিশ্লেষণ নিন"
                </div>
              </button>
            </div>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id || index}
                className={`flex gap-3 max-w-3xl ${isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
              >
                {/* Avatar */}
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-semibold ${
                    isUser
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'bg-white border border-slate-200 text-blue-700 shadow-2xs'
                  }`}
                >
                  {isUser ? <UserIcon className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                {/* Message Bubble */}
                <div
                  className={`flex flex-col space-y-1.5 max-w-[85%] sm:max-w-[78%] ${
                    isUser ? 'items-end' : 'items-start'
                  }`}
                >
                  {/* Clean unboxed metadata separator without pill capsules */}
                  {!isUser && msg.meta && (
                    <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5 px-1">
                      <span>{msg.meta}</span>
                    </div>
                  )}

                  <div
                    className={`rounded-2xl px-4 py-3 text-sm leading-relaxed overflow-hidden break-words ${
                      isUser
                        ? 'bg-blue-600 text-white shadow-xs rounded-tr-xs'
                        : 'bg-white border border-slate-200 text-slate-800 shadow-xs rounded-tl-xs'
                    }`}
                  >
                    {/* Attached or Generated Image */}
                    {msg.image && (
                      <div className="mb-3 rounded-lg overflow-hidden border border-slate-200/50 max-w-md bg-slate-900/5">
                        <img
                          src={msg.image}
                          alt="AI generated or uploaded"
                          className="w-full h-auto object-contain max-h-[400px]"
                        />
                        {!isUser && (
                          <div className="p-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
                            <span className="text-[11px] text-slate-500 font-medium">জেনারেটেড আর্টওয়ার্ক</span>
                            <a
                              href={msg.image}
                              download="bcc-ai-image.png"
                              className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-[11px] font-semibold"
                            >
                              <Download className="w-3.5 h-3.5" /> ডাউনলোড
                            </a>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Formatted Text Content */}
                    <div className="whitespace-pre-wrap">{msg.text}</div>

                    {/* Action Bar for Bot Message */}
                    {!isUser && (
                      <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-end gap-2 text-[11px] text-slate-400">
                        <button
                          type="button"
                          onClick={() => copyToClipboard(msg.text, msg.id || String(index))}
                          className="flex items-center gap-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 px-2 py-0.5 rounded transition-colors"
                        >
                          {copiedId === (msg.id || String(index)) ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span className="text-emerald-600">কপি সম্পন্ন</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>কপি করুন</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Loading Indicator */}
        {loading && (
          <div className="flex gap-3 max-w-2xl mr-auto animate-in fade-in duration-200">
            <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-blue-600 flex items-center justify-center shrink-0 shadow-2xs">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-xs px-4 py-3 shadow-xs flex items-center gap-3">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></div>
              </div>
              <span className="text-xs text-slate-500 font-medium">BCC AI চিন্তা করছে ও উত্তর প্রস্তুত করছে...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-slate-200 bg-white p-3 md:p-4">
        <div className="max-w-4xl mx-auto space-y-2">
          {/* Active Attachments / Screen Share options */}
          <div className="flex items-center justify-between text-xs text-slate-500 px-1">
            <div className="flex items-center gap-3">
              {attachedImageName && (
                <div className="flex items-center gap-1.5 text-blue-700 bg-blue-50 px-2 py-1 rounded-md border border-blue-200">
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span className="truncate max-w-[200px]">{attachedImageName}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setAttachedImage(null);
                      setAttachedImageName(null);
                    }}
                    className="ml-1 text-slate-400 hover:text-slate-600"
                  >
                    ×
                  </button>
                </div>
              )}

              {isScreenSharing && (
                <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 select-none">
                  <input
                    type="checkbox"
                    checked={includeScreenOnSend}
                    onChange={(e) => setIncludeScreenOnSend(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <Monitor className="w-3.5 h-3.5 text-blue-600" />
                  <span>প্রশ্নের সাথে বর্তমান স্ক্রিনশট যোগ করো</span>
                </label>
              )}
            </div>

            {messages.length > 0 && (
              <button
                type="button"
                onClick={onClearChat}
                className="flex items-center gap-1 text-slate-400 hover:text-rose-600 transition-colors ml-auto"
                title="নতুন চ্যাট শুরু করুন (আগের কথোপকথন মুছবে)"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>নতুন চ্যাট</span>
              </button>
            )}
          </div>

          {/* Form with Auto-expanding Textarea */}
          <form onSubmit={handleSubmit} className="flex items-end gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2.5 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors shrink-0"
              title="ছবি বা স্ক্রিনশট সংযুক্ত করুন (মোবাইলে ক্যামেরা)"
            >
              <Paperclip className="w-5 h-5" />
            </button>

            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  selectedRoute === 'code'
                    ? 'কোডিং প্রশ্ন বা নির্দেশ লিখুন (যেমন: পাইথনে ফাইল রিড/রাইট স্ক্রিপ্ট)...'
                    : selectedRoute === 'image'
                    ? 'কোন ধরনের ছবি তৈরি করতে চান বিস্তারিত লিখুন...'
                    : selectedRoute === 'video'
                    ? 'ভিডিওর বিষয়বস্তু বা কনসেপ্ট লিখুন...'
                    : 'এখানে আপনার প্রশ্ন বা নির্দেশ বাংলায় লিখুন... (Enter চাপলে সেন্ড হবে)'
                }
                rows={2}
                maxLength={6000}
                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none max-h-40 bg-white"
              />
            </div>

            <button
              type="submit"
              disabled={loading || (!inputText.trim() && !attachedImage)}
              className="p-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl font-bold transition-all shrink-0 shadow-xs flex items-center justify-center"
              title="পাঠান"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
