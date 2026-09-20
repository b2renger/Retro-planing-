import React, { useState } from 'react';
import {
  X,
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
  MousePointerClick,
  Compass,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export const InteractiveTutorialModal: React.FC = () => {
  const {
    isInteractiveDemoOpen,
    setIsInteractiveDemoOpen,
    tutorialSteps,
    completeTutorialStep,
    resetTutorial,
    runLiveFeatureDemonstration,
    isDemoPlaying,
    setActiveViewTab,
  } = useApp();

  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  if (!isInteractiveDemoOpen) return null;

  const currentStep = tutorialSteps[currentStepIndex] || tutorialSteps[0];
  const completedCount = tutorialSteps.filter((s) => s.completed).length;

  const stepIcons = [
    <Calendar key="1" className="w-5 h-5 text-purple-400" />,
    <Zap key="2" className="w-5 h-5 text-amber-400" />,
    <Layers key="3" className="w-5 h-5 text-blue-400" />,
    <FileText key="4" className="w-5 h-5 text-emerald-400" />,
    <Users key="5" className="w-5 h-5 text-pink-400" />,
    <Cloud key="6" className="w-5 h-5 text-cyan-400" />,
    <Database key="7" className="w-5 h-5 text-emerald-400" />,
  ];

  const handleNext = () => {
    if (currentStepIndex < tutorialSteps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  const handleRunDemo = async () => {
    await runLiveFeatureDemonstration(currentStep.id);
  };

  const handleJumpToView = () => {
    setActiveViewTab(currentStep.targetTab);
    completeTutorialStep(currentStep.id);
    setIsInteractiveDemoOpen(false);
  };

  return (
    <div
      id="interactive-tutorial-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
    >
      <div
        id="interactive-tutorial-modal"
        className="bg-[#0D121F] border border-white/10 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-purple-950/40 via-indigo-950/20 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-300">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
                <span>Interactive Feature Demonstration</span>
                <span className="text-[10px] uppercase font-mono tracking-wider font-semibold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Step {currentStepIndex + 1} of {tutorialSteps.length}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Explore retroactive planning, automated triage, AI markdown notes, and team collaboration.
              </p>
            </div>
          </div>
          <button
            id="close-tutorial-modal-btn"
            onClick={() => setIsInteractiveDemoOpen(false)}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Navigation Bar */}
        <div className="flex border-b border-white/10 px-4 sm:px-5 bg-white/[0.01] overflow-x-auto gap-1 py-2 text-xs">
          {tutorialSteps.map((step, idx) => {
            const isSelected = idx === currentStepIndex;
            return (
              <button
                key={step.id}
                onClick={() => setCurrentStepIndex(idx)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all shrink-0 ${
                  isSelected
                    ? 'bg-purple-600 text-white font-semibold shadow-md shadow-purple-600/20'
                    : step.completed
                    ? 'bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                {step.completed ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                ) : (
                  <span className="w-4 h-4 rounded-full bg-white/10 text-[10px] flex items-center justify-center font-mono shrink-0">
                    {idx + 1}
                  </span>
                )}
                <span className="truncate max-w-[110px] sm:max-w-[140px]">{step.title.replace(/^\d+\.\s*/, '')}</span>
              </button>
            );
          })}
        </div>

        {/* Main Demonstration Content */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5">
          {/* Active Step Showcase Card */}
          <div className="bg-gradient-to-br from-white/[0.03] to-white/[0.01] border border-white/10 rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                  {stepIcons[currentStepIndex] || <Sparkles className="w-5 h-5 text-purple-400" />}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100">{currentStep.title}</h3>
                  <div className="text-xs text-purple-400 font-medium">{currentStep.featureHighlight}</div>
                </div>
              </div>

              {/* Action Trigger Buttons */}
              <div className="flex items-center gap-2">
                <button
                  id="run-live-demo-btn"
                  onClick={handleRunDemo}
                  disabled={isDemoPlaying}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-semibold shadow-md shadow-purple-600/30 transition-all cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>{isDemoPlaying ? 'Executing Demo...' : '⚡ Watch Live Demo'}</span>
                </button>
                <button
                  id="jump-to-view-btn"
                  onClick={handleJumpToView}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-semibold border border-white/10 transition-colors"
                >
                  <span>Go to View</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              {currentStep.description}
            </p>

            {/* Interactive Prompt */}
            {currentStep.actionPrompt && (
              <div className="bg-purple-950/30 border border-purple-500/30 rounded-xl p-3 text-xs text-purple-200 flex items-center gap-2">
                <MousePointerClick className="w-4 h-4 text-purple-400 shrink-0" />
                <span><strong>Try it:</strong> {currentStep.actionPrompt}</span>
              </div>
            )}

            {/* Key Benefits List */}
            {currentStep.keyBenefits && currentStep.keyBenefits.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-white/10">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Key Capabilities:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {currentStep.keyBenefits.map((benefit, bIdx) => (
                    <div
                      key={bIdx}
                      className="flex items-start gap-2 text-xs text-slate-300 bg-white/[0.02] p-2.5 rounded-xl border border-white/5"
                    >
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{benefit}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Navigation */}
        <div className="p-4 border-t border-white/10 flex items-center justify-between bg-white/[0.01]">
          <button
            onClick={resetTutorial}
            className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            Reset Tour Progress
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrev}
              disabled={currentStepIndex === 0}
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 text-slate-300 text-xs font-semibold flex items-center gap-1 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>
            <button
              onClick={handleNext}
              className="px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1 transition-colors"
            >
              <span>{currentStepIndex === tutorialSteps.length - 1 ? 'Finish' : 'Next Step'}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
