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
      role="complementary"
      aria-label="Interactive designer tutorial"
      className="fixed bottom-6 right-6 w-96 max-h-[580px] bg-card/95 backdrop-blur-xl border border-line rounded-2xl shadow-2xl flex flex-col z-40 overflow-hidden animate-fadeIn text-fg"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-line flex items-center justify-between bg-elevated">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-400">
            <GraduationCap className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-semibold text-xs text-fg tracking-tight">Interactive Designer Tutorial</h4>
            <span className="text-[10px] text-fg-muted">{completedCount} of {tutorialSteps.length} features explored</span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={resetTutorial}
            title="Reset tutorial progress"
            className="p-1 rounded-md text-fg-muted hover:text-fg hover:bg-elevated transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setIsTutorialDrawerOpen(false)}
            className="p-1 rounded-md text-fg-muted hover:text-fg hover:bg-elevated transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="px-4 py-2 bg-elevated/40 border-b border-line flex items-center justify-between">
        <div className="flex-1 mr-3">
          <div className="h-1.5 w-full bg-elevated rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-300 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
        <span className="text-[11px] font-mono text-purple-700 dark:text-purple-300 font-semibold">{progressPercent}%</span>
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
                  : 'bg-elevated/30 border-line hover:border-line-strong hover:bg-elevated/60'
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
                    className="mt-0.5 text-fg-muted hover:text-emerald-600 dark:hover:text-emerald-400 shrink-0"
                  >
                    {step.completed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <Circle className="w-4 h-4 text-fg-muted" />
                    )}
                  </button>

                  <div className="space-y-1 min-w-0">
                    <div className="font-semibold text-xs text-fg group-hover:text-purple-700 dark:group-hover:text-purple-300 transition-colors flex items-center gap-1.5 truncate">
                      <span className="truncate">{step.title}</span>
                      {isCurrentTab && (
                        <span className="px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-700 dark:text-purple-300 text-[9px] shrink-0">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-fg-muted line-clamp-2 leading-relaxed">{step.description}</p>
                    <div className="flex items-center gap-2 pt-0.5">
                    </div>
                  </div>
                </div>

                <ChevronRight className="w-4 h-4 text-fg-muted group-hover:text-fg group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-line bg-elevated flex items-center justify-between text-[11px] text-fg-muted">
        <button
          onClick={() => setIsTutorialDrawerOpen(false)}
          className="text-fg-muted hover:text-fg"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
};
