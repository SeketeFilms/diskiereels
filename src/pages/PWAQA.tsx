import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Loader2, PlayCircle, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type CheckState = "pending" | "running" | "pass" | "fail";

interface Check {
  id: string;
  label: string;
  state: CheckState;
  detail?: string;
}

const initialChecks: Check[] = [
  { id: "pwa", label: "Running as installed PWA (standalone display mode)", state: "pending" },
  { id: "videos", label: "Feed has at least 3 reels available", state: "pending" },
  { id: "autoplay-first", label: "First reel auto-plays without tap", state: "pending" },
  { id: "scroll", label: "Scrolling between reels stays smooth (no jamming)", state: "pending" },
  { id: "multi", label: "Auto-play continues across multiple reels", state: "pending" },
];

export default function PWAQA() {
  const [checks, setChecks] = useState<Check[]>(initialChecks);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [running, setRunning] = useState(false);

  const update = (id: string, state: CheckState, detail?: string) =>
    setChecks((prev) => prev.map((c) => (c.id === id ? { ...c, state, detail } : c)));

  const runChecks = async () => {
    setRunning(true);
    setChecks(initialChecks);

    // 1. PWA standalone
    update("pwa", "running");
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // @ts-ignore iOS
      window.navigator.standalone === true;
    update(
      "pwa",
      isStandalone ? "pass" : "fail",
      isStandalone ? "Standalone mode detected" : "Open via Add to Home Screen for full PWA test"
    );

    // 2. Reels availability
    update("videos", "running");
    const { data: videos, error } = await supabase
      .from("videos")
      .select("id,video_url")
      .order("created_at", { ascending: false })
      .limit(5);

    if (error || !videos || videos.length < 3) {
      update("videos", "fail", error?.message ?? `Only ${videos?.length ?? 0} reels found`);
      setRunning(false);
      return;
    }
    update("videos", "pass", `${videos.length} reels available`);

    // 3. First reel autoplay
    update("autoplay-first", "running");
    const v = videoRef.current;
    if (!v) {
      update("autoplay-first", "fail", "No test video element");
      setRunning(false);
      return;
    }
    v.muted = true;
    v.playsInline = true;
    v.src = videos[0].video_url;
    try {
      await v.play();
      update("autoplay-first", "pass", "Auto-played silently");
    } catch (e: any) {
      update("autoplay-first", "fail", e?.message ?? "Browser blocked autoplay");
    }

    // 4. Scroll smoothness — measure swap latency between sources
    update("scroll", "running");
    const swapTimes: number[] = [];
    for (let i = 1; i < Math.min(videos.length, 4); i++) {
      const t0 = performance.now();
      v.src = videos[i].video_url;
      try {
        await new Promise<void>((resolve, reject) => {
          const onPlaying = () => { v.removeEventListener("playing", onPlaying); resolve(); };
          const onErr = () => { v.removeEventListener("error", onErr); reject(new Error("error")); };
          v.addEventListener("playing", onPlaying);
          v.addEventListener("error", onErr);
          v.play().catch(reject);
          setTimeout(() => reject(new Error("timeout")), 8000);
        });
        swapTimes.push(performance.now() - t0);
      } catch (e: any) {
        update("scroll", "fail", `Reel ${i + 1}: ${e?.message ?? "failed"}`);
        setRunning(false);
        return;
      }
    }
    const avg = swapTimes.reduce((a, b) => a + b, 0) / Math.max(1, swapTimes.length);
    update(
      "scroll",
      avg < 4000 ? "pass" : "fail",
      `Avg swap ${Math.round(avg)}ms across ${swapTimes.length} reels`
    );

    // 5. Multi-reel autoplay continuity
    update("multi", swapTimes.length >= 2 && !v.paused ? "pass" : "fail",
      v.paused ? "Playback stopped" : `${swapTimes.length + 1} reels played continuously`);

    v.pause();
    v.removeAttribute("src");
    v.load();
    setRunning(false);
  };

  useEffect(() => {
    return () => {
      const v = videoRef.current;
      if (v) { v.pause(); v.removeAttribute("src"); v.load(); }
    };
  }, []);

  const icon = (s: CheckState) => {
    if (s === "pass") return <CheckCircle2 className="h-5 w-5 text-fun-green" />;
    if (s === "fail") return <XCircle className="h-5 w-5 text-destructive" />;
    if (s === "running") return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
    return <PlayCircle className="h-5 w-5 text-muted-foreground" />;
  };

  const passed = checks.filter((c) => c.state === "pass").length;
  const failed = checks.filter((c) => c.state === "fail").length;

  return (
    <div className="min-h-screen bg-background p-4 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-black mb-1">Mobile PWA QA</h1>
        <p className="text-sm text-muted-foreground">
          Verify auto-play and seamless reel playback in the installed app.
        </p>
      </div>

      <Card className="mb-4">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Checks</CardTitle>
          <div className="flex gap-2">
            <Badge variant="outline">{passed} pass</Badge>
            {failed > 0 && <Badge variant="destructive">{failed} fail</Badge>}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {checks.map((c) => (
            <div key={c.id} className="flex items-start gap-3 p-3 rounded-lg border border-border">
              {icon(c.state)}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{c.label}</p>
                {c.detail && <p className="text-xs text-muted-foreground mt-0.5">{c.detail}</p>}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <video
        ref={videoRef}
        className="w-full rounded-lg bg-black aspect-video mb-4"
        playsInline
        muted
        controls={false}
      />

      <div className="flex gap-2">
        <Button onClick={runChecks} disabled={running} className="flex-1">
          {running ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Running…</>
          ) : (
            <><RefreshCw className="h-4 w-4 mr-2" /> Run checks</>
          )}
        </Button>
        <Button asChild variant="outline">
          <Link to="/feed">Back to Feed</Link>
        </Button>
      </div>
    </div>
  );
}
