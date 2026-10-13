export type RouteType = 'code' | 'image' | 'video' | 'analyze' | 'chat';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
  picture?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  meta?: string;
  image?: string;
  timestamp: number;
}

export interface ComputerAction {
  type: 'click' | 'double_click' | 'right_click' | 'type' | 'key' | 'scroll' | 'wait';
  x?: number;
  y?: number;
  text?: string;
  key?: string;
  dy?: number;
}

export interface ComputerStep {
  thought: string;
  action: ComputerAction | null;
  verdict: string;
}

export interface SystemStatusData {
  ok: boolean;
  service: string;
  currentTime: string;
  keys: {
    gemini: boolean;
    openrouter: boolean;
    groq: boolean;
    googleClientId: boolean;
  };
  adminEmail: string;
  stats: {
    totalUsers: number;
    totalMessages: number;
    cooledProvidersCount: number;
  };
  routes: string[];
}
