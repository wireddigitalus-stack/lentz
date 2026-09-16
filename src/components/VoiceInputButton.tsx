'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { createSpeechRecognizer, isSpeechRecognitionSupported } from '@/lib/speechRecognition';

interface VoiceInputButtonProps {
  onTranscript: (text: string) => void;
  className?: string;
  title?: string;
  append?: boolean;
}

export const VoiceInputButton: React.FC<VoiceInputButtonProps> = ({
  onTranscript,
  className = '',
  title = 'Tap to dictate with voice (Speech-to-Text)',
  append = false,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const recognizerRef = useRef<any>(null);

  useEffect(() => {
    setSupported(isSpeechRecognitionSupported());
  }, []);

  const playChime = (freq: number, duration: number) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = freq;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + duration);
      }
    } catch (e) {
      // AudioContext unavailable or blocked
    }
  };

  const triggerHaptic = (duration = 20) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(duration);
      } catch (e) {}
    }
  };

  const startListening = () => {
    if (!supported) return;

    triggerHaptic(30);
    playChime(660, 0.12);

    const recognizer = createSpeechRecognizer(
      (transcript, isFinal) => {
        if (isFinal) {
          triggerHaptic(20);
          onTranscript(transcript);
        }
      },
      (error) => {
        console.warn('Dictation error:', error);
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
      } catch (err) {
        console.warn('Failed to start recognizer:', err);
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
    triggerHaptic(15);
    playChime(440, 0.12);
  };

  const toggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      title={title}
      className={`relative p-2.5 rounded-xl transition-all duration-200 flex items-center justify-center shrink-0 ${
        isListening
          ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30 scale-105 ring-2 ring-rose-400 ring-offset-2 ring-offset-[#08090C]'
          : 'bg-neutral-800/80 hover:bg-neutral-700/80 text-neutral-300 hover:text-white border border-white/10'
      } ${className}`}
    >
      {isListening ? (
        <>
          <span className="absolute -inset-1 rounded-xl bg-rose-500/40 animate-ping pointer-events-none" />
          <Mic className="w-4 h-4 animate-pulse text-white" />
        </>
      ) : (
        <Mic className="w-4 h-4 text-sky-400 hover:text-sky-300" />
      )}
    </button>
  );
};
