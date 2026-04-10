import { useEffect, useState } from 'react';
import { Heart } from 'lucide-react';

interface LikeAnimationProps {
  x: number;
  y: number;
  onComplete: () => void;
}

interface Particle {
  id: number;
  angle: number;
  speed: number;
  size: number;
  color: string;
}

const LikeAnimation = ({ x, y, onComplete }: LikeAnimationProps) => {
  const [visible, setVisible] = useState(true);
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    const colors = ['#ef4444', '#f97316', '#eab308', '#ec4899', '#f43f5e'];
    const newParticles: Particle[] = Array.from({ length: 12 }, (_, i) => ({
      id: i,
      angle: (i * 30) * (Math.PI / 180),
      speed: 80 + Math.random() * 60,
      size: 6 + Math.random() * 8,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));
    setParticles(newParticles);

    const timer = setTimeout(() => {
      setVisible(false);
      onComplete();
    }, 800);

    return () => clearTimeout(timer);
  }, [onComplete]);

  if (!visible) return null;

  return (
    <div
      className="fixed pointer-events-none z-50"
      style={{
        left: x,
        top: y,
        transform: 'translate(-50%, -50%)',
      }}
    >
      {/* Ring explosion effects */}
      <div
        className="absolute rounded-full border-4 border-red-500"
        style={{
          width: 20,
          height: 20,
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          animation: 'ring-explode 0.6s ease-out forwards',
        }}
      />
      <div
        className="absolute rounded-full border-2 border-orange-400"
        style={{
          width: 20,
          height: 20,
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          animation: 'ring-explode 0.6s ease-out 0.1s forwards',
        }}
      />
      <div
        className="absolute rounded-full border-2 border-pink-400"
        style={{
          width: 20,
          height: 20,
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          animation: 'ring-explode 0.6s ease-out 0.2s forwards',
        }}
      />

      {/* Particles */}
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute rounded-full"
          style={{
            width: particle.size,
            height: particle.size,
            backgroundColor: particle.color,
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            animation: `particle-burst-${particle.id % 4} 0.8s ease-out forwards`,
          }}
        />
      ))}
      
      {/* Main heart */}
      <Heart
        className="w-20 h-20 fill-red-500 text-red-500 absolute"
        style={{
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          filter: 'drop-shadow(0 0 20px rgba(239, 68, 68, 0.8))',
          animation: 'heart-pop 0.8s ease-out forwards',
        }}
      />

      <style>{`
        @keyframes ring-explode {
          0% {
            width: 20px;
            height: 20px;
            opacity: 1;
            border-width: 4px;
          }
          100% {
            width: 160px;
            height: 160px;
            opacity: 0;
            border-width: 1px;
          }
        }

        @keyframes heart-pop {
          0% {
            transform: translate(-50%, -50%) scale(0);
            opacity: 0;
          }
          15% {
            transform: translate(-50%, -50%) scale(1.4);
            opacity: 1;
          }
          30% {
            transform: translate(-50%, -50%) scale(0.9);
          }
          45% {
            transform: translate(-50%, -50%) scale(1.1);
          }
          60% {
            transform: translate(-50%, -50%) scale(1);
          }
          100% {
            transform: translate(-50%, -50%) scale(0.8);
            opacity: 0;
          }
        }
        
        @keyframes particle-burst-0 {
          0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
          100% { transform: translate(calc(-50% + 80px), calc(-50% - 60px)) scale(0); opacity: 0; }
        }
        
        @keyframes particle-burst-1 {
          0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
          100% { transform: translate(calc(-50% - 70px), calc(-50% - 50px)) scale(0); opacity: 0; }
        }
        
        @keyframes particle-burst-2 {
          0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
          100% { transform: translate(calc(-50% + 60px), calc(-50% + 70px)) scale(0); opacity: 0; }
        }
        
        @keyframes particle-burst-3 {
          0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
          100% { transform: translate(calc(-50% - 65px), calc(-50% + 55px)) scale(0); opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default LikeAnimation;
