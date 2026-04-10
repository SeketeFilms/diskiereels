import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';

interface StarParticle {
  id: number;
  x: number;
  y: number;
  size: number;
  delay: number;
  duration: number;
  rotation: number;
}

interface StarGiftAnimationProps {
  amount: number;
  onComplete: () => void;
}

const StarGiftAnimation = ({ amount, onComplete }: StarGiftAnimationProps) => {
  const [particles, setParticles] = useState<StarParticle[]>([]);
  const [showBurst, setShowBurst] = useState(true);

  useEffect(() => {
    const count = Math.min(amount * 2, 30);
    const newParticles: StarParticle[] = Array.from({ length: count }, (_, i) => ({
      id: i,
      x: 40 + Math.random() * 20,
      y: 50 + Math.random() * 10,
      size: 12 + Math.random() * 20,
      delay: Math.random() * 0.5,
      duration: 0.8 + Math.random() * 0.8,
      rotation: Math.random() * 360,
    }));
    setParticles(newParticles);

    const timer = setTimeout(() => {
      setShowBurst(false);
      onComplete();
    }, 2200);

    return () => clearTimeout(timer);
  }, [amount, onComplete]);

  if (!showBurst) return null;

  return (
    <div className="fixed inset-0 z-[200] pointer-events-none overflow-hidden">
      {/* Central burst text */}
      <div className="absolute inset-0 flex items-center justify-center animate-scale-in">
        <div className="flex items-center gap-2 bg-card/90 backdrop-blur-md rounded-2xl px-6 py-3 border border-yellow-500/40 shadow-xl">
          <Star className="h-8 w-8 text-yellow-500 fill-yellow-500" />
          <span className="text-3xl font-black text-foreground">+{amount}</span>
        </div>
      </div>

      {/* Flying star particles */}
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            animation: `starFly ${p.duration}s ease-out ${p.delay}s forwards`,
            transform: `rotate(${p.rotation}deg)`,
          }}
        >
          <Star
            className="text-yellow-500 fill-yellow-500"
            style={{ width: p.size, height: p.size }}
          />
        </div>
      ))}

      <style>{`
        @keyframes starFly {
          0% {
            opacity: 1;
            transform: translate(0, 0) scale(1) rotate(0deg);
          }
          50% {
            opacity: 1;
            transform: translate(${Math.random() > 0.5 ? '' : '-'}${60 + Math.random() * 120}px, -${80 + Math.random() * 150}px) scale(1.3) rotate(180deg);
          }
          100% {
            opacity: 0;
            transform: translate(${Math.random() > 0.5 ? '' : '-'}${120 + Math.random() * 200}px, -${200 + Math.random() * 200}px) scale(0.3) rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
};

export default StarGiftAnimation;
