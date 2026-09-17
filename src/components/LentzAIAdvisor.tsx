'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Sparkles, Activity, CheckCircle, AlertTriangle, HelpCircle, ArrowRight, Bot, MessageSquare, Send, Maximize2, Minimize2, X } from 'lucide-react';
import { TuneSession, BarrelProfile, AmmoLot, EnvironmentalConditions } from '@/types';
import { analyzeHarmonics, calculateThermalOffset, calculateAllPurdyModes, velocityToStartingClick, chaconReferenceNumber } from '@/lib/ballistics';
import { generateExpertResponse, getSmartQuickAsks, getThinkingLabel, ExpertContext } from '@/lib/tunerExpertEngine';
import { VoiceInputButton } from '@/components/VoiceInputButton';

interface LentzAIAdvisorProps {
  session: TuneSession;
  barrel?: BarrelProfile;
  ammo?: AmmoLot;
  onApplyClick: (click: number) => void;
  isEasyMode?: boolean;
  onClose?: () => void;
  advisorOpenSignal?: number;
  currentClick?: number;
  onUpdateEnvironment?: (env: EnvironmentalConditions) => void;
}

interface AIChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  actions?: { label: string; clickValue?: number }[];
}

export const LentzAIAdvisor: React.FC<LentzAIAdvisorProps> = ({
  session,
  barrel,
  ammo,
  onApplyClick,
  isEasyMode = false,
  onClose,
  advisorOpenSignal,
  currentClick = 13,
  onUpdateEnvironment,
}) => {
  const [messages, setMessages] = useState<AIChatMessage[]>([]);
  const [inputQuery, setInputQuery] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingLabel, setThinkingLabel] = useState('Analyzing...');
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [quickAsks, setQuickAsks] = useState<string[]>([]);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fullScreenInputRef = useRef<HTMLInputElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);

  // Build the expert context
  const expertContext: ExpertContext = {
    session,
    barrel,
    ammo,
    currentClick,
  };

  // Smart initial greeting — context-aware
  useEffect(() => {
    const runs = session.runs || [];
    const ha = runs.length > 0 ? analyzeHarmonics(runs) : null;

    let statusLine = '';
    if (ha && runs.length > 0) {
      statusLine = `Your sweet spot is at Click ${ha.sweetSpotClick} with ${ha.minVerticalInches}" vertical across ${runs.length} test runs. Current tuner position: Click ${currentClick}.`;
    } else {
      statusLine = 'No test runs recorded yet — I can calculate your starting click using the Purdy Method when you\'re ready.';
    }

    const greeting: AIChatMessage = {
      id: 'init-1',
      sender: 'assistant',
      text: `Hello! I'm your **Lentz Precision Ballistics & Harmonic Advisor**. I'm actively monitoring your **${barrel?.name || 'custom rimfire rifle'}** shooting **${ammo?.brand || 'Lapua'} ${ammo?.model || 'Center-X'}** (Lot #${ammo?.lotNumber || '—'}).\n\n${statusLine}\n\nI can fetch **live weather data**, compute thermal drift, analyze your harmonic nodes, and help you prep for matches. What would you like to know?`,
      timestamp: 'Just now',
      actions: [
        { label: 'What\'s the weather right now?' },
        { label: 'Diagnose Sweet Spot Quality' },
        { label: 'What click should I start at?' },
      ],
    };

    setMessages([greeting]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Compute smart Quick Ask suggestions
  useEffect(() => {
    setQuickAsks(getSmartQuickAsks(expertContext));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.environment.tempF, session.environment.windSpeedMph, session.runs?.length, currentClick]);

  // Reliable bottom scroll
  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    const t = setTimeout(scrollToBottom, 60);
    return () => clearTimeout(t);
  }, [messages, isThinking, isFullScreen]);

  // Re-scroll on iOS virtual keyboard resize
  useEffect(() => {
    if (!isFullScreen) return;
    const vv = window.visualViewport;
    if (!vv) return;
    const onViewportResize = () => {
      setTimeout(scrollToBottom, 60);
    };
    vv.addEventListener('resize', onViewportResize);
    return () => vv.removeEventListener('resize', onViewportResize);
  }, [isFullScreen]);

  const handleExitChat = useCallback(() => {
    setIsFullScreen(false);
    if (onClose) {
      onClose();
    }
  }, [onClose]);

  // Auto-launch full-screen on mobile
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setIsFullScreen(true);
    }
  }, [advisorOpenSignal]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullScreen) {
        handleExitChat();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullScreen, handleExitChat]);

  const runs = session.runs || [];
  const harmonicAnalysis = analyzeHarmonics(runs);

  // Diagnostics for the side panel
  const runDiagnostics = () => {
    const sweetSpot = harmonicAnalysis.sweetSpotClick;
    const window = harmonicAnalysis.forgivingWindow;
    const windowWidth = window.endClick - window.startClick + 1;
    const minVert = harmonicAnalysis.minVerticalInches;

    const issues: string[] = [];
    const positives: string[] = [];

    if (runs.length < 5) {
      issues.push(`You currently have only ${runs.length} test runs recorded. We recommend bracketing at least 6–8 distinct tuner settings across a 20-click range to confirm the full U-shaped node curve.`);
    } else {
      positives.push(`Clean test series with ${runs.length} runs recorded across ${runs[0].tunerClick}c to ${runs[runs.length - 1].tunerClick}c.`);
    }

    if (windowWidth >= 4) {
      positives.push(`The forgiving window spans ${windowWidth} clicks (${window.startClick}c – ${window.endClick}c). This wide plateau indicates a true forgiving node where ammo muzzle velocity variance (ES/SD) will not produce vertical fliers.`);
    } else if (windowWidth <= 2) {
      issues.push(`The sweet spot trough is very steep (${windowWidth} click width). This indicates an aggressive inflection point. Fine-tune in 1-click increments between ${window.startClick - 1}c and ${window.endClick + 1}c to map the bottom.`);
    }

    if (minVert <= 0.125) {
      positives.push(`Sub-quarter-inch vertical suppression achieved (${minVert}" at 50 yards / ${(minVert / 0.5235).toFixed(2)} MOA). Barrel is achieving near-optimal positive launch angle compensation.`);
    }

    return { sweetSpot, window, windowWidth, minVert, issues, positives };
  };

  const diagnostics = runDiagnostics();

  // ─── SMART MESSAGE HANDLER — uses expert engine ───────────────────────────
  const handleSendMessage = async (textToSend?: string) => {
    const q = textToSend || inputQuery;
    if (!q.trim()) return;

    const userMsg: AIChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: q,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery('');
    setThinkingLabel(getThinkingLabel(q));
    setIsThinking(true);

    try {
      const response = await generateExpertResponse(q, expertContext);

      // Sync weather data back to the app if the engine fetched it
      if (response.updatedEnvironment && onUpdateEnvironment) {
        const updatedEnv: EnvironmentalConditions = {
          ...session.environment,
          ...response.updatedEnvironment,
        };
        onUpdateEnvironment(updatedEnv);
      }

      const aiMsg: AIChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'assistant',
        text: response.text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        actions: response.actions,
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      const errorMsg: AIChatMessage = {
        id: `ai-err-${Date.now()}`,
        sender: 'assistant',
        text: 'I encountered an issue processing your question. Please try asking again, or check your internet connection for weather-related queries.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsThinking(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Diagnostics Panel (Left) */}
      <div className="lg:col-span-5 flex flex-col gap-4">
        <div className="bg-[#10131A]/90 border border-white/10 rounded-2xl p-6 backdrop-blur-xl shadow-glass flex flex-col gap-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/40">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Lentz Harmonic Diagnostics</h3>
              <p className="text-xs font-mono font-bold text-neutral-300">
                Automated Node Health Analysis
              </p>
            </div>
          </div>

          {/* Node Health Badge */}
          <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <span className="text-sm font-bold text-white block">Tuned Node Confirmed</span>
                <span className="text-xs font-mono font-bold text-emerald-300">
                  Sweet Spot: {diagnostics.sweetSpot} Clicks ({diagnostics.minVert}&quot; V)
                </span>
              </div>
            </div>
            <button
              onClick={() => onApplyClick(diagnostics.sweetSpot)}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-500/25 text-emerald-200 text-sm font-bold hover:bg-emerald-500/35 transition-colors shadow-sm"
            >
              Apply
            </button>
          </div>

          {/* Positives List */}
          <div className="flex flex-col gap-2.5">
            <span className="text-xs uppercase font-mono text-neutral-200 font-bold tracking-wider">
              Optimal Observations
            </span>
            {diagnostics.positives.map((p, i) => (
              <div key={i} className="text-sm text-neutral-100 flex items-start gap-2.5 bg-neutral-900/80 p-3 rounded-xl border border-white/5 font-medium leading-relaxed">
                <span className="w-2 h-2 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                <span>{p}</span>
              </div>
            ))}
          </div>

          {/* Warnings & Suggestions */}
          {diagnostics.issues.length > 0 && (
            <div className="flex flex-col gap-2.5">
              <span className="text-xs uppercase font-mono text-amber-300 font-bold tracking-wider">
                Recommendations
              </span>
              {diagnostics.issues.map((issue, i) => (
                <div key={i} className="text-sm text-amber-100 flex items-start gap-2.5 bg-amber-500/15 p-3 rounded-xl border border-amber-500/30 font-medium leading-relaxed">
                  <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                  <span>{issue}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Expert Capabilities Overview */}
        <div className="bg-[#10131A]/90 border border-white/10 rounded-2xl p-5 backdrop-blur-xl text-sm text-neutral-200 flex flex-col gap-2 shadow-glass">
          <span className="text-xs font-mono uppercase text-sky-300 font-bold tracking-wider">
            Expert Advisor — Live Data & Ballistics Engine
          </span>
          <p className="leading-relaxed font-medium">
            Powered by real-time Open-Meteo weather, Purdy Method 4 harmonics, ISA density altitude, thermal drift compensation, and Lentz velocity-to-click tables. Ask me anything about tuning, weather, or match prep.
          </p>
        </div>
      </div>

      {/* AI Consultation Terminal (Right) */}
      <div className="lg:col-span-7 bg-[#10131A]/90 border border-white/10 rounded-2xl p-6 backdrop-blur-xl shadow-glass flex flex-col h-[560px]">
        {/* Chat Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-sky-500/20 border border-sky-500/40 flex items-center justify-center">
              <Bot className="w-5 h-5 text-sky-400" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Ballistics & Tuning Expert</h4>
              <span className="text-xs text-emerald-400 font-mono font-semibold">● Online &bull; Live Weather &bull; 20+ Topics</span>
            </div>
          </div>

          {/* Expand to Full Window Button */}
          <button
            onClick={() => setIsFullScreen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 text-sm font-bold transition-all shadow-sm active:scale-95"
            title="Expand to Full Window Chat"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Full Window</span>
            <span className="sm:hidden">Expand</span>
          </button>
        </div>

        {/* Message Stream */}
        <div className="flex-1 overflow-y-auto pr-2 space-y-3.5 font-sans">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm md:text-base leading-relaxed ${
                  m.sender === 'user'
                    ? 'bg-sky-500 text-white font-medium rounded-br-none shadow-md'
                    : 'bg-neutral-900/90 text-neutral-100 border border-white/10 rounded-bl-none font-medium shadow-sm'
                }`}
              >
                <div className="whitespace-pre-line">{m.text}</div>

                {/* Quick Action Buttons attached to AI message */}
                {m.actions && m.actions.length > 0 && (
                  <div className="mt-3.5 pt-2.5 border-t border-white/10 flex flex-wrap gap-2">
                    {m.actions.map((act, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          if (act.clickValue !== undefined) {
                            onApplyClick(act.clickValue);
                          } else {
                            handleSendMessage(act.label);
                          }
                        }}
                        className="px-3 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 border border-sky-500/40 text-sm font-bold transition-colors flex items-center gap-1.5 shadow-sm"
                      >
                        <span>{act.label}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <span className="text-xs font-mono font-semibold text-neutral-400 mt-1 px-1">
                {m.timestamp}
              </span>
            </div>
          ))}

          {isThinking && (
            <div className="flex items-center gap-2 text-neutral-300 text-sm italic">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-ping"></span>
              <span>{thinkingLabel}</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Query Input */}
        {isEasyMode ? (
          /* Easy Mode — mic is the hero, text field is secondary */
          <div className="mt-3 pt-3 border-t border-white/10 flex flex-col gap-3">
            <div className="flex items-center justify-center gap-4">
              <VoiceInputButton
                onTranscript={(spokenText) => {
                  setInputQuery(spokenText);
                  handleSendMessage(spokenText);
                }}
                title="Tap and speak your question"
                className="w-20 h-20 rounded-2xl text-3xl shrink-0"
              />
              <div className="flex flex-col gap-0.5">
                <p className="text-base font-bold text-white">Tap the mic and speak</p>
                <p className="text-sm text-neutral-400">Ask any tuning question out loud</p>
                <p className="text-xs font-mono text-neutral-500 italic mt-1">
                  &quot;What click should I start at?&quot; · &quot;How&apos;s the weather?&quot;
                </p>
              </div>
            </div>
            <form
              onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                placeholder="Or type here..."
                className="flex-1 bg-neutral-950 border border-white/20 rounded-xl px-4 py-3 text-base text-white placeholder-neutral-500 focus:outline-none focus:border-sky-500 font-medium"
              />
              <button
                type="submit"
                disabled={!inputQuery.trim()}
                className="p-3 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors shadow-md shrink-0"
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
          </div>
        ) : (
          /* Expert Mode — compact input bar */
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="mt-3 pt-3 border-t border-white/10 flex items-center gap-2.5"
          >
            <input
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              placeholder="Ask about weather, sweet spot, thermal drift, match prep..."
              className="flex-1 bg-neutral-950 border border-white/20 rounded-xl px-4 py-3 text-sm text-white placeholder-neutral-400 focus:outline-none focus:border-sky-500 font-medium"
            />
            <VoiceInputButton
              onTranscript={(spokenText) => {
                setInputQuery(spokenText);
                handleSendMessage(spokenText);
              }}
              title="Dictate question to Lentz Expert Advisor"
              className="shrink-0"
            />
            <button
              type="submit"
              disabled={!inputQuery.trim()}
              className="p-3 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors shadow-md shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        )}
      </div>

      {/* DEDICATED FULL WINDOW CHAT MODAL FOR MOBILE & TABLET */}
      {isFullScreen && (
        <div className="fixed inset-x-0 top-0 bottom-[calc(78px+env(safe-area-inset-bottom,0px))] md:bottom-0 md:inset-0 z-50 bg-[#08090C] flex flex-col animate-fadeIn overflow-hidden w-full max-w-full">
          {/* Top Bar with Prominent Easy Exit Button */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#10131A] shadow-md shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-500/40 flex items-center justify-center shrink-0">
                <Bot className="w-6 h-6 text-sky-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-extrabold text-white tracking-tight">
                    Lentz Expert Advisor
                  </h3>
                  <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                    LIVE
                  </span>
                </div>
                <p className="text-xs text-neutral-300 truncate max-w-[200px] sm:max-w-none font-medium">
                  {barrel?.name || 'Lentz Custom 2500X'} • Live Weather • 20+ Topics
                </p>
              </div>
            </div>

            {/* Easy Exit Button */}
            <button
              onClick={handleExitChat}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-rose-500/90 hover:bg-rose-500 text-white font-extrabold text-sm border border-rose-400/60 active:scale-95 transition-all shadow-lg min-w-[44px] min-h-[44px]"
              title="Exit Full Window Mode"
            >
              <X className="w-5 h-5" />
              <span className="hidden xs:inline">Close Chat</span>
            </button>
          </div>

          {/* Full-Height Messages Stream */}
          <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-4 py-5 space-y-4 max-w-4xl mx-auto w-full font-sans">

            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[88%] rounded-2xl px-5 py-3.5 text-base md:text-lg leading-relaxed ${
                    m.sender === 'user'
                      ? 'bg-sky-500 text-white font-medium rounded-br-none shadow-md'
                      : 'bg-neutral-900 text-neutral-100 border border-white/10 rounded-bl-none font-medium shadow-sm'
                  }`}
                >
                  <div className="whitespace-pre-line">{m.text}</div>

                  {/* Actions in Full Screen */}
                  {m.actions && m.actions.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-white/10 flex flex-wrap gap-2.5">
                      {m.actions.map((act, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            if (act.clickValue !== undefined) {
                              onApplyClick(act.clickValue);
                            } else {
                              handleSendMessage(act.label);
                            }
                          }}
                          className="px-3.5 py-2 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 border border-sky-500/40 text-sm font-bold transition-colors flex items-center gap-2 shadow-sm"
                        >
                          <span>{act.label}</span>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <span className="text-xs font-mono font-semibold text-neutral-400 mt-1 px-1">
                  {m.timestamp}
                </span>
              </div>
            ))}

            {isThinking && (
              <div className="flex items-center gap-2 text-neutral-300 text-sm md:text-base italic">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-ping"></span>
                <span>{thinkingLabel}</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Smart Quick Ask Bar — context-aware suggestions */}
          <div className="w-full max-w-full min-w-0 border-t border-white/10 bg-[#0D1017] shrink-0 overflow-hidden">
            <div className="w-full max-w-full min-w-0 overflow-x-auto no-scrollbar flex items-center gap-2 px-3 sm:px-4 py-2.5 touch-pan-x">
              <span className="text-xs font-mono font-bold text-sky-400 shrink-0">Quick Ask:</span>
              {quickAsks.map((txt) => (
                <button
                  key={txt}
                  onClick={() => handleSendMessage(txt)}
                  className="shrink-0 px-3 py-1.5 rounded-xl bg-neutral-900/90 hover:bg-neutral-800 active:bg-neutral-700 border border-white/15 text-xs sm:text-sm text-neutral-200 font-semibold whitespace-nowrap transition-colors active:scale-95 shadow-sm"
                >
                  {txt}
                </button>
              ))}
            </div>
          </div>

          {/* Pinned Bottom Input Bar */}
          <div className="w-full max-w-full min-w-0 p-3 sm:p-4 border-t border-white/15 bg-[#10131A] shrink-0 shadow-lg">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="max-w-4xl mx-auto flex items-center gap-2.5 sm:gap-3 w-full min-w-0"
            >
              <input
                ref={fullScreenInputRef}
                type="text"
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                placeholder="Ask about weather, tuning, match prep..."
                className="flex-1 min-w-0 bg-neutral-950 border border-white/25 rounded-2xl px-4 py-3 sm:px-5 sm:py-3.5 text-sm sm:text-base text-white placeholder-neutral-400 focus:outline-none focus:border-sky-500 font-medium shadow-inner"
                autoFocus
              />
              <VoiceInputButton
                onTranscript={(spokenText) => {
                  setInputQuery(spokenText);
                  handleSendMessage(spokenText);
                }}
                title="Dictate question to Lentz Expert Advisor"
                className="shrink-0 p-3 sm:p-3.5 rounded-2xl"
              />
              <button
                type="submit"
                disabled={!inputQuery.trim()}
                className="p-3 sm:p-3.5 rounded-2xl bg-sky-500 hover:bg-sky-400 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors shadow-md shrink-0 flex items-center justify-center"
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
