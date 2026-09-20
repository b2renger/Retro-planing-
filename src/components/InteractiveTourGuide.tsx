import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  GraduationCap,
  Play,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Calendar,
  Layers,
  FileText,
  Users,
  Database,
  Cloud,
  Check,
  Zap,
  ArrowRight,
  X,
  Minimize2,
  Maximize2,
  RotateCcw,
  Eye,
  MousePointerClick,
  HelpCircle,
} from 'lucide-react';

export const InteractiveTourGuide: React.FC = () => {
  const {
    isInteractiveDemoOpen,
    setIsInteractiveDemoOpen,
    tutorialSteps,
    completeTutorialStep,
    resetTutorial,
    runLiveFeatureDemonstration,
    isDemoPlaying,
    setActiveViewTab,
    activeViewTab,
  } = useApp();

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isMinimized, setIsMinimized] = useState(false);
  const [demoNotice, setDemoNotice] = useState<string | null>(null);

  const currentStep = tutorialSteps[currentStepIndex] || tutorialSteps[0];
  const completedCount = tutorialSteps.filter((s) => s.completed).length;
  const progressPercent = Math.round((completedCount / tutorialSteps.length) * 100);

  // Automatically switch tab when step changes if tour is active
  useEffect(() => {
    if (isInteractiveDemoOpen && currentStep) {
      if (activeViewTab !== currentStep.targetTab) {
        setActiveViewTab(currentStep.targetTab);
      }
    }
  }, [currentStepIndex, isInteractiveDemoOpen]);

  if (!isInteractiveDemoOpen) return null;

  const handleNext = () => {
    completeTutorialStep(currentStep.id);
    if (currentStepIndex < tutorialSteps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    } else {
      setIsInteractiveDemoOpen(false);
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  const handleRunDemo = async () => {
    setDemoNotice(`Executing real-time demo for ${currentStep.title}...`);
    await runLiveFeatureDemonstration(currentStep.id);
    setTimeout(() => {
      setDemoNotice(null);
    }, 4000);
  };

  const stepIcons = [
    <Calendar key="1" className="w-4 h-4 text-purple-400" />,
    <Zap key="2" className="w-4 h-4 text-amber-400" />,
    <Layers key="3" className="w-4 h-4 text-blue-400" />,
    <FileText key="4" className="w-4 h-4 text-emerald-400" />,
    <Users key="5" className="w-4 h-4 text-pink-400" />,
    <Cloud key="6" className="w-4 h-4 text-cyan-400" />,
    <Database key="7" className="w-4 h-4 text-emerald-400" />,
  ];

  // Minimized floating pill mode
  if (isMinimized) {
    return (
      <div
        id="interactive-tour-minimized-pill"
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 bg-[#0D121F] border border-purple-500/40 px-3.5 py-2 rounded-2xl shadow-2xl backdrop-blur-xl animate-fadeIn"
      >
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-purple-600/20 text-purple-300 flex items-center justify-center text-xs font-bold font-mono">
            {currentStepIndex + 1}
          </div>
          <div className="text-xs font-semibold text-slate-100 max-w-[180px] truncate">
            {currentStep.title.replace(/^\d+\.\s*/, '')}
          </div>
        </div>

        <button
          onClick={() => setIsMinimized(false)}
          className="p-1 rounded-lg hover:bg-white/10 text-purple-300 text-xs flex items-center gap-1 font-medium transition-colors"
          title="Expand interactive tour guide"
        >
          <Maximize2 className="w-3.5 h-3.5" />
          <span>Expand</span>
        </button>

        <button
          onClick={() => setIsInteractiveDemoOpen(false)}
          className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-slate-200 transition-colors"
          title="Exit tour"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  // Floating Interactive Tour Guide Dock
  return (
    <>
      {/* Floating On-Screen Tour Guide Dock (Bottom-Right/Center) */}
      <div
        id="interactive-tour-floating-dock"
        className="fixed bottom-4 sm:bottom-6 right-3 sm:right-6 max-w-lg w-[calc(100vw-24px)] sm:w-full z-50 bg-[#0D121F]/95 backdrop-blur-2xl border border-purple-500/40 rounded-2xl shadow-2xl shadow-purple-950/40 text-slate-100 flex flex-col overflow-hidden animate-fadeIn"
      >
        {/* Top Header Bar */}
        <div className="px-4 py-3 border-b border-white/10 bg-gradient-to-r from-purple-950/50 via-[#0D121F] to-indigo-950/30 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-purple-600/20 border border-purple-500/30 text-purple-300 flex items-center justify-center shrink-0">
              <GraduationCap className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded-full border border-purple-500/30">
                  Step {currentStepIndex + 1} of {tutorialSteps.length}
                </span>
                {currentStep.completed && (
                  <span className="text-[10px] font-semibold text-emerald-300 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>Completed</span>
                  </span>
                )}
              </div>
              <h3 className="text-xs sm:text-sm font-bold text-slate-100 truncate mt-0.5">
                {currentStep.title}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setIsMinimized(true)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors"
              title="Minimize guide to corner pill"
            >
              <Minimize2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setIsInteractiveDemoOpen(false)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors"
              title="Exit interactive tour"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-1 w-full bg-white/10 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-300"
            style={{ width: `${((currentStepIndex + 1) / tutorialSteps.length) * 100}%` }}
          />
        </div>

        {/* Main Content Body */}
        <div className="p-4 space-y-3 max-h-[50vh] overflow-y-auto text-xs">
          {/* Live Action Notification Banner */}
          {demoNotice && (
            <div className="p-2.5 rounded-xl bg-purple-500/20 border border-purple-500/40 text-purple-200 text-xs flex items-center gap-2 animate-pulse">
              <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
              <span>{demoNotice}</span>
            </div>
          )}

          {/* Description */}
          <p className="text-slate-300 leading-relaxed">
            {currentStep.description}
          </p>

          {/* Interactive Prompt Callout */}
          <div className="bg-purple-950/30 border border-purple-500/25 rounded-xl p-3 space-y-1.5">
            <div className="flex items-center gap-1.5 text-purple-300 font-bold uppercase tracking-wider text-[10px]">
              <MousePointerClick className="w-3.5 h-3.5 text-purple-400" />
              <span>Try it on screen or watch live:</span>
            </div>
            <p className="text-slate-200 font-medium">
              {currentStep.actionPrompt || currentStep.actionRequired}
            </p>
          </div>

          {/* Key Benefits */}
          {currentStep.keyBenefits && currentStep.keyBenefits.length > 0 && (
            <div className="space-y-1 pt-1">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Key Capabilities:
              </span>
              <div className="grid grid-cols-1 gap-1 text-[11px] text-slate-300">
                {currentStep.keyBenefits.map((benefit, bIdx) => (
                  <div key={bIdx} className="flex items-center gap-1.5">
                    <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                    <span>{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-3 bg-white/[0.02] border-t border-white/10 flex items-center justify-between gap-2">
          {/* Left: Auto Demonstration Trigger */}
          <button
            id="tour-auto-demo-btn"
            onClick={handleRunDemo}
            disabled={isDemoPlaying}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-semibold shadow-md shadow-purple-600/30 transition-all cursor-pointer"
            title="Automatically executes this feature live on the screen"
          >
            <Play className={`w-3.5 h-3.5 fill-white ${isDemoPlaying ? 'animate-spin' : ''}`} />
            <span>{isDemoPlaying ? 'Demonstrating...' : '⚡ Watch Live Demo'}</span>
          </button>

          {/* Right: Step Navigation Controls */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={handlePrev}
              disabled={currentStepIndex === 0}
              className="px-2.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 text-slate-300 text-xs font-medium flex items-center gap-1 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>

            <button
              onClick={handleNext}
              className="px-3 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-md shadow-purple-600/20 flex items-center gap-1 transition-all"
            >
              <span>{currentStepIndex === tutorialSteps.length - 1 ? 'Finish Tour' : 'Next Step'}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
