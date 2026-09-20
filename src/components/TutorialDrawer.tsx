import React from 'react';
import { useApp } from '../context/AppContext';
import {
  GraduationCap,
  X,
  CheckCircle2,
  Circle,
  ArrowRight,
  RotateCcw,
  Sparkles,
  ChevronRight,
  Play,
  Maximize2,
} from 'lucide-react';

export const TutorialDrawer: React.FC = () => {
  const {
    tutorialSteps,
    isTutorialDrawerOpen,
    setIsTutorialDrawerOpen,
    completeTutorialStep,
    resetTutorial,
    setActiveViewTab,
    activeViewTab,
    setIsInteractiveDemoOpen,
    runLiveFeatureDemonstration,
    isDemoPlaying,
  } = useApp();

  if (!isTutorialDrawerOpen) return null;

  const completedCount = tutorialSteps.filter((s) => s.completed).length;
  const progressPercent = Math.round((completedCount / tutorialSteps.length) * 100);

  const handleStepClick = (step: any) => {
    setActiveViewTab(step.targetTab);
    completeTutorialStep(step.id);
  };

  return (
    <div
      id="tutorial-drawer-dock"
      className="fixed bottom-6 right-6 w-96 max-h-[580px] bg-[#0D121F]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl flex flex-col z-40 overflow-hidden animate-fadeIn text-slate-100"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <GraduationCap className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-semibold text-xs text-slate-100 tracking-tight">Interactive Designer Tutorial</h4>
            <span className="text-[10px] text-slate-400">{completedCount} of {tutorialSteps.length} features explored</span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsInteractiveDemoOpen(true)}
            title="Open Fullscreen Interactive Feature Walkthrough"
            className="p-1 rounded-md text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 transition-colors"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={resetTutorial}
            title="Reset tutorial progress"
            className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setIsTutorialDrawerOpen(false)}
            className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Action Banner: Launch Full Live Demonstration */}
      <div className="px-4 py-2 bg-gradient-to-r from-purple-900/30 to-blue-900/20 border-b border-white/5 flex items-center justify-between">
        <span className="text-[11px] text-purple-200 font-medium">Want an automated demonstration?</span>
        <button
          onClick={() => setIsInteractiveDemoOpen(true)}
          className="flex items-center gap-1 text-[11px] font-semibold text-white bg-purple-600 hover:bg-purple-500 px-2.5 py-1 rounded-lg transition-colors"
        >
          <Play className="w-3 h-3 fill-white" />
          <span>Launch Demo</span>
        </button>
      </div>

      {/* Progress Bar */}
      <div className="px-4 py-2 bg-[#141B2D]/40 border-b border-white/5 flex items-center justify-between">
        <div className="flex-1 mr-3">
          <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-300 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
        <span className="text-[11px] font-mono text-purple-300 font-semibold">{progressPercent}%</span>
      </div>

      {/* Steps List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 text-xs">
        {tutorialSteps.map((step) => {
          const isCurrentTab = activeViewTab === step.targetTab;
          return (
            <div
              key={step.id}
              onClick={() => handleStepClick(step)}
              className={`p-2.5 rounded-xl border transition-all cursor-pointer group ${
                isCurrentTab
                  ? 'bg-purple-600/15 border-purple-500/30'
                  : 'bg-[#141B2D]/30 border-white/5 hover:border-white/10 hover:bg-[#141B2D]/60'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5 min-w-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      completeTutorialStep(step.id);
                    }}
                    className="mt-0.5 text-slate-400 hover:text-emerald-400 shrink-0"
                  >
                    {step.completed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Circle className="w-4 h-4 text-slate-500" />
                    )}
                  </button>

                  <div className="space-y-1 min-w-0">
                    <div className="font-semibold text-xs text-slate-200 group-hover:text-purple-300 transition-colors flex items-center gap-1.5 truncate">
                      <span className="truncate">{step.title}</span>
                      {isCurrentTab && (
                        <span className="px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 text-[9px] shrink-0">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">{step.description}</p>
                    <div className="flex items-center gap-2 pt-0.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          runLiveFeatureDemonstration(step.id);
                        }}
                        className="text-[10px] text-purple-300 hover:text-purple-200 font-medium flex items-center gap-1 bg-purple-500/10 hover:bg-purple-500/20 px-1.5 py-0.5 rounded border border-purple-500/20"
                      >
                        <Play className="w-2.5 h-2.5 fill-purple-300" />
                        <span>Auto-Demo</span>
                      </button>
                    </div>
                  </div>
                </div>

                <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-300 group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-white/5 bg-white/[0.02] flex items-center justify-between text-[11px] text-slate-400">
        <button
          onClick={() => setIsInteractiveDemoOpen(true)}
          className="text-purple-400 hover:text-purple-300 font-medium"
        >
          View Full Interactive Tour
        </button>
        <button
          onClick={() => setIsTutorialDrawerOpen(false)}
          className="text-slate-400 hover:text-slate-200"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
};
