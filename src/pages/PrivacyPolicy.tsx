import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

const PrivacyPolicy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center gap-3 p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">Privacy Policy</h1>
        </div>
      </div>

      <ScrollArea className="h-[calc(100vh-65px)]">
        <div className="p-4 pb-8 max-w-2xl mx-auto">
          <div className="space-y-6 text-sm text-muted-foreground">
            <p className="text-xs text-muted-foreground/70">Effective Date: April 2026</p>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground">1. Introduction</h2>
              <p>DiskieReels ("App", "we", "us", or "our") is operated by SEMO Group. This Privacy Policy explains how we collect, use, disclose, and safeguard information when you use our soccer reels platform.</p>
              <p className="font-semibold text-foreground">DiskieReels is a social soccer reels platform where users can share, discover, and engage with soccer content.</p>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground">2. Information We Collect</h2>
              <div className="space-y-2">
                <h3 className="font-medium text-foreground">2.1 Account Information</h3>
                <ul className="list-disc list-inside space-y-1 pl-2">
                  <li>Username</li>
                  <li>Email address (for account verification and recovery)</li>
                  <li>Profile avatar and cover photo</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h3 className="font-medium text-foreground">2.2 Usage Data</h3>
                <ul className="list-disc list-inside space-y-1 pl-2">
                  <li>Videos watched and watch duration</li>
                  <li>Likes, saves, and follows</li>
                  <li>Comments and messages</li>
                  <li>Device type for optimization</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h3 className="font-medium text-foreground">2.3 Content</h3>
                <ul className="list-disc list-inside space-y-1 pl-2">
                  <li>Uploaded video content</li>
                  <li>Video titles, descriptions, and thumbnails</li>
                  <li>Direct messages between users</li>
                </ul>
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground">3. How We Use Information</h2>
              <ul className="list-disc list-inside space-y-1 pl-2">
                <li>To provide and maintain the App</li>
                <li>To personalize content recommendations</li>
                <li>To enable social features (likes, comments, follows, messaging)</li>
                <li>To enforce safety and moderation policies</li>
                <li>To improve our service and user experience</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground">4. Data Sharing & Disclosure</h2>
              <p><strong>We do NOT sell, rent, or trade personal information.</strong></p>
              <p>We may share data only:</p>
              <ul className="list-disc list-inside space-y-1 pl-2">
                <li>With service providers who help operate the App</li>
                <li>To comply with legal obligations</li>
                <li>To protect the safety of users</li>
                <li>With your explicit consent</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground">5. Data Security</h2>
              <ul className="list-disc list-inside space-y-1 pl-2">
                <li>Encrypted data transmission (HTTPS/TLS)</li>
                <li>Secure cloud storage with access controls</li>
                <li>Regular security audits and updates</li>
                <li>Row-level security for database access</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground">6. Your Rights</h2>
              <ul className="list-disc list-inside space-y-1 pl-2">
                <li>Access your personal data</li>
                <li>Correct inaccurate information</li>
                <li>Delete your account and data via Settings</li>
                <li>Opt-out of non-essential communications</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground">7. Contact Us</h2>
              <div className="bg-muted/50 rounded-lg p-4 space-y-1">
                <p className="font-medium text-foreground">DiskieReels by SEMO Group</p>
                <p>Email: info@semogroup.com</p>
              </div>
            </section>

            <div className="pt-4 border-t border-border">
              <p className="text-xs text-center text-muted-foreground/70">© 2026 DiskieReels by SEMO Group. All rights reserved.</p>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};

export default PrivacyPolicy;
