/**
 * Pure mapping between a `Project` and its cloud folder layout:
 *
 *   RetroPlaningStudio/
 *     <project slug>/
 *       project.json      – project metadata + a documents index (no doc content, trimmed history)
 *       docs/<slug>.md    – one Markdown file per document, with YAML frontmatter
 *       exports/          – reserved for spreadsheet exports
 */
import type { HistoryEntry, MarkdownDoc, Project } from '../../types';
import { isRecord } from './httpErrors';

/** Name of the top-level folder in the user's drive. */
export const ROOT_FOLDER_NAME = 'RetroPlaningStudio';
/** Sub-folder holding the Markdown documents. */
export const DOCS_FOLDER_NAME = 'docs';
/** Sub-folder reserved for spreadsheet exports. */
export const EXPORTS_FOLDER_NAME = 'exports';
/** Name of the project metadata file. */
export const PROJECT_FILE_NAME = 'project.json';
/** MIME type used when uploading Markdown. */
export const MARKDOWN_MIME = 'text/markdown';
/** MIME type used when uploading project.json. */
export const JSON_MIME = 'application/json';
/** Number of history entries kept in project.json. */
export const HISTORY_LIMIT = 200;

/** Makes a readable, filesystem-safe name (strips `/ \ : * ? " < > |` and control chars). */
export function slugify(title: string): string {
  const cleaned = title
    .replace(/[/\\:*?\"<>|\x00-\x1f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 120);
  return cleaned || 'Untitled';
}

/** File name for a document; `taken` (lower-cased names) is used to avoid collisions. */
export function docFileName(title: string, taken: ReadonlySet<string> = new Set()): string {
  const base = slugify(title).replace(/\.md$/i, '') || 'Untitled';
  let candidate = `${base}.md`;
  let n = 2;
  while (taken.has(candidate.toLowerCase())) candidate = `${base} (${n++}).md`;
  return candidate;
}

/** True when a cloud file name looks like a Markdown document. */
export function isMarkdownName(name: string): boolean {
  return /\.(md|markdown)$/i.test(name);
}

// ---------------------------------------------------------------------------
// project.json
// ---------------------------------------------------------------------------

/** Entry of the documents index inside project.json. */
export type DocIndexEntry = Omit<MarkdownDoc, 'content'>;

/** Shape of project.json. */
export type CloudProjectFile = Omit<Project, 'documents' | 'history'> & {
  documents: DocIndexEntry[];
  history: HistoryEntry[];
};

/** Builds the project.json payload: documents without content, history capped to the newest 200. */
export function toProjectFile(project: Project): CloudProjectFile {
  const { documents, history, ...rest } = project;
  return {
    ...rest,
    documents: documents.map(({ content: _content, ...index }) => index),
    history: history.slice(-HISTORY_LIMIT),
  };
}

/** Serializes project.json (stable 2-space indentation for readable diffs in the cloud UI). */
export function serializeProject(project: Project): string {
  return JSON.stringify(toProjectFile(project), null, 2) + '\n';
}

/** Parses project.json; throws on a shape that cannot be a project. */
export function parseProjectFile(text: string): CloudProjectFile {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('project.json is not valid JSON');
  }
  if (!isRecord(raw) || typeof raw.id !== 'string' || typeof raw.title !== 'string') {
    throw new Error('project.json is missing a string id or title');
  }
  const arr = (key: string): unknown[] => (Array.isArray(raw[key]) ? raw[key] : []);
  const base = raw as unknown as CloudProjectFile;
  return {
    ...base,
    phases: arr('phases') as CloudProjectFile['phases'],
    tasks: arr('tasks') as CloudProjectFile['tasks'],
    milestones: arr('milestones') as CloudProjectFile['milestones'],
    comments: arr('comments') as CloudProjectFile['comments'],
    clarificationQuestions: arr('clarificationQuestions') as CloudProjectFile['clarificationQuestions'],
    tags: arr('tags').filter((t): t is string => typeof t === 'string'),
    history: arr('history') as HistoryEntry[],
    documents: arr('documents').filter(isRecord).filter((d) => typeof d.id === 'string') as unknown as DocIndexEntry[],
  };
}

/** Rebuilds a `Project` from project.json and the documents read from `docs/`. */
export function projectFromCloudFile(file: CloudProjectFile, documents: MarkdownDoc[]): Project {
  return { ...file, documents, history: file.history };
}

// ---------------------------------------------------------------------------
// docs/<slug>.md
// ---------------------------------------------------------------------------

/** Frontmatter keys written by `serializeDoc`. */
export interface DocFrontmatter {
  id?: string;
  title: string;
  tags: string[];
  path?: string;
}

/** Result of `parseDoc`. */
export interface ParsedDoc extends DocFrontmatter {
  content: string;
}

function yamlScalar(value: string): string {
  // Quote anything YAML could misread (colons, leading symbols, brackets, quotes, empty).
  return /^[A-Za-z0-9 _.\-()/]+$/.test(value) && value.trim() === value && value !== '' ? value : JSON.stringify(value);
}

/** Serializes a document as Markdown with a YAML frontmatter header. */
export function serializeDoc(doc: Pick<MarkdownDoc, 'id' | 'title' | 'tags' | 'content'> & { path?: string }): string {
  const lines = ['---', `id: ${yamlScalar(doc.id)}`, `title: ${yamlScalar(doc.title)}`];
  if (doc.path) lines.push(`path: ${yamlScalar(doc.path)}`);
  lines.push(`tags: [${doc.tags.map(yamlScalar).join(', ')}]`, '---', '');
  return lines.join('\n') + doc.content;
}

function unquote(value: string): string {
  const v = value.trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    if (v.startsWith('"')) {
      try {
        const parsed: unknown = JSON.parse(v);
        if (typeof parsed === 'string') return parsed;
      } catch {
        /* fall through */
      }
    }
    return v.slice(1, -1);
  }
  return v;
}

