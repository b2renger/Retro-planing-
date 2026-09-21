import React from 'react';
import { ExternalLink, GraduationCap } from 'lucide-react';
import { description as APP_DESCRIPTION, version as APP_VERSION } from '../../../package.json';
import { capabilities } from '../../capabilities';
import { useApp } from '../../context/AppContext';
import { FIRST_STEP_ID, TUTORIAL_STEPS } from '../tutorial/steps';
import { LINK_CLASS, PanelHeading } from './controls';

const DOCS: { label: string; href: string; note: string }[] = [
  { label: 'LlmOnLan', href: 'https://github.com/b2renger/LlmOnLan', note: 'Run the AI on your own GPU machines over the LAN.' },
  { label: 'Source repository', href: 'https://github.com/b2renger/Retro-planing-', note: 'Issues, releases and the developer docs under docs/.' },
];

const IN_REPO_DOCS = ['docs/dev/LLMONLAN.md — the LAN farm integration', 'docs/dev/STATE-API.md — the store contract', 'docs/dev/THEME.md — the token system'];

/** Version, build kind and where the documentation lives. */
export const AboutPanel: React.FC = () => {
  const caps = capabilities();
  const { tutorial, startTutorial, resetTutorial, setIsSettingsOpen } = useApp();
  const doneCount = tutorial.completedStepIds.length;

  const restart = (): void => {
    resetTutorial();
    setIsSettingsOpen(false);
    startTutorial(FIRST_STEP_ID);
  };

  return (
    <div className="space-y-5">
      <PanelHeading title="About" description={APP_DESCRIPTION} />

      <dl className="text-xs space-y-2">
        <div className="flex justify-between gap-4 p-2 rounded-lg bg-elevated border border-line">
          <dt className="text-fg-muted">Application</dt>
          <dd className="text-fg font-semibold">RetroPlaningStudio</dd>
        </div>
        <div className="flex justify-between gap-4 p-2 rounded-lg bg-elevated border border-line">
          <dt className="text-fg-muted">Version</dt>
          <dd className="text-fg font-mono">{APP_VERSION}</dd>
        </div>
        <div className="flex justify-between gap-4 p-2 rounded-lg bg-elevated border border-line">
          <dt className="text-fg-muted">Build</dt>
          <dd className="text-fg">{caps.buildLabel}</dd>
        </div>
      </dl>

      <div className="space-y-2 rounded-xl border border-line bg-elevated p-3">
        <h4 className="flex items-center gap-1.5 text-xs font-bold text-fg">
          <GraduationCap className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
          <span>Tutorial</span>
        </h4>
        <p className="text-[11px] leading-relaxed text-fg-muted">
          {TUTORIAL_STEPS.length} steps through the app, run on a throwaway practice copy of the sample project — your own projects are never touched.
          {doneCount > 0 ? ` You have finished ${doneCount} of ${TUTORIAL_STEPS.length}.` : ''}
        </p>
        <button
          type="button"
          onClick={restart}
          className="rounded-lg bg-purple-600 px-3 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-purple-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-300"
        >
          {doneCount > 0 ? 'Restart the tutorial' : 'Start the tutorial'}
        </button>
      </div>

      <div className="space-y-2">
        <h4 className="text-xs font-bold text-fg">Documentation</h4>
        <ul className="space-y-1.5">
          {DOCS.map((doc) => (
            <li key={doc.href} className="text-[11px] text-fg-muted leading-relaxed">
              <a href={doc.href} target="_blank" rel="noreferrer" className={`${LINK_CLASS} inline-flex items-center gap-1 font-semibold`}>
                <span>{doc.label}</span>
                <ExternalLink className="w-3 h-3" />
              </a>{' '}
              — {doc.note}
            </li>
          ))}
        </ul>
        <p className="text-[11px] text-fg-muted leading-relaxed">In the repository: {IN_REPO_DOCS.join(' · ')}.</p>
      </div>

      <p className="text-[11px] text-fg-muted leading-relaxed border-t border-line pt-3">
        Projects, documents and settings live on this device. Nothing is sent anywhere until you configure an AI provider or a cloud account.
      </p>
    </div>
  );
};
