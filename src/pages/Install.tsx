import { useState, useEffect } from "react";
import { Download, Share, MoreVertical, Plus, ArrowRight, CheckCircle2, Smartphone, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const Install = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    setIsIOS(/iPad|iPhone|iPod/.test(ua));
    setIsAndroid(/Android/.test(ua));
    setIsStandalone(
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as any).standalone === true
    );

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setIsInstalled(true));

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setIsInstalled(true);
    setDeferredPrompt(null);
  };

  if (isStandalone || isInstalled) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-center">
        <CheckCircle2 className="mb-4 h-16 w-16 text-green-500" />
        <h1 className="mb-2 text-2xl font-bold text-foreground">Already Installed!</h1>
        <p className="mb-6 text-muted-foreground">ToonlyReels is installed on your device. Enjoy!</p>
        <Button onClick={() => window.location.href = "/feed"} className="gap-2">
          Open App <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-background px-6 py-12">
      {/* Header */}
      <div className="mb-8 flex flex-col items-center text-center">
        <img
          src="https://storage.googleapis.com/gpt-engineer-file-uploads/YhjAWGaWarSE2KQXMcw8kze1WNk2/uploads/1770415691079-ToonlyReels_Logo_copy.png"
          alt="ToonlyReels"
          className="mb-4 h-20 w-20 rounded-2xl shadow-lg"
        />
        <h1 className="text-3xl font-bold text-foreground">Get ToonlyReels</h1>
        <p className="mt-2 max-w-sm text-muted-foreground">
          Install ToonlyReels on your phone for the best experience — fast, fun, and works offline!
        </p>
      </div>

      {/* Install Button (Chrome/Edge/Samsung) */}
      {deferredPrompt && (
        <Button
          onClick={handleInstall}
          size="lg"
          className="mb-8 gap-3 rounded-full bg-[#FF6B6B] px-8 py-6 text-lg font-semibold text-white shadow-xl hover:bg-[#FF5252]"
        >
          <Download className="h-6 w-6" />
          Install App
        </Button>
      )}

      {/* iOS Instructions */}
      {isIOS && !deferredPrompt && (
        <div className="mb-8 w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-foreground flex items-center gap-2">
            <Smartphone className="h-5 w-5" /> Install on iPhone / iPad
          </h2>
          <ol className="space-y-4 text-sm text-muted-foreground">
            <li className="flex items-start gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">1</span>
              <span>Tap the <Share className="inline h-4 w-4 text-primary" /> <strong>Share</strong> button at the bottom of Safari</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">2</span>
              <span>Scroll down and tap <Plus className="inline h-4 w-4 text-primary" /> <strong>"Add to Home Screen"</strong></span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">3</span>
              <span>Tap <strong>"Add"</strong> in the top right — done!</span>
            </li>
          </ol>
        </div>
      )}

      {/* Android Instructions (fallback if no prompt) */}
      {isAndroid && !deferredPrompt && (
        <div className="mb-8 w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-foreground flex items-center gap-2">
            <Smartphone className="h-5 w-5" /> Install on Android
          </h2>
          <ol className="space-y-4 text-sm text-muted-foreground">
            <li className="flex items-start gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">1</span>
              <span>Tap the <MoreVertical className="inline h-4 w-4 text-primary" /> <strong>menu</strong> (3 dots) in Chrome</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">2</span>
              <span>Tap <strong>"Install app"</strong> or <strong>"Add to Home Screen"</strong></span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">3</span>
              <span>Tap <strong>"Install"</strong> — the app will appear on your home screen!</span>
            </li>
          </ol>
        </div>
      )}

      {/* Desktop fallback */}
      {!isIOS && !isAndroid && !deferredPrompt && (
        <div className="mb-8 w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-foreground flex items-center gap-2">
            <Monitor className="h-5 w-5" /> Install on Desktop
          </h2>
          <p className="text-sm text-muted-foreground">
            Look for the <Download className="inline h-4 w-4 text-primary" /> install icon in your browser's address bar, or open this page on your phone to install the mobile app.
          </p>
        </div>
      )}

      {/* Features */}
      <div className="w-full max-w-sm space-y-3">
        <h3 className="text-center text-sm font-medium text-muted-foreground uppercase tracking-wider">Why install?</h3>
        {[
          { icon: "⚡", text: "Loads instantly — no browser delays" },
          { icon: "📱", text: "Full-screen experience like a real app" },
          { icon: "🔔", text: "Get notified about new cartoons" },
          { icon: "📶", text: "Works even with a slow connection" },
        ].map((item, i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl bg-muted/50 px-4 py-3">
            <span className="text-xl">{item.icon}</span>
            <span className="text-sm text-foreground">{item.text}</span>
          </div>
        ))}
      </div>

      {/* Continue to app */}
      <Button
        variant="ghost"
        className="mt-8 text-muted-foreground"
        onClick={() => window.location.href = "/feed"}
      >
        Continue in browser <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
};

export default Install;
