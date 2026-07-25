import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { FileItem } from '../types';
import { generateFlashcardsFromNote } from '../utils/markdownUtils';

interface FlashcardsModalProps {
  file: FileItem;
  onClose: () => void;
}

export const FlashcardsModal: React.FC<FlashcardsModalProps> = ({ file, onClose }) => {
  const [cards] = useState(() => 
    generateFlashcardsFromNote(file.name, file.content || '')
  );
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [reviewedCount, setReviewedCount] = useState<number>(0);

  const currentCard = cards[currentIndex];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        setIsFlipped(prev => !prev);
      } else if (e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit3') {
        handleNextCard();
      } else if (e.code === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cards, currentIndex, onClose]);

  const handleNextCard = () => {
    setIsFlipped(false);
    setReviewedCount(prev => prev + 1);
    if (currentIndex < cards.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      // Loop back to start
      setCurrentIndex(0);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: 640, padding: 28 }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)' }}>
              Active Recall Flashcards
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Note: {file.name} ({cards.length} Cards)
            </span>
          </div>
          <button className="btn-icon" style={{ width: 32, height: 32 }} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {cards.length > 0 ? (
          <div>
            {/* 3D Flip Flashcard */}
            <div className="flashcard-wrapper" onClick={() => setIsFlipped(!isFlipped)}>
              <div className={`flashcard-inner ${isFlipped ? 'flipped' : ''}`}>
                {/* Front (Question) */}
                <div className="flashcard-front">
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--primary)', marginBottom: 12 }}>
                    Question (Click or Space to Flip)
                  </span>
                  <p style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-main)', lineHeight: 1.5 }}>
                    {currentCard?.question}
                  </p>
                </div>

                {/* Back (Answer) */}
                <div className="flashcard-back">
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--accent-emerald)', marginBottom: 12 }}>
                    Answer & Concept Explanation
                  </span>
                  <p style={{ fontSize: '1rem', color: 'var(--text-main)', lineHeight: 1.6 }}>
                    {currentCard?.answer}
                  </p>
                </div>
              </div>
            </div>

            {/* Difficulty Controls */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 24 }}>
              <button 
                className="tool-btn"
                style={{ background: 'rgba(244, 63, 94, 0.15)', color: 'var(--accent-rose)', padding: '8px 20px', borderRadius: 'var(--radius-md)', fontWeight: 700 }}
                onClick={handleNextCard}
              >
                1 · Hard
              </button>
              <button 
                className="tool-btn"
                style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'var(--accent-amber)', padding: '8px 20px', borderRadius: 'var(--radius-md)', fontWeight: 700 }}
                onClick={handleNextCard}
              >
                2 · Good
              </button>
              <button 
                className="tool-btn"
                style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--accent-emerald)', padding: '8px 20px', borderRadius: 'var(--radius-md)', fontWeight: 700 }}
                onClick={handleNextCard}
              >
                3 · Easy
              </button>
            </div>

            {/* Footer Meter */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              <span>Card {currentIndex + 1} of {cards.length}</span>
              <span>Total Reviewed: {reviewedCount}</span>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
            <p>No headings or question patterns found in this note to generate flashcards.</p>
          </div>
        )}
      </div>
    </div>
  );
};
