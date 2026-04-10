import { useEffect, useState } from 'react';

interface ConfettiPiece {
  id: number;
  x: number;
  color: string;
  delay: number;
  duration: number;
  size: number;
  rotation: number;
}

interface MilestoneConfettiProps {
  milestone: number;
  type: 'likes' | 'followers' | 'uploads' | 'views';
  onComplete: () => void;
}

const MilestoneConfetti = ({ milestone, type, onComplete }: MilestoneConfettiProps) => {
  const [confetti, setConfetti] = useState<ConfettiPiece[]>([]);
  const [visible, setVisible] = useState(true);

  const getTypeColor = () => {
    switch (type) {
      case 'likes': return ['#ef4444', '#f97316', '#ec4899', '#f43f5e', '#fbbf24'];
      case 'followers': return ['#3b82f6', '#8b5cf6', '#06b6d4', '#6366f1', '#a855f7'];
      case 'uploads': return ['#22c55e', '#84cc16', '#10b981', '#14b8a6', '#34d399'];
      case 'views': return ['#f59e0b', '#fbbf24', '#f97316', '#eab308', '#fcd34d'];
      default: return ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6'];
    }
  };

  const formatMilestone = (num: number) => {
    if (num >= 1000000) return `${num / 1000000}M`;
    if (num >= 1000) return `${num / 1000}K`;
    return num.toString();
  };

  const getTypeLabel = () => {
    switch (type) {
      case 'likes': return 'Likes';
      case 'followers': return 'Followers';
      case 'uploads': return 'Uploads';
      case 'views': return 'Views';
      default: return '';
    }
  };

  useEffect(() => {
    const colors = getTypeColor();
    const pieces: ConfettiPiece[] = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      color: colors[Math.floor(Math.random() * colors.length)],
      delay: Math.random() * 0.5,
      duration: 2 + Math.random() * 2,
      size: 8 + Math.random() * 8,
      rotation: Math.random() * 360,
    }));
    setConfetti(pieces);

    const timer = setTimeout(() => {
      setVisible(false);
      onComplete();
    }, 4000);

    return () => clearTimeout(timer);
  }, [onComplete]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {/* Confetti pieces */}
      {confetti.map((piece) => (
        <div
          key={piece.id}
          className="absolute"
          style={{
            left: `${piece.x}%`,
            top: -20,
            width: piece.size,
            height: piece.size * 0.6,
            backgroundColor: piece.color,
            borderRadius: 2,
            transform: `rotate(${piece.rotation}deg)`,
            animation: `confetti-fall ${piece.duration}s ease-in ${piece.delay}s forwards`,
          }}
        />
      ))}

      {/* Milestone badge */}
      <div 
        className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2"
        style={{ animation: 'milestone-pop 0.6s ease-out forwards' }}
      >
        <div className="bg-gradient-to-br from-yellow-400 via-orange-500 to-red-500 rounded-2xl p-1 shadow-2xl">
          <div className="bg-background/90 backdrop-blur-sm rounded-xl px-6 py-4 text-center">
            <div className="text-4xl mb-1">🎉</div>
            <div className="text-2xl font-bold text-foreground">
              {formatMilestone(milestone)}
            </div>
            <div className="text-sm text-muted-foreground font-medium">
              {getTypeLabel()}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes confetti-fall {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }

        @keyframes milestone-pop {
          0% {
            transform: translate(-50%, -50%) scale(0);
            opacity: 0;
          }
          50% {
            transform: translate(-50%, -50%) scale(1.2);
          }
          100% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};

export default MilestoneConfetti;
