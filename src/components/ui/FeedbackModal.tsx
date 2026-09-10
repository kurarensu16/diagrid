import React, { useState } from 'react';
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
  Star
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from './Button';
import { Card } from './Card';
import { adminService } from '../../services/adminService';
import { authService } from '../../services/authService';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type FeedbackType = 'feature' | 'bug' | 'general';

const CSAT_RATINGS = [
  { score: 1, label: 'Very Dissatisfied', color: 'text-signal bg-signal/10 border-signal' },
  { score: 2, label: 'Dissatisfied', color: 'text-amber-700 bg-amber-500/10 border-amber-600' },
  { score: 3, label: 'Neutral', color: 'text-ink-soft bg-paper-raised border-line' },
  { score: 4, label: 'Satisfied', color: 'text-blueprint bg-blueprint/10 border-blueprint' },
  { score: 5, label: 'Very Satisfied', color: 'text-emerald-700 bg-emerald-500/10 border-emerald-600' },
];

export const FeedbackModal: React.FC<FeedbackModalProps> = ({ isOpen, onClose }) => {
  const [type, setType] = useState<FeedbackType>('general');
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const currentScore = hoverRating || rating;
  const currentRatingInfo = CSAT_RATINGS[currentScore - 1] || CSAT_RATINGS[4];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || isSubmitting) return;

    setIsSubmitting(true);
    const user = authService.getUserSync();

    await adminService.submitFeedback({
      userEmail: user?.email || 'anonymous@diagrid.dev',
      type,
      rating,
      ratingLabel: currentRatingInfo.label,
      message: message.trim(),
    });

    setIsSubmitting(false);
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setMessage('');
      onClose();
    }, 1400);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/50 backdrop-blur-xs select-none animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <Card 
        variant="blueprint" 
        className="w-full max-w-[560px] p-0 overflow-hidden shadow-hard-blueprint border-[2px] border-ink bg-paper"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-line bg-paper-raised">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-blueprint" />
            <div>
              <h2 className="font-mono text-[15px] font-bold tracking-tight text-ink">
                feedback_and_support
              </h2>
              <p className="font-mono text-[11px] text-ink-soft">
                // developer telemetry & support hub
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
              Thank you for rating your experience! Your telemetry and notes have been logged.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5">
            {/* Category Selector */}
            <div className="flex flex-col gap-2">
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
                  Feature
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
                  Bug
                </button>
              </div>
            </div>

            {/* Industry-Standard 5-Star CSAT Rating */}
            <div className="flex flex-col gap-2.5 p-3.5 border border-line bg-paper-raised/40">
              <div className="flex items-center justify-between">
                <label className="font-mono text-[11px] font-bold uppercase tracking-wider text-ink">
                  overall_experience_rating (csat):
                </label>
                <span className={`font-mono text-[11px] font-bold px-2 py-0.5 border ${currentRatingInfo.color}`}>
                  {currentScore}/5 • {currentRatingInfo.label}
                </span>
              </div>

              {/* Star Rating Buttons */}
              <div className="flex items-center justify-between pt-1">
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
                        className="p-1.5 rounded hover:scale-115 transition-transform cursor-pointer focus:outline-none"
                        title={`${starIndex} Star - ${CSAT_RATINGS[starIndex - 1].label}`}
                      >
                        <Star 
                          className={`w-7 h-7 transition-colors ${
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
                  <span>1: Very Dissatisfied</span>
                  <span>5: Very Satisfied</span>
                </div>
              </div>
            </div>

            {/* Message input */}
            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[11px] font-bold uppercase tracking-wider text-ink">
                notes_and_context:
              </label>
              <textarea
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={
                  type === 'bug'
                    ? 'Describe what happened, what you expected, and any reproduction steps...'
                    : type === 'feature'
                    ? 'What capability or notation standard would make Diagrid your daily driver?'
                    : 'Share your thoughts, suggestions, or general impressions...'
                }
                required
                className="font-mono text-[12px] p-3 bg-paper border border-line text-ink focus:outline-none focus:border-ink transition-colors resize-none"
              />
            </div>

            {/* Helpful Resources Footer */}
            <div className="p-3 border border-dashed border-line bg-paper-raised/50 flex flex-col gap-2 font-mono text-[11px]">
              <span className="text-ink font-bold flex items-center gap-1.5">
                <Keyboard className="w-3.5 h-3.5 text-blueprint" />
                quick_support_links:
              </span>
              <div className="flex items-center gap-4 text-ink-soft">
                <Link 
                  to="/docs" 
                  onClick={onClose}
                  className="flex items-center gap-1 text-blueprint hover:underline"
                >
                  <BookOpen className="w-3 h-3" />
                  documentation()
                </Link>
                <Link 
                  to="/settings" 
                  onClick={onClose}
                  className="flex items-center gap-1 text-blueprint hover:underline"
                >
                  <Sliders className="w-3 h-3" />
                  settings_and_db()
                </Link>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-line">
              <Button 
                type="button" 
                variant="secondary" 
                onClick={onClose}
                className="px-4 py-2 text-[12px]"
              >
                cancel()
              </Button>
              <Button 
                type="submit" 
                variant="primary" 
                disabled={!message.trim()}
                className="flex items-center gap-1.5 px-4 py-2 text-[12px]"
              >
                <Send className="w-3.5 h-3.5" />
                submit_feedback()
              </Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
};
