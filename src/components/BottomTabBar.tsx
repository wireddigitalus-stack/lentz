'use client';

import React from 'react';
import { Target, Disc, Activity, CloudSun, Sparkles, BookOpen, ClipboardList } from 'lucide-react';

interface BottomTabBarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onTabReselect?: (tab: string) => void;
}

export const BottomTabBar: React.FC<BottomTabBarProps> = ({
  activeTab,
  setActiveTab,
  onTabReselect,
}) => {
  const tabs = [
    { id: 'tuner', label: 'Tuner', icon: Disc },
    { id: 'harmonics', label: 'Harmonics', icon: Activity },
    { id: 'weather', label: 'Weather', icon: CloudSun },
    { id: 'match_log', label: 'Match Log', icon: ClipboardList },
    { id: 'advisor', label: 'Advisor', icon: Sparkles },
    { id: 'logbook', label: 'Logbook', icon: BookOpen },
  ];

  const handleTabClick = (tabId: string) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(12);
      } catch (e) {}
    }
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }
    if (activeTab === tabId && onTabReselect) {
      onTabReselect(tabId);
    }
    setActiveTab(tabId);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[60] bg-[#08090C]/95 backdrop-blur-2xl border-t border-white/10 md:hidden px-2 py-2 pb-safe shadow-2xl">
      <div className="flex items-center justify-around max-w-md mx-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={`flex flex-col items-center justify-center flex-1 py-1.5 px-0.5 rounded-xl transition-all duration-150 active:scale-90 select-none min-h-[56px] ${
                isActive
                  ? 'text-sky-400 font-bold'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <div
                className={`relative p-1 rounded-xl transition-colors ${
                  isActive ? 'bg-sky-500/20 text-sky-400' : ''
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
              </div>
              <span className="text-[11px] font-semibold tracking-tight mt-0.5 whitespace-nowrap leading-tight">
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
