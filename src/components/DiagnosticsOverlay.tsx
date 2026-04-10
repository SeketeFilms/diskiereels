import { useState, useEffect, useRef, useCallback } from 'react';
import { Activity, X, Wifi, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DiagnosticsOverlayProps {
  enabled?: boolean;
}

export default function DiagnosticsOverlay({ enabled = false }: DiagnosticsOverlayProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [fps, setFps] = useState(0);
  const [networkCount, setNetworkCount] = useState(0);
  const [slowRenders, setSlowRenders] = useState(0);
  const [memoryUsage, setMemoryUsage] = useState<number | null>(null);
  
  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const renderTimesRef = useRef<number[]>([]);
  const networkCountRef = useRef(0);

  // FPS tracking
  useEffect(() => {
    if (!isVisible) return;

    let animationFrameId: number;
    
    const measureFps = (currentTime: number) => {
      frameCountRef.current++;
      
      const elapsed = currentTime - lastTimeRef.current;
      if (elapsed >= 1000) {
        setFps(Math.round((frameCountRef.current * 1000) / elapsed));
        frameCountRef.current = 0;
        lastTimeRef.current = currentTime;
      }
      
      animationFrameId = requestAnimationFrame(measureFps);
    };
    
    animationFrameId = requestAnimationFrame(measureFps);
    
    return () => cancelAnimationFrame(animationFrameId);
  }, [isVisible]);

  // Network request tracking
  useEffect(() => {
    if (!isVisible) return;

    const originalFetch = window.fetch;
    
    window.fetch = function (...args) {
      networkCountRef.current++;
      setNetworkCount(networkCountRef.current);
      return originalFetch.apply(this, args);
    };
    
    return () => {
      window.fetch = originalFetch;
    };
  }, [isVisible]);

  // Slow render detection using Performance Observer
  useEffect(() => {
    if (!isVisible) return;
    if (typeof PerformanceObserver === 'undefined') return;

    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'longtask' || entry.duration > 50) {
          renderTimesRef.current.push(entry.duration);
          setSlowRenders(renderTimesRef.current.length);
        }
      }
    });

    try {
      observer.observe({ entryTypes: ['longtask'] });
    } catch {
      // longtask not supported in all browsers
    }

    return () => observer.disconnect();
  }, [isVisible]);

  // Memory usage (Chrome only)
  useEffect(() => {
    if (!isVisible) return;
    
    const updateMemory = () => {
      if ((performance as any).memory) {
        const mb = Math.round((performance as any).memory.usedJSHeapSize / 1048576);
        setMemoryUsage(mb);
      }
    };
    
    updateMemory();
    const interval = setInterval(updateMemory, 2000);
    
    return () => clearInterval(interval);
  }, [isVisible]);

  // Reset counters
  const handleReset = useCallback(() => {
    networkCountRef.current = 0;
    setNetworkCount(0);
    renderTimesRef.current = [];
    setSlowRenders(0);
  }, []);

  // Toggle with keyboard shortcut (Ctrl+Shift+D)
  useEffect(() => {
    if (!enabled) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        setIsVisible(v => !v);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled]);

  if (!enabled) return null;

  // Floating toggle button
  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-24 right-4 z-[200] p-2 rounded-full bg-black/70 text-white/70 hover:bg-black hover:text-white transition-colors"
        title="Show Diagnostics (Ctrl+Shift+D)"
      >
        <Activity className="h-5 w-5" />
      </button>
    );
  }

  const fpsColor = fps >= 50 ? 'text-green-400' : fps >= 30 ? 'text-yellow-400' : 'text-red-400';
  const slowRenderColor = slowRenders === 0 ? 'text-green-400' : slowRenders < 5 ? 'text-yellow-400' : 'text-red-400';

  return (
    <div className="fixed top-16 right-4 z-[200] bg-black/90 text-white text-xs rounded-lg p-3 min-w-[180px] font-mono shadow-xl border border-white/10">
      <div className="flex items-center justify-between mb-2">
        <span className="font-bold flex items-center gap-1">
          <Activity className="h-3 w-3" />
          Diagnostics
        </span>
        <button onClick={() => setIsVisible(false)} className="hover:text-red-400">
          <X className="h-4 w-4" />
        </button>
      </div>
      
      <div className="space-y-1.5">
        <div className="flex justify-between">
          <span className="text-white/60">FPS:</span>
          <span className={fpsColor}>{fps}</span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-white/60 flex items-center gap-1">
            <Wifi className="h-3 w-3" />
            Network:
          </span>
          <span className="text-blue-400">{networkCount} reqs</span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-white/60 flex items-center gap-1">
            <Zap className="h-3 w-3" />
            Slow renders:
          </span>
          <span className={slowRenderColor}>{slowRenders}</span>
        </div>
        
        {memoryUsage !== null && (
          <div className="flex justify-between">
            <span className="text-white/60">Memory:</span>
            <span className="text-purple-400">{memoryUsage} MB</span>
          </div>
        )}
      </div>
      
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={handleReset}
        className="w-full mt-2 h-6 text-xs text-white/60 hover:text-white"
      >
        Reset Counters
      </Button>
    </div>
  );
}
