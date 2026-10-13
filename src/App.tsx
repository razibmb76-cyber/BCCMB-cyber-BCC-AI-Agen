import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from './components/Header';
import { ChatPanel } from './components/ChatPanel';
import { AuthModal } from './components/AuthModal';
import { ScreenShareModal } from './components/ScreenShareModal';
import { ComputerControlPanel } from './components/ComputerControlPanel';
import { DiagnosticModal } from './components/DiagnosticModal';
import { User, ChatMessage, RouteType } from './types';

function generateChatId(): string {
  const existing = localStorage.getItem('bcc_chat_id');
  if (existing && existing.length >= 8) return existing;
  const newId =
    'chat_' +
    (typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
      : Math.random().toString(36).slice(2, 12) + Date.now().toString(36));
  localStorage.setItem('bcc_chat_id', newId);
  return newId;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string>(() => sessionStorage.getItem('bcc_token') || '');
  const [googleClientId, setGoogleClientId] = useState<string>('');
  const [chatId, setChatId] = useState<string>(generateChatId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<RouteType | 'auto'>('auto');

  // Modal Visibility
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isScreenShareOpen, setIsScreenShareOpen] = useState(false);
  const [isComputerControlOpen, setIsComputerControlOpen] = useState(false);
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);

  // Screen Share Stream & Video ref
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [isAutoAnalyzing, setIsAutoAnalyzing] = useState(false);
  const hiddenVideoRef = useRef<HTMLVideoElement | null>(null);
  const autoTimerRef = useRef<any>(null);

  // Load Config and Session on mount
  useEffect(() => {
    async function init() {
      try {
        const res = await fetch('/api/config');
        const config = await res.json();
        setGoogleClientId(config.googleClientId || '');

        // If existing token, check current user
        const storedToken = sessionStorage.getItem('bcc_token');
        if (storedToken) {
          const meRes = await fetch('/api/me', {
            headers: { Authorization: `Bearer ${storedToken}` },
          });
          if (meRes.ok) {
            const data = await meRes.json();
            setUser(data.user);
            return;
          } else {
            sessionStorage.removeItem('bcc_token');
            setToken('');
          }
        }

        // Automatic quick sign-in in dev mode as admin if no session is set
        const devLoginRes = await fetch('/api/auth/dev-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'razibmb76@gmail.com',
            name: 'Razib (Admin)',
          }),
        });
        if (devLoginRes.ok) {
          const devData = await devLoginRes.json();
          setUser(devData.user);
          setToken(devData.token);
          sessionStorage.setItem('bcc_token', devData.token);
        }
      } catch (err) {
        console.error('Initialization error:', err);
      }
    }
    init();
  }, []);

  // Load chat history when user or chatId changes
  const loadHistory = useCallback(async () => {
    if (!token || !chatId) return;
    try {
      const res = await fetch(`/api/history?chat=${chatId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const rows = await res.json();
        if (Array.isArray(rows) && rows.length > 0) {
          setMessages(
            rows.map((r: any) => ({
              id: r.id,
              role: r.role,
              text: r.text,
              meta: r.meta,
              image: r.image,
              timestamp: r.timestamp || Date.now(),
            }))
          );
        } else {
          setMessages([]);
        }
      }
    } catch (e) {
      console.warn('Failed to load history:', e);
    }
  }, [token, chatId]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Capture frame from active screen sharing stream
  const captureScreenFrame = useCallback((): string | null => {
    if (!hiddenVideoRef.current || !screenStream) return null;
    const vid = hiddenVideoRef.current;
    if (!vid.videoWidth || !vid.videoHeight) return null;

    const maxDim = 1280;
    const scale = Math.min(1, maxDim / Math.max(vid.videoWidth, vid.videoHeight));
    const canvas = document.createElement('canvas');
    canvas.width = vid.videoWidth * scale;
    canvas.height = vid.videoHeight * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
  }, [screenStream]);

  // Start Screen Sharing
  const handleStartShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 5 },
      });
      setScreenStream(stream);

      if (!hiddenVideoRef.current) {
        hiddenVideoRef.current = document.createElement('video');
        hiddenVideoRef.current.muted = true;
        hiddenVideoRef.current.playsInline = true;
      }
      hiddenVideoRef.current.srcObject = stream;
      hiddenVideoRef.current.play().catch(() => {});

      stream.getVideoTracks()[0].onended = () => {
        handleStopShare();
      };
    } catch (err: any) {
      alert(`স্ক্রিন শেয়ার শুরু করা যায়নি: ${err.message}`);
    }
  };

  // Stop Screen Sharing
  const handleStopShare = () => {
    if (screenStream) {
      screenStream.getTracks().forEach((track) => track.stop());
    }
    setScreenStream(null);
    if (hiddenVideoRef.current) {
      hiddenVideoRef.current.srcObject = null;
    }
    if (autoTimerRef.current) {
      clearInterval(autoTimerRef.current);
      autoTimerRef.current = null;
    }
    setIsAutoAnalyzing(false);
  };

  // Send Message to Agent
  const handleSendMessage = async (text: string, imageBase64?: string) => {
    if (!token) {
      setIsAuthOpen(true);
      return;
    }

    const currentMsgId = 'msg_' + Math.random().toString(36).slice(2, 9);
    const userMsg: ChatMessage = {
      id: currentMsgId,
      role: 'user',
      text: text || '(ছবি বা স্ক্রিনশট)',
      image: imageBase64 ? `data:image/jpeg;base64,${imageBase64}` : undefined,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const historyPayload = messages.slice(-10).map((m) => ({
        role: m.role,
        text: m.text,
      }));

      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          prompt: text || 'এই ছবি বা স্ক্রিনশটটি বিশ্লেষণ করো',
          image_b64: imageBase64,
          mime: 'image/jpeg',
          history: historyPayload,
          chat_id: chatId,
          force: selectedRoute === 'auto' ? undefined : selectedRoute,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'AI উত্তর পাওয়া যায়নি');
      }

      const botMsg: ChatMessage = {
        id: 'bot_' + Math.random().toString(36).slice(2, 9),
        role: 'assistant',
        text: data.reply,
        meta: `${data.route} · ${data.agent} · ${data.model}`,
        image:
          data.type === 'image' && data.image_b64
            ? `data:${data.mime || 'image/jpeg'};base64,${data.image_b64}`
            : undefined,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: 'err_' + Math.random().toString(36).slice(2, 9),
        role: 'assistant',
        text: `সমস্যা হয়েছে: ${err.message}`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  // Instant Screen Frame Analyze
  const handleAnalyzeFrame = async (frameBase64: string, promptText?: string) => {
    await handleSendMessage(promptText || 'এই স্ক্রিনশটে কী দেখা যাচ্ছে বিস্তারিত বলো', frameBase64);
  };

  // Toggle Auto Analyze
  const handleToggleAutoAnalyze = (active: boolean) => {
    setIsAutoAnalyzing(active);
    if (autoTimerRef.current) {
      clearInterval(autoTimerRef.current);
      autoTimerRef.current = null;
    }
    if (active && screenStream) {
      autoTimerRef.current = setInterval(() => {
        const frame = captureScreenFrame();
        if (frame && !loading) {
          handleAnalyzeFrame(frame, 'বর্তমান স্ক্রিন বিশ্লেষণ');
        }
      }, 15000);
    }
  };

  // Clear Chat and Start New
  const handleClearChat = async () => {
    if (token && chatId) {
      try {
        await fetch(`/api/history?chat=${chatId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch (e) {
        // Ignore error
      }
    }
    const newId =
      'chat_' +
      (typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
        : Math.random().toString(36).slice(2, 12) + Date.now().toString(36));
    localStorage.setItem('bcc_chat_id', newId);
    setChatId(newId);
    setMessages([]);
  };

  // User Logout
  const handleLogout = () => {
    sessionStorage.removeItem('bcc_token');
    setToken('');
    setUser(null);
    handleStopShare();
    setMessages([]);
    setIsAuthOpen(false);
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-100">
      <Header
        user={user}
        onLogout={handleLogout}
        onOpenLogin={() => setIsAuthOpen(true)}
        onOpenScreenShare={() => setIsScreenShareOpen(true)}
        onOpenComputerControl={() => setIsComputerControlOpen(true)}
        onOpenDiagnostics={() => setIsDiagnosticsOpen(true)}
        selectedRoute={selectedRoute}
        onSelectRoute={setSelectedRoute}
      />

      <main className="flex-1 overflow-hidden flex flex-col relative max-w-6xl w-full mx-auto bg-white shadow-xs">
        <ChatPanel
          messages={messages}
          loading={loading}
          onSendMessage={handleSendMessage}
          onClearChat={handleClearChat}
          selectedRoute={selectedRoute}
          isScreenSharing={!!screenStream}
          onCaptureScreenFrame={captureScreenFrame}
        />
      </main>

      {/* Modals */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        googleClientId={googleClientId}
        onLoginSuccess={(loggedInUser, loggedInToken) => {
          setUser(loggedInUser);
          setToken(loggedInToken);
          sessionStorage.setItem('bcc_token', loggedInToken);
        }}
      />

      <ScreenShareModal
        isOpen={isScreenShareOpen}
        onClose={() => setIsScreenShareOpen(false)}
        stream={screenStream}
        onStartShare={handleStartShare}
        onStopShare={handleStopShare}
        onAnalyzeFrame={handleAnalyzeFrame}
        captureFrame={captureScreenFrame}
        isAutoAnalyzing={isAutoAnalyzing}
        onToggleAutoAnalyze={handleToggleAutoAnalyze}
      />

      <ComputerControlPanel
        isOpen={isComputerControlOpen}
        onClose={() => setIsComputerControlOpen(false)}
        token={token}
      />

      <DiagnosticModal
        isOpen={isDiagnosticsOpen}
        onClose={() => setIsDiagnosticsOpen(false)}
        user={user}
        token={token}
      />
    </div>
  );
}
