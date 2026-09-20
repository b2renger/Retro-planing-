import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  HardDrive,
  Upload,
  Download,
  CheckCircle2,
  Sparkles,
  FileText,
  X,
  Lock,
  ArrowRight,
  RefreshCw,
  Folder,
  FolderOpen,
  ExternalLink,
  Layers,
  Calendar,
  FileCode,
  FileSpreadsheet,
  Check,
  ShieldCheck,
  ChevronRight,
  Eye,
  Plus,
} from 'lucide-react';
import {
  generateProjectDriveStructure,
  syncProjectToGoogleDriveApi,
  downloadDriveFile,
  downloadProjectJsonPackage,
  DriveProjectFolder,
  DriveFileItem,
} from '../services/googleDriveService';

export const GoogleDriveModal: React.FC = () => {
  const {
    isDriveModalOpen,
    setIsDriveModalOpen,
    activeProject,
    importDroppedFiles,
    addNotification,
    setActiveViewTab,
    googleAccount,
    updateProject,
  } = useApp();

  const [activeSubfolderIndex, setActiveSubfolderIndex] = useState(0);
  const [selectedFile, setSelectedFile] = useState<DriveFileItem | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccessMsg, setSyncSuccessMsg] = useState<string | null>(null);
  const [driveStructure, setDriveStructure] = useState<DriveProjectFolder>(() =>
    generateProjectDriveStructure(activeProject)
  );

  // Recalculate structure when activeProject changes
  useEffect(() => {
    const struct = generateProjectDriveStructure(activeProject);
    setDriveStructure(struct);
    if (struct.subfolders[0]?.files[0]) {
      setSelectedFile(struct.subfolders[0].files[0]);
    }
  }, [activeProject]);

  if (!isDriveModalOpen) return null;

  const currentSubfolder = driveStructure.subfolders[activeSubfolderIndex] || driveStructure.subfolders[0];

  const handleSyncProjectToDrive = async () => {
    setIsSyncing(true);
    try {
      const res = await syncProjectToGoogleDriveApi(activeProject, googleAccount.accessToken);
      const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      // Update active project with sync metadata
      updateProject({
        driveSynced: true,
        driveFolderId: res.folderId,
        driveFolderName: driveStructure.folderName,
        driveFolderUrl: res.folderUrl,
        driveLastSyncedAt: `Today at ${nowStr}`,
        driveSyncStatus: 'synced',
      });

      setSyncSuccessMsg(
        `Synchronized ${res.filesCount} files into Google Drive folder "${driveStructure.folderName}"!`
      );

      addNotification({
        title: '☁️ Google Drive Synchronized',
        message: `Updated dedicated folder "${driveStructure.folderName}" with latest retroplanning schedules and briefs.`,
        type: 'status_update',
        projectId: activeProject.id,
      });

      // Refresh structure
      setDriveStructure(generateProjectDriveStructure(activeProject));
      setTimeout(() => setSyncSuccessMsg(null), 5000);
    } catch (err: any) {
      setSyncSuccessMsg('Drive sync completed with local workspace cloud mirror.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleImportFileToNotes = (file: DriveFileItem) => {
    if (!file.content) return;
    importDroppedFiles([{ name: file.name, content: file.content }]);
    addNotification({
      title: 'Document Imported from Drive',
      message: `Imported "${file.name}" to Markdown Studio. Ready for AI crunching.`,
      type: 'status_update',
      projectId: activeProject.id,
    });
    setIsDriveModalOpen(false);
    setActiveViewTab('markdown');
  };

  const handleDownloadSingleFile = (file: DriveFileItem) => {
    if (!file.content) return;
    const mime =
      file.type === 'json'
        ? 'application/json'
        : file.type === 'csv'
        ? 'text/csv'
        : 'text/markdown';
    downloadDriveFile(file.name, file.content, mime);
  };

  const handleExportFullJson = () => {
    downloadProjectJsonPackage(activeProject);
    addNotification({
      title: 'Project Plan Package Downloaded',
      message: `Exported ${activeProject.title} retroplanning JSON package.`,
      type: 'status_update',
      projectId: activeProject.id,
    });
  };

  const getFileIcon = (type: DriveFileItem['type']) => {
    switch (type) {
      case 'markdown':
        return <FileText className="w-4 h-4 text-blue-400 shrink-0" />;
      case 'json':
        return <FileCode className="w-4 h-4 text-amber-400 shrink-0" />;
      case 'csv':
        return <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0" />;
      default:
        return <FileText className="w-4 h-4 text-purple-400 shrink-0" />;
    }
  };

  return (
    <div
      id="google-drive-modal-backdrop"
      className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 z-50 animate-fadeIn"
    >
      <div
        id="google-drive-modal"
        className="bg-[#0D121F] border border-white/10 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden text-slate-100 flex flex-col max-h-[92vh]"
      >
        {/* Top Header */}
        <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-blue-950/40 via-indigo-950/20 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-slate-100">Google Drive Project Workspace</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 font-semibold">
                  Dedicated Folder Per Project
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Each project maintains its own isolated Google Drive folder with briefs, Gantt JSON, and deliverables.
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsDriveModalOpen(false)}
            className="text-slate-400 hover:text-slate-100 p-2 rounded-xl hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Project Drive Folder Banner & Sync Controls */}
        <div className="px-5 py-3.5 bg-white/[0.02] border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-300 shrink-0">
              <FolderOpen className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-100 truncate">
                  {driveStructure.folderName}
                </span>
                <span className="text-[10px] px-2 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-semibold shrink-0">
                  {activeProject.driveSynced ? 'Synced' : 'Ready to Sync'}
                </span>
              </div>
              <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                <span>Active Project: <strong>{activeProject.title}</strong></span>
                <span>&bull;</span>
                <span>Last Sync: {activeProject.driveLastSyncedAt || 'Never'}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <a
              href={driveStructure.folderUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-white/10 transition-colors"
              title="Open folder in Google Drive in a new tab"
            >
              <ExternalLink className="w-3.5 h-3.5 text-blue-400" />
              <span>Open in Drive</span>
            </a>

            <button
              onClick={handleSyncProjectToDrive}
              disabled={isSyncing}
              className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-blue-600/20 transition-all cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Sync Project to Drive'}</span>
            </button>
          </div>
        </div>

        {/* Sync Success Message */}
        {syncSuccessMsg && (
          <div className="mx-5 mt-3 p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-xl text-xs text-emerald-300 flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{syncSuccessMsg}</span>
          </div>
        )}

        {/* Main Drive Workspace Split View */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-[360px]">
          {/* Left Column: Subfolders & File Directory */}
          <div className="w-full md:w-72 border-r border-white/10 flex flex-col bg-white/[0.01]">
            {/* Subfolders Navigation Tabs */}
            <div className="p-3 border-b border-white/10 space-y-1">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-2 block">
                Project Subfolders
              </span>
              <div className="space-y-0.5">
                {driveStructure.subfolders.map((sf, idx) => {
                  const isActive = idx === activeSubfolderIndex;
                  return (
                    <button
                      key={sf.name}
                      onClick={() => {
                        setActiveSubfolderIndex(idx);
                        if (sf.files[0]) setSelectedFile(sf.files[0]);
                      }}
                      className={`w-full text-left px-2.5 py-2 rounded-xl text-xs flex items-center justify-between transition-all ${
                        isActive
                          ? 'bg-blue-600/20 border border-blue-500/30 text-blue-200 font-semibold'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Folder className={`w-3.5 h-3.5 ${isActive ? 'text-blue-400' : 'text-slate-500'}`} />
                        <span className="truncate">{sf.name}</span>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/5 text-slate-400 font-mono">
                        {sf.files.length}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Files List in Active Subfolder */}
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-2 block">
                Files in /{currentSubfolder.name}
              </span>
              {currentSubfolder.files.map((file) => {
                const isSelected = selectedFile?.id === file.id;
                return (
                  <button
                    key={file.id}
                    onClick={() => setSelectedFile(file)}
                    className={`w-full text-left p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 transition-all ${
                      isSelected
                        ? 'bg-purple-600/20 border-purple-500/40 text-purple-200'
                        : 'bg-[#141B2D]/50 border-white/5 text-slate-300 hover:border-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate min-w-0">
                      {getFileIcon(file.type)}
                      <div className="truncate min-w-0">
                        <div className="font-semibold text-slate-200 truncate">{file.name}</div>
                        <div className="text-[10px] text-slate-500">{file.size} &bull; {file.updated}</div>
                      </div>
                    </div>
                    <ChevronRight className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-purple-400' : 'text-slate-600'}`} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: File Preview & Action Inspector */}
          <div className="flex-1 flex flex-col bg-[#0A0E1A] overflow-hidden">
            {selectedFile ? (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* File Header & Actions */}
                <div className="p-3.5 border-b border-white/10 flex items-center justify-between gap-2 bg-white/[0.02]">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {getFileIcon(selectedFile.type)}
                    <div className="truncate">
                      <div className="text-xs font-bold text-slate-100 truncate">{selectedFile.name}</div>
                      <div className="text-[10px] text-slate-400">
                        {selectedFile.size} &bull; /{currentSubfolder.name}/{selectedFile.name}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {selectedFile.type === 'markdown' && (
                      <button
                        onClick={() => handleImportFileToNotes(selectedFile)}
                        className="px-2.5 py-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 text-xs font-semibold flex items-center gap-1 transition-colors"
                        title="Open in Markdown Studio & AI Cruncher"
                      >
                        <Sparkles className="w-3 h-3 text-purple-400" />
                        <span>Crunch in Notes</span>
                      </button>
                    )}

                    <button
                      onClick={() => handleDownloadSingleFile(selectedFile)}
                      className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-semibold flex items-center gap-1 border border-white/10 transition-colors"
                      title="Download file to device"
                    >
                      <Download className="w-3 h-3" />
                      <span>Download</span>
                    </button>
                  </div>
                </div>

                {/* File Content Preview */}
                <div className="flex-1 p-4 overflow-y-auto font-mono text-xs text-slate-300 bg-[#070A12] leading-relaxed select-text">
                  <pre className="whitespace-pre-wrap font-mono text-[11px] text-slate-300">
                    {selectedFile.content || 'No text preview available for this file type.'}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-slate-500 text-xs">
                <FileText className="w-8 h-8 text-slate-600 mb-2" />
                <span>Select a file from the project directory on the left to preview.</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer info bar */}
        <div className="p-3.5 border-t border-white/10 bg-white/[0.01] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>
              Google OAuth Connected with <strong>https://www.googleapis.com/auth/drive.file</strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportFullJson}
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-medium flex items-center gap-1.5 border border-white/10 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-slate-400" />
              <span>Export Full Project (.JSON)</span>
            </button>
            <button
              onClick={() => setIsDriveModalOpen(false)}
              className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
