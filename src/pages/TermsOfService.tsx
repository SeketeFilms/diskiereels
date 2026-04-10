import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

const TermsOfService = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center gap-3 p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">Terms of Service</h1>
        </div>
      </div>

      <ScrollArea className="h-[calc(100vh-65px)]">
        <div className="p-4 pb-8 max-w-2xl mx-auto">
          <div className="space-y-6 text-sm text-muted-foreground">
            <p className="text-xs text-muted-foreground/70">Effective Date: April 2026</p>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground">1. Acceptance of Terms</h2>
              <p>Welcome to DiskieReels ("App", "Service"). By using DiskieReels, you agree to be bound by these Terms of Service. DiskieReels is a social platform for sharing and discovering soccer reels and short-form football content.</p>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground">2. Account Registration</h2>
              <ul className="list-disc list-inside space-y-1 pl-2">
                <li>You must provide accurate information</li>
                <li>You are responsible for maintaining account security</li>
                <li>You must not share your account with others</li>
                <li>You must be at least 13 years old to use the platform</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground">3. User Content</h2>
              <p>All users can upload soccer reels. By uploading content:</p>
              <ul className="list-disc list-inside space-y-1 pl-2">
                <li>You confirm you own or have rights to the content</li>
                <li>Content must be related to soccer/football</li>
                <li>No violence, hate speech, or inappropriate material</li>
                <li>You grant DiskieReels a license to display and distribute your content</li>
                <li>Content may be reviewed and removed at our discretion</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground">4. Social Features</h2>
              <p>DiskieReels provides social features including:</p>
              <ul className="list-disc list-inside space-y-1 pl-2">
                <li>Direct messaging between users</li>
                <li>Following and followers</li>
                <li>Likes, comments, and sharing</li>
                <li>Report and block functionality</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground">5. Prohibited Conduct</h2>
              <ul className="list-disc list-inside space-y-1 pl-2">
                <li>Uploading non-soccer or inappropriate content</li>
                <li>Harassing, bullying, or threatening other users</li>
                <li>Spamming or sending unsolicited messages</li>
                <li>Impersonating others or creating fake accounts</li>
                <li>Attempting to circumvent safety features</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground">6. Intellectual Property</h2>
              <p>DiskieReels and its original content, features, and functionality are owned by SEMO Group and are protected by international copyright, trademark, and other intellectual property laws.</p>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground">7. Termination</h2>
              <p>We may terminate or suspend your account for violation of these Terms. You may delete your account at any time through Settings.</p>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground">8. Contact Us</h2>
              <div className="bg-muted/50 rounded-lg p-4 space-y-1">
                <p className="font-medium text-foreground">DiskieReels by SEMO Group</p>
                <p>Email: info@semogroup.com</p>
              </div>
            </section>

            <div className="pt-4 border-t border-border space-y-1">
              <p className="text-xs text-center text-muted-foreground/70">© 2026 DiskieReels by SEMO Group. All rights reserved.</p>
              <p className="text-xs text-center text-muted-foreground/70">App by: Sekete Films Production</p>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};

export default TermsOfService;
