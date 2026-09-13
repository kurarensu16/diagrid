import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Send, 
  Check, 
  HelpCircle, 
  Bug, 
  Sparkles, 
  MessageSquare, 
  BookOpen, 
  Sliders,
  Keyboard,
  Star,
  Paperclip,
  AlertTriangle,
  Trash2,
  UploadCloud,
  Layers
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from './Button';
import { Card } from './Card';
import { adminService } from '../../services/adminService';
import { authService } from '../../services/authService';

export interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  diagramContext?: {
    id?: string;
    type?: string;
    title?: string;
    nodeCount?: number;
    edgeCount?: number;
    zoom?: number;
  };
}

type FeedbackType = 'feature' | 'bug' | 'general';
type FeedbackPriority = 'low' | 'medium' | 'high' | 'critical';

const CSAT_RATINGS = [
  { score: 1, label: 'Very Dissatisfied', color: 'text-signal bg-signal/10 border-signal' },
  { score: 2, label: 'Dissatisfied', color: 'text-amber-700 bg-amber-500/10 border-amber-600' },
  { score: 3, label: 'Neutral', color: 'text-ink-soft bg-paper-raised border-line' },
  { score: 4, label: 'Satisfied', color: 'text-blueprint bg-blueprint/10 border-blueprint' },
  { score: 5, label: 'Very Satisfied', color: 'text-emerald-700 bg-emerald-500/10 border-emerald-600' },
];

const SEVERITY_OPTIONS: { value: FeedbackPriority; label: string; desc: string; color: string }[] = [
  { value: 'low', label: 'Low', desc: 'Cosmetic / minor nuance', color: 'border-line text-ink-soft' },
  { value: 'medium', label: 'Medium', desc: 'Workaround available', color: 'border-blueprint text-blueprint' },
  { value: 'high', label: 'High', desc: 'Feature unusable / broken', color: 'border-amber-600 text-amber-700' },
  { value: 'critical', label: 'Critical', desc: 'Data loss or crash', color: 'border-signal text-signal bg-signal/5' },
];