function parseTagList(value: string): string[] {
  const v = value.trim();
  const inner = v.startsWith('[') && v.endsWith(']') ? v.slice(1, -1) : v;
  return inner
    .split(',')
    .map((t) => unquote(t))
    .filter((t) => t !== '');
}

/** Title fallback when a file has no frontmatter: the file name without its extension. */
export function titleFromFileName(name: string): string {
  return name.replace(/\.(md|markdown|txt)$/i, '') || name;
}

/**
 * Parses a Markdown file. A file without frontmatter (typically created by the user directly in
 * the cloud UI) yields `id: undefined`, a title from the file name and no tags — the sync layer
 * then assigns a stable id derived from the cloud file id.
 */
export function parseDoc(name: string, text: string): ParsedDoc {
  const normalized = text.replace(/^\uFEFF/, '');
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(normalized);
  if (!match) return { title: titleFromFileName(name), tags: [], content: normalized };

  const fm: DocFrontmatter = { title: titleFromFileName(name), tags: [] };
  const lines = match[1].split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const kv = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
    if (!kv) continue;
    const [, key, rawValue] = kv;
    if (key === 'tags') {
      if (rawValue.trim() === '') {
        // Block list: "- a" lines that follow.
        const items: string[] = [];
        while (i + 1 < lines.length && /^\s*-\s+/.test(lines[i + 1])) items.push(unquote(lines[++i].replace(/^\s*-\s+/, '')));
        fm.tags = items.filter((t) => t !== '');
      } else {
        fm.tags = parseTagList(rawValue);
      }
    } else if (key === 'id') {
      const id = unquote(rawValue);
      if (id) fm.id = id;
    } else if (key === 'title') {
      const title = unquote(rawValue);
      if (title) fm.title = title;
    } else if (key === 'path') {
      const path = unquote(rawValue);
      if (path) fm.path = path;
    }
  }
  return { ...fm, content: normalized.slice(match[0].length) };
}

/** Stable local document id for a cloud file that carries no id (FNV-1a over the file id). */
export function docIdForCloudFile(fileId: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < fileId.length; i++) {
    h ^= fileId.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `doc-${h.toString(16).padStart(8, '0')}`;
}
