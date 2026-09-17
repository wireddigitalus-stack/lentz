'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Sparkles, X, ChevronRight, CheckCircle2, Volume2, HelpCircle } from 'lucide-react';
import {
  createSpeechRecognizer,
  isSpeechRecognitionSupported,
  parseBenchVoiceCommand,
  BenchVoiceAction,
} from '@/lib/speechRecognition';

interface BenchVoiceHUDProps {
  activeTab?: string;
  activeTunerClick: number;
  onSetTunerClick: (click: number) => void;
  onNudgeTuner: (delta: number) => void;
  onNavigateTab: (tab: string) => void;
  onAddRun: (click: number, vertical: number, group: number) => void;
  onAskAI: (question: string) => void;
  onSetTemp: (tempF: number) => void;
}

export const BenchVoiceHUD: React.FC<BenchVoiceHUDProps> = ({
  activeTab,
  activeTunerClick,
  onSetTunerClick,
  onNudgeTuner,
  onNavigateTab,
  onAddRun,
  onAskAI,
  onSetTemp,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [lastAction, setLastAction] = useState<BenchVoiceAction | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);

  const recognizerRef = useRef<any>(null);

  useEffect(() => {
    setSupported(isSpeechRecognitionSupported());
  }, []);

  const triggerHaptic = (duration = 25) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(duration);
      } catch (e) {}
    }
  };

  const playBeep = (freq: number, dur = 0.12) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.09, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + dur);
      }
    } catch (e) {}
  };

  const startListening = () => {
    if (!supported) return;

    setTranscript('');
    setActionNotice(null);
    triggerHaptic(30);
    playBeep(700, 0.15);

    const recognizer = createSpeechRecognizer(
      (text, isFinal) => {
        setTranscript(text);
        if (isFinal) {
          handleExecuteCommand(text);
        }
      },
      (err) => {
        console.warn('Voice HUD error:', err);
        setIsListening(false);
      },
      () => {
        setIsListening(false);
      }
    );

    if (recognizer) {
      try {
        recognizer.start();
        recognizerRef.current = recognizer;
        setIsListening(true);
      } catch (e) {
        setIsListening(false);
      }
    }
  };

  const stopListening = () => {
    if (recognizerRef.current) {
      try {
        recognizerRef.current.stop();
      } catch (e) {}
    }
    setIsListening(false);
    triggerHaptic(20);
    playBeep(450, 0.12);
  };

  const handleExecuteCommand = (rawText: string) => {
    const action = parseBenchVoiceCommand(rawText);
    setLastAction(action);
    triggerHaptic(40);

    switch (action.type) {
      case 'SET_TUNER':
        onSetTunerClick(action.click);
        setActionNotice(`Tuner moved to click ${action.click}`);
        playBeep(880, 0.2);
        break;

      case 'NUDGE_TUNER':
        onNudgeTuner(action.delta);
        const newClick = Math.max(0, Math.min(50, activeTunerClick + action.delta));
        setActionNotice(`Tuner nudged ${action.delta > 0 ? '+' : ''}${action.delta} to ${newClick}`);
        playBeep(880, 0.2);
        break;

      case 'ADD_RUN':
        onAddRun(action.tunerClick, action.verticalInches, action.groupSizeInches);
        setActionNotice(`Logged Run at ${action.tunerClick}c (Vert: ${action.verticalInches}", Group: ${action.groupSizeInches}")`);
        playBeep(920, 0.25);
        break;

      case 'NAVIGATE':
        onNavigateTab(action.tab);
        setActionNotice(`Navigated to ${action.tab.toUpperCase()} screen`);
        playBeep(800, 0.15);
        break;

      case 'ASK_AI':
        onAskAI(action.question);
        setActionNotice(`Consulting Lentz AI: "${action.question}"`);
        onNavigateTab('advisor');
        playBeep(750, 0.2);
        break;

      case 'SET_TEMP':
        onSetTemp(action.tempF);
        setActionNotice(`Ambient temperature set to ${action.tempF}°F`);
        playBeep(850, 0.15);
        break;

      case 'DICTATE_NOTE':
        setActionNotice(`Dictated: "${action.text}"`);
        break;

      default:
        setActionNotice(`Heard: "${rawText}" (Try: "Tuner 15" or "Show Target")`);
        break;
    }
  };

  if (!supported) return null;

  return (
    <>
      {/* Floating Bench Mic Pill (Always accessible on Mobile & Desktop, hidden on Advisor tab to prevent covering chat) */}
      <div className={`fixed bottom-24 md:bottom-6 right-4 z-40 ${activeTab === 'advisor' ? 'hidden' : ''}`}>
        <button
          onClick={() => {
            setIsOpen(true);
            if (!isListening) startListening();
          }}
          className="flex items-center gap-2 px-4 py-3 rounded-full bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-400 text-white font-bold text-sm shadow-xl shadow-sky-500/25 border border-white/20 hover:scale-105 active:scale-95 transition-all"
          title="Open Bench Voice Dictation HUD"
        >
          <div className="relative">
            <Mic className="w-5 h-5" />
            {isListening && (
              <span className="absolute -inset-1 rounded-full bg-white/50 animate-ping pointer-events-none" />
            )}
          </div>
          <span className="hidden sm:inline">Bench Voice</span>
        </button>
      </div>

      {/* Voice Assistant Modal / Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
          <div className="bg-[#0D1017] border border-white/15 w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl flex flex-col gap-5 text-white">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400">
                  <Mic className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base tracking-tight">Bench Voice Dictation</h3>
                  <p className="text-xs text-neutral-400">Hands-Free Precision Commands &amp; Speech-to-Text</p>
                </div>
              </div>
              <button
                onClick={() => {
                  stopListening();
                  setIsOpen(false);
                }}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-neutral-300 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Listening Visualizer Area */}
            <div className="flex flex-col items-center justify-center py-6 gap-4 bg-black/40 rounded-2xl border border-white/10 relative overflow-hidden">
              {/* Pulsing rings */}
              <div className="relative flex items-center justify-center">
                {isListening && (
                  <>
                    <div className="absolute w-28 h-28 rounded-full bg-sky-500/20 animate-ping" />
                    <div className="absolute w-20 h-20 rounded-full bg-sky-500/30 animate-pulse" />
                  </>
                )}
                <button
                  onClick={isListening ? stopListening : startListening}
                  className={`relative w-20 h-20 rounded-full flex items-center justify-center shadow-xl transition-all ${
                    isListening
                      ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/40 scale-105'
                      : 'bg-sky-500 hover:bg-sky-400 text-white shadow-sky-500/40'
                  }`}
                >
                  {isListening ? (
                    <Mic className="w-9 h-9 animate-pulse" />
                  ) : (
                    <MicOff className="w-8 h-8 opacity-90" />
                  )}
                </button>
              </div>

              <div className="text-center px-4">
                <span className="text-sm font-bold tracking-wide uppercase text-neutral-400 font-mono">
                  {isListening ? 'Listening at the bench...' : 'Tap Mic to Start Dictation'}
                </span>
                <p className="text-xs text-neutral-500 mt-1">
                  Speak clearly into your phone or earbud microphone
                </p>
              </div>

              {/* Live Transcript Display */}
              {transcript && (
                <div className="w-[90%] bg-neutral-900/90 border border-sky-500/40 rounded-xl p-3.5 text-center text-sm md:text-base font-medium text-white shadow-inner">
                  &ldquo;{transcript}&rdquo;
                </div>
              )}

              {/* Recognized Action Notice Pill */}
              {actionNotice && (
                <div className="flex items-center gap-2 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-sm font-bold px-4 py-2 rounded-xl animate-fadeIn">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{actionNotice}</span>
                </div>
              )}
            </div>

            {/* In-Field Voice Command Cheat Sheet */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold font-mono uppercase text-sky-400 tracking-wider">
                Bench Voice Command Examples:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-neutral-900/70 border border-white/10 flex flex-col">
                  <span className="text-neutral-400 font-medium">&ldquo;Tuner 18&rdquo; or &ldquo;Plus two&rdquo;</span>
                  <span className="text-white font-semibold mt-0.5">Turns Harrell dial immediately</span>
                </div>
                <div className="p-2.5 rounded-xl bg-neutral-900/70 border border-white/10 flex flex-col">
                  <span className="text-neutral-400 font-medium">&ldquo;Run click 15 vertical 0.08&rdquo;</span>
                  <span className="text-white font-semibold mt-0.5">Logs test run into session</span>
                </div>
                <div className="p-2.5 rounded-xl bg-neutral-900/70 border border-white/10 flex flex-col">
                  <span className="text-neutral-400 font-medium">&ldquo;Show target&rdquo; / &ldquo;Harmonics&rdquo;</span>
                  <span className="text-white font-semibold mt-0.5">Switches active screen</span>
                </div>
                <div className="p-2.5 rounded-xl bg-neutral-900/70 border border-white/10 flex flex-col">
                  <span className="text-neutral-400 font-medium">&ldquo;Ask Lentz [your question]&rdquo;</span>
                  <span className="text-white font-semibold mt-0.5">Hands-free AI consultant inquiry</span>
                </div>
              </div>
            </div>

            {/* Footer Done Button */}
            <button
              onClick={() => {
                stopListening();
                setIsOpen(false);
              }}
              className="w-full py-3.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-sm transition-colors"
            >
              Close Voice HUD
            </button>
          </div>
        </div>
      )}
    </>
  );
};
