import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { type Diagram, type CanvasNode, type CanvasEdge } from '../../services/mockDb';
import { type FreehandDrawing } from '../../utils/diagramExport';
import { encodeSharePayload } from '../../utils/shareUtils';
import {
  X,
  Copy,
  Check,
  ExternalLink,
  Code,
  Globe,
  FileText,
  Sparkles,
  Layout
} from 'lucide-react';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  diagram: Diagram | null;
  nodes?: CanvasNode[];
  edges?: CanvasEdge[];
  drawings?: FreehandDrawing[];
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  diagram,
  nodes = [],
  edges = [],
  drawings = []
}) => {
  const [activeTab, setActiveTab] = useState<'link' | 'embed' | 'markdown'>('link');
  const [embedTheme, setEmbedTheme] = useState<'paper' | 'dark' | 'white' | 'transparent'>('paper');
  const [embedGrid, setEmbedGrid] = useState(true);
  const [embedControls, setEmbedControls] = useState(true);
  const [embedHeight, setEmbedHeight] = useState('500');

  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedEmbed, setCopiedEmbed] = useState(false);
  const [copiedMarkdown, setCopiedMarkdown] = useState(false);

  if (!isOpen || !diagram) return null;

  const origin = window.location.origin;

  // Build resilient payload with current live canvas state
  const contentPayload = (nodes.length > 0 || edges.length > 0 || drawings.length > 0)
    ? JSON.stringify({ nodes, edges, drawings })
    : (typeof diagram.content === 'string' ? diagram.content : JSON.stringify(diagram.content || { nodes: [], edges: [] }));

  const encodedHash = encodeSharePayload({
    id: diagram.id,
    title: diagram.title,
    type: diagram.type,
    content: contentPayload
  });

  const hashParam = encodedHash ? `#d=${encodedHash}` : '';
  const publicViewUrl = `${origin}/view/${diagram.id}${hashParam}`;
  const embedUrl = `${origin}/embed/${diagram.id}?theme=${embedTheme}&grid=${embedGrid}&controls=${embedControls}${hashParam}`;

  const iframeSnippet = `<iframe
  src="${embedUrl}"
  width="100%"
  height="${embedHeight}"
  style="border: 2px solid #15191C; border-radius: 0px;"
  title="${diagram.title}"
  allowfullscreen
></iframe>`;

  const markdownSnippet = `[![Diagrid - ${diagram.title}](${publicViewUrl})](${publicViewUrl})

*Interactive Technical Blueprint generated with [Diagrid](${origin})*`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicViewUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  const handleCopyEmbed = async () => {
    try {
      await navigator.clipboard.writeText(iframeSnippet);
      setCopiedEmbed(true);
      setTimeout(() => setCopiedEmbed(false), 2500);
    } catch (err) {
      console.error('Failed to copy embed code:', err);
    }
  };

  const handleCopyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(markdownSnippet);
      setCopiedMarkdown(true);
      setTimeout(() => setCopiedMarkdown(false), 2500);
    } catch (err) {
      console.error('Failed to copy markdown:', err);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 sm:p-6 z-50 backdrop-blur-sm">
      <div className="w-full max-w-3xl bg-paper border-2 border-ink shadow-hard-blueprint flex flex-col max-h-[90vh] overflow-hidden">
        {/* Modal Header */}
        <div className="h-14 border-b-2 border-ink bg-ink text-paper px-6 flex items-center justify-between font-mono select-none">
          <div className="flex items-center gap-3">
            <span className="text-signal border border-signal px-2 py-0.5 text-[10px] uppercase font-bold bg-paper">
              Share Suite
            </span>
            <span className="font-bold text-white text-[15px]">
              Share & Embed Diagram
            </span>
            <span className="text-[#A6B2AD] text-[12px] hidden sm:inline">
              // {diagram.title}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 border border-[#2D363C] text-paper hover:bg-paper hover:text-ink transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Tab Navigation */}
        <div className="h-11 border-b-2 border-ink flex bg-paper-raised font-mono text-[12px] select-none">
          <button
            type="button"
            onClick={() => setActiveTab('link')}
            className={`flex-1 flex items-center justify-center gap-2 border-r border-ink font-bold transition-colors cursor-pointer ${
              activeTab === 'link' ? 'bg-paper text-blueprint border-b-2 border-b-blueprint -mb-[2px]' : 'text-ink-soft hover:text-ink hover:bg-paper'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Public Link</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('embed')}
            className={`flex-1 flex items-center justify-center gap-2 border-r border-ink font-bold transition-colors cursor-pointer ${
              activeTab === 'embed' ? 'bg-paper text-blueprint border-b-2 border-b-blueprint -mb-[2px]' : 'text-ink-soft hover:bg-paper'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            <span>Embed Widget</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('markdown')}
            className={`flex-1 flex items-center justify-center gap-2 font-bold transition-colors cursor-pointer ${
              activeTab === 'markdown' ? 'bg-paper text-blueprint border-b-2 border-b-blueprint -mb-[2px]' : 'text-ink-soft hover:text-ink hover:bg-paper'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Markdown & Docs</span>
          </button>
        </div>

        {/* Modal Body Content */}
        <div className="flex-1 p-6 overflow-y-auto font-mono flex flex-col gap-6">
          {/* TAB 1: Public Share Link */}
          {activeTab === 'link' && (
            <div className="flex flex-col gap-5">
              <div className="p-4 border-2 border-ink bg-paper-raised flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-bold text-ink flex items-center gap-2">
                    <Globe className="w-4 h-4 text-blueprint" />
                    Public View-Only Link
                  </span>
                  <span className="text-[10px] uppercase font-bold text-blueprint px-2 py-0.5 border border-blueprint bg-paper">
                    Live Interactive
                  </span>
                </div>
                <p className="text-[11px] text-ink-soft leading-relaxed">
                  Anyone with this link can view the diagram in a full-screen interactive viewport with pan, zoom, shape inspection, and export tools.
                </p>

                {/* URL Input Box + Actions */}
                <div className="flex flex-col sm:flex-row gap-2 pt-2">
                  <input
                    type="text"
                    readOnly
                    value={publicViewUrl}
                    className="flex-1 px-3 py-2.5 bg-paper border-2 border-ink text-ink text-[12px] font-mono select-all focus:outline-none focus:border-blueprint"
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="primary"
                      onClick={handleCopyLink}
                      className="px-4 py-2 text-[12px] flex items-center gap-1.5 shrink-0"
                    >
                      {copiedLink ? (
                        <>
                          <Check className="w-4 h-4 text-paper" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          <span>Copy Link</span>
                        </>
                      )}
                    </Button>
                    <a
                      href={publicViewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 border-2 border-ink bg-paper hover:bg-paper-raised text-ink transition-colors flex items-center justify-center"
                      title="Open in new window"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              </div>

              {/* Information Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                <div className="p-3 border border-line bg-paper-raised flex flex-col gap-1.5">
                  <div className="font-bold text-ink flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-blueprint" />
                    Read-Only Protection
                  </div>
                  <div className="text-ink-soft">
                    Visitors cannot modify your original canvas. They can clone a fork into their own account if desired.
                  </div>
                </div>

                <div className="p-3 border border-line bg-paper-raised flex flex-col gap-1.5">
                  <div className="font-bold text-ink flex items-center gap-1.5">
                    <Layout className="w-3.5 h-3.5 text-signal" />
                    Always Up to Date
                  </div>
                  <div className="text-ink-soft">
                    Any edits you save in the editor are immediately visible to anyone visiting this link.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Embed Widget */}
          {activeTab === 'embed' && (
            <div className="flex flex-col gap-5">
              {/* Embed Configuration Options */}
              <div className="p-4 border-2 border-ink bg-paper-raised flex flex-col gap-4">
                <div className="text-[12px] font-bold text-ink flex items-center gap-2">
                  <Code className="w-4 h-4 text-blueprint" />
                  Customize Embed Parameters
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {/* Theme */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10.5px] uppercase font-bold text-ink-soft">Theme</label>
                    <div className="grid grid-cols-2 border-2 border-ink text-[11px] text-center bg-paper">
                      {(['paper', 'dark', 'white', 'transparent'] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setEmbedTheme(t)}
                          className={`py-1.5 border-r border-b border-ink transition-colors cursor-pointer capitalize text-[10.5px] ${
                            embedTheme === t ? 'bg-ink text-paper font-bold' : 'text-ink-soft hover:bg-paper-raised'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Grid Overlay */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10.5px] uppercase font-bold text-ink-soft">Blueprint Grid</label>
                    <div className="grid grid-cols-2 border-2 border-ink text-[11px] text-center bg-paper">
                      <button
                        type="button"
                        onClick={() => setEmbedGrid(true)}
                        className={`py-1.5 border-r border-ink transition-colors cursor-pointer text-[10.5px] ${
                          embedGrid ? 'bg-blueprint text-paper font-bold' : 'text-ink-soft hover:bg-paper-raised'
                        }`}
                      >
                        On
                      </button>
                      <button
                        type="button"
                        onClick={() => setEmbedGrid(false)}
                        className={`py-1.5 transition-colors cursor-pointer text-[10.5px] ${
                          !embedGrid ? 'bg-ink text-paper font-bold' : 'text-ink-soft hover:bg-paper-raised'
                        }`}
                      >
                        Off
                      </button>
                    </div>
                  </div>

                  {/* Controls */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10.5px] uppercase font-bold text-ink-soft">Mini Controls</label>
                    <div className="grid grid-cols-2 border-2 border-ink text-[11px] text-center bg-paper">
                      <button
                        type="button"
                        onClick={() => setEmbedControls(true)}
                        className={`py-1.5 border-r border-ink transition-colors cursor-pointer text-[10.5px] ${
                          embedControls ? 'bg-blueprint text-paper font-bold' : 'text-ink-soft hover:bg-paper-raised'
                        }`}
                      >
                        Show
                      </button>
                      <button
                        type="button"
                        onClick={() => setEmbedControls(false)}
                        className={`py-1.5 transition-colors cursor-pointer text-[10.5px] ${
                          !embedControls ? 'bg-ink text-paper font-bold' : 'text-ink-soft hover:bg-paper-raised'
                        }`}
                      >
                        Hide
                      </button>
                    </div>
                  </div>

                  {/* Height */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10.5px] uppercase font-bold text-ink-soft">Height (px)</label>
                    <div className="flex items-center">
                      <input
                        type="number"
                        value={embedHeight}
                        onChange={(e) => setEmbedHeight(e.target.value)}
                        className="w-full px-3 py-1.5 border-2 border-ink bg-paper text-ink font-bold text-[12px] font-mono text-center"
                        min="300"
                        max="1200"
                        step="50"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Code Snippet Box */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-ink">HTML Iframe Code</span>
                  <span className="text-ink-soft">Paste into Notion, HTML docs, or blogs</span>
                </div>
                <div className="relative border-2 border-ink bg-[#101417] text-[#E2E8F0] p-4 text-[11.5px] leading-relaxed overflow-x-auto">
                  <pre className="whitespace-pre font-mono">{iframeSnippet}</pre>
                </div>
                <Button
                  variant="primary"
                  onClick={handleCopyEmbed}
                  className="w-full py-2.5 text-[12px] flex items-center justify-center gap-2 shadow-hard-ink"
                >
                  {copiedEmbed ? (
                    <>
                      <Check className="w-4 h-4 text-paper" />
                      <span>Copied Iframe Code to Clipboard!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copy Iframe Embed Code</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* TAB 3: Markdown & Docs */}
          {activeTab === 'markdown' && (
            <div className="flex flex-col gap-5">
              <div className="p-4 border-2 border-ink bg-paper-raised flex flex-col gap-2">
                <div className="text-[12px] font-bold text-ink flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blueprint" />
                  Markdown Badge Snippet
                </div>
                <p className="text-[11px] text-ink-soft leading-relaxed">
                  Embed this Markdown snippet into your GitHub README, technical wiki, or engineering handbook.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <div className="relative border-2 border-ink bg-[#101417] text-[#E2E8F0] p-4 text-[11.5px] leading-relaxed overflow-x-auto">
                  <pre className="whitespace-pre font-mono">{markdownSnippet}</pre>
                </div>
                <Button
                  variant="primary"
                  onClick={handleCopyMarkdown}
                  className="w-full py-2.5 text-[12px] flex items-center justify-center gap-2 shadow-hard-ink"
                >
                  {copiedMarkdown ? (
                    <>
                      <Check className="w-4 h-4 text-paper" />
                      <span>Copied Markdown Snippet!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copy Markdown Snippet</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="h-14 border-t-2 border-ink bg-paper-raised px-6 flex items-center justify-between font-mono text-[12px]">
          <span className="text-ink-soft text-[11px]">
            Diagram ID: <span className="font-bold text-ink">{diagram.id}</span>
          </span>
          <Button variant="secondary" onClick={onClose} className="px-4 py-1.5 text-[11px]">
            Done
          </Button>
        </div>
      </div>
    </div>
  );
};