// Helper to detect simple browser and OS metadata
const getClientTelemetry = (diagramContext?: FeedbackModalProps['diagramContext']) => {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  let browser = 'Unknown Browser';
  if (ua.includes('Firefox/')) browser = 'Firefox';
  else if (ua.includes('Edg/')) browser = 'Microsoft Edge';
  else if (ua.includes('Chrome/')) browser = 'Chrome';
  else if (ua.includes('Safari/')) browser = 'Safari';

  let os = 'Unknown OS';
  if (ua.includes('Win')) os = 'Windows';
  else if (ua.includes('Mac')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

  const viewport = typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : 'N/A';
  const screenRes = typeof window !== 'undefined' && window.screen ? `${window.screen.width}x${window.screen.height}` : 'N/A';
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio : 1;

  return {
    browser,
    os,
    viewport,
    screenRes,
    dpr,
    url: typeof window !== 'undefined' ? window.location.href : '',
    pathname: typeof window !== 'undefined' ? window.location.pathname : '',
    timestamp: new Date().toISOString(),
    diagram: diagramContext || null
  };
};

export const FeedbackModal: React.FC<FeedbackModalProps> = ({ isOpen, onClose, diagramContext }) => {
  const [type, setType] = useState<FeedbackType>('general');
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [priority, setPriority] = useState<FeedbackPriority>('medium');
  const [userEmail, setUserEmail] = useState('');
  const [message, setMessage] = useState('');
  const [attachmentFile, setAttachmentFile] = useState<File | Blob | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
  const [includeTelemetry, setIncludeTelemetry] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const user = authService.getUserSync();

  useEffect(() => {
    if (isOpen) {
      if (user?.email) {
        setUserEmail(user.email);
      }
    } else {
      // Cleanup preview URL
      if (attachmentPreview) {
        URL.revokeObjectURL(attachmentPreview);
        setAttachmentPreview(null);
        setAttachmentFile(null);
      }
    }
  }, [isOpen, user?.email]);

  // Clipboard Paste (Ctrl+V) handler for screenshot paste
  useEffect(() => {
    if (!isOpen) return;

    const handlePaste = (e: ClipboardEvent) => {
      if (e.clipboardData && e.clipboardData.files.length > 0) {
        const file = e.clipboardData.files[0];
        if (file.type.startsWith('image/')) {
          e.preventDefault();
          setAttachmentFile(file);
          const preview = URL.createObjectURL(file);
          setAttachmentPreview(preview);
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isOpen]);

  if (!isOpen) return null;

  const currentScore = hoverRating || rating;
  const currentRatingInfo = CSAT_RATINGS[currentScore - 1] || CSAT_RATINGS[4];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setAttachmentFile(file);
      const preview = URL.createObjectURL(file);
      setAttachmentPreview(preview);
    }
  };

  const removeAttachment = () => {
    if (attachmentPreview) {
      URL.revokeObjectURL(attachmentPreview);
    }
    setAttachmentFile(null);
    setAttachmentPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setStatusMessage('Capturing diagnostics & uploading...');

    try {
      let attachmentUrl: string | undefined = undefined;

      // Upload screenshot attachment if provided
      if (attachmentFile) {
        const uploadRes = await adminService.uploadFeedbackAttachment(attachmentFile);
        if (uploadRes.url) {
          attachmentUrl = uploadRes.url;
        } else if (uploadRes.error) {
          console.warn('[FeedbackModal] Attachment upload warning:', uploadRes.error);
        }
      }

      const clientTelemetry = includeTelemetry ? getClientTelemetry(diagramContext) : undefined;
      const effectiveEmail = userEmail.trim() || user?.email || 'anonymous@diagrid.dev';

      await adminService.submitFeedback({
        userEmail: effectiveEmail,
        type,
        rating,
        ratingLabel: currentRatingInfo.label,
        message: message.trim(),
        pageUrl: typeof window !== 'undefined' ? window.location.pathname + window.location.search : undefined,
        clientMetadata: clientTelemetry,
        attachmentUrl,
        priority: type === 'bug' ? priority : 'medium',
      });

      setIsSubmitting(false);
      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        setMessage('');
        removeAttachment();
        onClose();
      }, 1600);
    } catch (err: any) {
      console.error('[FeedbackModal] Error submitting feedback:', err);
      setStatusMessage('Submission error. Please retry.');
      setIsSubmitting(false);
    }
  };

  const telemetryPreview = getClientTelemetry(diagramContext);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/50 backdrop-blur-xs select-none animate-in fade-in duration-150 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <Card 
        variant="blueprint" 
        className="w-full max-w-[620px] p-0 overflow-hidden shadow-hard-blueprint border-[2px] border-ink bg-paper my-auto"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-line bg-paper-raised">
          <div className="flex items-center gap-2.5">
            <HelpCircle className="w-5 h-5 text-blueprint" />
            <div>
              <h2 className="font-mono text-[15px] font-bold tracking-tight text-ink">
                feedback_and_diagnostics
              </h2>
              <p className="font-mono text-[11px] text-ink-soft">
                // developer telemetry & diagnostic support hub
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-paper border border-transparent hover:border-line text-ink-soft hover:text-ink transition-colors cursor-pointer"
            title="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {submitted ? (
          <div className="p-8 flex flex-col items-center justify-center gap-3 text-center font-mono">
            <div className="w-12 h-12 border border-emerald-600 bg-emerald-500/10 text-emerald-700 flex items-center justify-center">
              <Check className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-lg text-ink">feedback_received()</h3>
            <p className="text-xs text-ink-soft max-w-sm">
              Thank you! Your feedback, diagnostic telemetry, and attachments have been received and queued for review.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4 max-h-[85vh] overflow-y-auto">
            {/* Category Selector */}
            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[11px] font-bold uppercase tracking-wider text-ink">
                submission_category:
              </label>
              <div className="grid grid-cols-3 gap-2 font-mono text-[12px]">
                <button
                  type="button"
                  onClick={() => setType('general')}
                  className={`p-2 border flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                    type === 'general'
                      ? 'border-ink bg-ink text-paper font-bold'
                      : 'border-line bg-paper hover:border-ink text-ink'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  General
                </button>
                <button
                  type="button"
                  onClick={() => setType('feature')}
                  className={`p-2 border flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                    type === 'feature'
                      ? 'border-blueprint bg-blueprint text-white font-bold'
                      : 'border-line bg-paper hover:border-ink text-ink'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Feature Idea
                </button>
                <button
                  type="button"
                  onClick={() => setType('bug')}
                  className={`p-2 border flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                    type === 'bug'
                      ? 'border-signal bg-signal text-white font-bold'
                      : 'border-line bg-paper hover:border-ink text-ink'
                  }`}
                >
                  <Bug className="w-3.5 h-3.5" />
                  Bug Report
                </button>
              </div>
            </div>

            {/* If Bug Report, Show Severity Selector */}
            {type === 'bug' && (
              <div className="flex flex-col gap-1.5 p-3 border border-signal/40 bg-signal/5">
                <div className="flex items-center justify-between">
                  <label className="font-mono text-[11px] font-bold uppercase tracking-wider text-signal flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    bug_severity_level:
                  </label>
                  <span className="font-mono text-[10px] text-ink-soft uppercase font-bold">
                    [{priority}]
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 font-mono text-[11px]">
                  {SEVERITY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setPriority(opt.value)}
                      className={`p-1.5 border text-center transition-colors cursor-pointer flex flex-col items-center gap-0.5 ${
                        priority === opt.value
                          ? 'border-ink bg-ink text-paper font-bold'
                          : 'border-line bg-paper hover:border-ink text-ink'
                      }`}
                      title={opt.desc}
                    >
                      <span>{opt.label}</span>
                      <span className={`text-[9px] ${priority === opt.value ? 'text-paper-raised' : 'text-ink-soft'}`}>
                        {opt.desc.split(' ')[0]}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Industry-Standard 5-Star CSAT Rating */}
            <div className="flex flex-col gap-2 p-3 border border-line bg-paper-raised/40">
              <div className="flex items-center justify-between">
                <label className="font-mono text-[11px] font-bold uppercase tracking-wider text-ink">
                  overall_experience_rating (csat):
                </label>
                <span className={`font-mono text-[11px] font-bold px-2 py-0.5 border ${currentRatingInfo.color}`}>
                  {currentScore}/5 • {currentRatingInfo.label}
                </span>
              </div>

              {/* Star Rating Buttons */}
              <div className="flex items-center justify-between pt-0.5">
                <div 
                  className="flex items-center gap-1.5"
                  onMouseLeave={() => setHoverRating(0)}
                >
                  {[1, 2, 3, 4, 5].map((starIndex) => {
                    const isFilled = starIndex <= currentScore;
                    return (
                      <button
                        key={starIndex}
                        type="button"
                        onClick={() => setRating(starIndex)}
                        onMouseEnter={() => setHoverRating(starIndex)}
                        className="p-1 rounded hover:scale-115 transition-transform cursor-pointer focus:outline-none"
                        title={`${starIndex} Star - ${CSAT_RATINGS[starIndex - 1].label}`}
                      >
                        <Star 
                          className={`w-6 h-6 transition-colors ${
                            isFilled
                              ? 'fill-[#F59E0B] text-[#D97706] drop-shadow-xs'
                              : 'text-[#9AA5A0] fill-transparent hover:text-ink'
                          }`} 
                        />
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-col items-end font-mono text-[10px] text-ink-soft">
                  <span>1: Dissatisfied</span>
                  <span>5: Very Satisfied</span>
                </div>
              </div>
            </div>

            {/* Contact Email input */}
            <div className="flex flex-col gap-1">
              <label className="font-mono text-[11px] font-bold uppercase tracking-wider text-ink flex items-center justify-between">
                <span>contact_email:</span>
                <span className="text-[10px] text-ink-soft font-normal">(for engineering reply & triage updates)</span>
              </label>
              <input
                type="email"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                placeholder="your.email@example.com"
                className="font-mono text-[12px] p-2.5 bg-paper border border-line text-ink focus:outline-none focus:border-ink transition-colors"
              />
            </div>

            {/* Message input */}
            <div className="flex flex-col gap-1">
              <label className="font-mono text-[11px] font-bold uppercase tracking-wider text-ink">
                detailed_notes_and_context:
              </label>
              <textarea
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={
                  type === 'bug'
                    ? 'Describe what happened, what was expected, and reproduction steps...'
                    : type === 'feature'
                    ? 'What capability or notation standard would make Diagrid your daily driver?'
                    : 'Share your thoughts, suggestions, or general impressions...'
                }
                required
                className="font-mono text-[12px] p-2.5 bg-paper border border-line text-ink focus:outline-none focus:border-ink transition-colors resize-none"
              />
            </div>

            {/* Screenshot Attachment & Clipboard paste area */}
            <div className="flex flex-col gap-1.5 p-3 border border-line bg-paper">
              <div className="flex items-center justify-between font-mono text-[11px] font-bold text-ink">
                <span className="flex items-center gap-1.5">
                  <Paperclip className="w-3.5 h-3.5 text-blueprint" />
                  screenshot_attachment:
                </span>
                <span className="text-[10px] text-ink-soft font-normal">
                  (or press <kbd className="px-1 py-0.5 border border-line bg-paper-raised text-ink">Ctrl+V</kbd> to paste image)
                </span>
              </div>

              {attachmentPreview ? (
                <div className="relative border border-line p-2 bg-paper-raised flex items-center gap-3">
                  <img 
                    src={attachmentPreview} 
                    alt="Screenshot attachment preview" 
                    className="w-16 h-16 object-cover border border-line bg-paper shrink-0" 
                  />
                  <div className="flex-1 font-mono text-[11px] overflow-hidden text-ellipsis">
                    <span className="font-bold text-ink block truncate">
                      {attachmentFile instanceof File ? attachmentFile.name : 'Pasted_Screenshot.png'}
                    </span>
                    <span className="text-[10px] text-ink-soft">
                      {attachmentFile ? `${(attachmentFile.size / 1024).toFixed(1)} KB image attached` : ''}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={removeAttachment}
                    className="p-1.5 text-ink-soft hover:text-signal hover:bg-paper border border-transparent hover:border-line transition-colors cursor-pointer"
                    title="Remove attachment"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleFileChange}
                    className="hidden"
                    id="feedback-file-input"
                  />
                  <label
                    htmlFor="feedback-file-input"
                    className="flex-1 border border-dashed border-line hover:border-ink py-2 px-3 text-center font-mono text-[11px] text-ink-soft hover:text-ink bg-paper-raised/40 hover:bg-paper cursor-pointer transition-colors flex items-center justify-center gap-1.5"
                  >
                    <UploadCloud className="w-4 h-4 text-blueprint" />
                    <span>Upload Screenshot (PNG, JPG) or Paste from Clipboard</span>
                  </label>
                </div>
              )}
            </div>

            {/* Diagnostic Telemetry Accordion & Opt-in */}
            <div className="p-3 border border-line bg-paper-raised/40 font-mono text-[11px] flex flex-col gap-2">
              <label className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center gap-2 text-ink font-bold">
                  <input
                    type="checkbox"
                    checked={includeTelemetry}
                    onChange={(e) => setIncludeTelemetry(e.target.checked)}
                    className="cursor-pointer accent-blueprint"
                  />
                  <span>include_diagnostic_telemetry</span>
                </div>
                <span className="text-[10px] text-ink-soft">
                  {includeTelemetry ? '[enabled]' : '[disabled]'}
                </span>
              </label>

              {includeTelemetry && (
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] text-ink-soft border-t border-line/60 pt-2">
                  <div>• OS: <span className="text-ink font-semibold">{telemetryPreview.os}</span></div>
                  <div>• Browser: <span className="text-ink font-semibold">{telemetryPreview.browser}</span></div>
                  <div>• Viewport: <span className="text-ink font-semibold">{telemetryPreview.viewport}</span></div>
                  <div>• Path: <span className="text-ink font-semibold truncate block">{telemetryPreview.pathname || '/'}</span></div>
                  {diagramContext?.title && (
                    <div className="col-span-2 flex items-center gap-1 text-blueprint">
                      <Layers className="w-3 h-3 shrink-0" />
                      <span>Canvas: {diagramContext.title} ({diagramContext.type || 'flowchart'}, {diagramContext.nodeCount || 0} shapes)</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Quick Links Footer */}
            <div className="p-2.5 border border-dashed border-line bg-paper-raised/30 flex items-center justify-between font-mono text-[11px]">
              <span className="text-ink-soft flex items-center gap-1.5">
                <Keyboard className="w-3.5 h-3.5 text-blueprint" />
                need_quick_help?
              </span>
              <div className="flex items-center gap-3 text-ink-soft">
                <Link 
                  to="/docs" 
                  onClick={onClose}
                  className="flex items-center gap-1 text-blueprint hover:underline"
                >
                  <BookOpen className="w-3 h-3" />
                  docs()
                </Link>
                <Link 
                  to="/settings" 
                  onClick={onClose}
                  className="flex items-center gap-1 text-blueprint hover:underline"
                >
                  <Sliders className="w-3 h-3" />
                  settings()
                </Link>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-line">
              <div className="font-mono text-[11px] text-amber-700">
                {statusMessage}
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  type="button" 
                  variant="secondary" 
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-[12px]"
                >
                  cancel()
                </Button>
                <Button 
                  type="submit" 
                  variant="primary" 
                  disabled={!message.trim() || isSubmitting}
                  className="flex items-center gap-1.5 px-4 py-2 text-[12px]"
                >
                  <Send className="w-3.5 h-3.5" />
                  {isSubmitting ? 'submitting...' : 'submit_feedback()'}
                </Button>
              </div>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
};

