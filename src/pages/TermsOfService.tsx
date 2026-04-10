import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

const TermsOfService = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center gap-3 p-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">Terms of Service</h1>
        </div>
      </div>

      <ScrollArea className="h-[calc(100vh-65px)]">
        <div className="p-4 pb-8 max-w-2xl mx-auto">
          <div className="space-y-6 text-sm text-muted-foreground">
            <p className="text-xs text-muted-foreground/70">
              Effective Date: January 2026
            </p>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground">1. Acceptance of Terms</h2>
              <p>
                Welcome to ToonlyReels ("App", "Service", "we", "us", or "our"). By downloading, 
                installing, accessing, or using ToonlyReels, you agree to be bound by these 
                Terms of Service ("Terms"). If you do not agree to these Terms, do not use 
                the App.
              </p>
              <p>
                ToonlyReels is designed for children ages 4-15 ("Children") under parental supervision. 
                Parents or legal guardians ("Parents") must review and accept these Terms on behalf 
                of their Children before allowing use of the App.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground">2. Designed for Families</h2>
              <p>
                ToonlyReels participates in the Google Play "Designed for Families" program and 
                complies with all applicable requirements, including:
              </p>
              <ul className="list-disc list-inside space-y-1 pl-2">
                <li>Content appropriate for children</li>
                <li>No behavioral advertising targeting children</li>
                <li>COPPA (Children's Online Privacy Protection Act) compliance</li>
                <li>Age-appropriate interactions and safety features</li>
                <li>Parental controls and content filtering</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground">3. Account Registration</h2>
              <p>
                To use certain features of ToonlyReels, you must create an account. By creating 
                an account:
              </p>
              <ul className="list-disc list-inside space-y-1 pl-2">
                <li>Parents must provide consent for Children under 13</li>
                <li>You agree to provide accurate information</li>
                <li>You are responsible for maintaining account security</li>
                <li>You must not share your account with others</li>
                <li>You must notify us of any unauthorized use</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground">4. User Content</h2>
              <p>
                ToonlyReels allows verified creators to upload animated content. By uploading content:
              </p>
              <ul className="list-disc list-inside space-y-1 pl-2">
                <li>You confirm you own or have rights to the content</li>
                <li>Content must be appropriate for children ages 4-15</li>
                <li>No violence, adult themes, or inappropriate material</li>
                <li>You grant ToonlyReels a license to display and distribute your content</li>
                <li>Content may be reviewed and removed at our discretion</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground">5. Prohibited Conduct</h2>
              <p>You agree NOT to:</p>
              <ul className="list-disc list-inside space-y-1 pl-2">
                <li>Upload content containing violence, nudity, or adult themes</li>
                <li>Harass, bully, or harm other users</li>
                <li>Share personal information of minors</li>
                <li>Use the App for any unlawful purpose</li>
                <li>Attempt to circumvent safety features or parental controls</li>
                <li>Collect data about other users without consent</li>
                <li>Post spam, advertisements, or promotional content</li>
                <li>Impersonate others or create fake accounts</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground">6. Safety Features</h2>
              <p>
                ToonlyReels includes safety features for child protection:
              </p>
              <ul className="list-disc list-inside space-y-1 pl-2">
                <li>Content moderation and filtering</li>
                <li>Comment filtering with AI safety moderation</li>
                <li>No direct messaging between users</li>
                <li>Parental controls with PIN protection</li>
                <li>Screen time limits</li>
                <li>Content category restrictions</li>
                <li>Report and block functionality</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground">7. Parental Controls</h2>
              <p>
                Parents can access parental controls in Settings to:
              </p>
              <ul className="list-disc list-inside space-y-1 pl-2">
                <li>Set a parental PIN for protected access</li>
                <li>Configure screen time limits</li>
                <li>Enable school hours and bedtime locks</li>
                <li>Control content categories</li>
                <li>Manage comment visibility</li>
                <li>Review and delete account data</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground">8. Intellectual Property</h2>
              <p>
                ToonlyReels and its original content, features, and functionality are owned by 
                SEMO Group and are protected by international copyright, trademark, and other 
                intellectual property laws.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground">9. Termination</h2>
              <p>
                We may terminate or suspend your account immediately, without prior notice, for:
              </p>
              <ul className="list-disc list-inside space-y-1 pl-2">
                <li>Violation of these Terms</li>
                <li>Uploading inappropriate content</li>
                <li>Harmful behavior toward other users</li>
                <li>Any other reason we deem necessary for user safety</li>
              </ul>
              <p>
                You may delete your account at any time through Settings. Upon deletion, 
                all your data will be permanently removed within 30 days.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground">10. Disclaimers</h2>
              <p>
                ToonlyReels is provided "AS IS" without warranties of any kind. We do not guarantee:
              </p>
              <ul className="list-disc list-inside space-y-1 pl-2">
                <li>Uninterrupted or error-free service</li>
                <li>That all content will be appropriate (despite moderation efforts)</li>
                <li>Accuracy of user-generated content</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground">11. Limitation of Liability</h2>
              <p>
                To the maximum extent permitted by law, ToonlyReels and SEMO Group shall not be 
                liable for any indirect, incidental, special, consequential, or punitive damages 
                arising from your use of the App.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground">12. Changes to Terms</h2>
              <p>
                We reserve the right to modify these Terms at any time. We will notify users 
                of material changes through the App or via email. Continued use after changes 
                constitutes acceptance of the new Terms.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground">13. Governing Law</h2>
              <p>
                These Terms shall be governed by and construed in accordance with applicable laws, 
                without regard to conflict of law principles.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground">14. Contact Us</h2>
              <p>
                If you have any questions about these Terms, please contact us:
              </p>
              <div className="bg-muted/50 rounded-lg p-4 space-y-1">
                <p className="font-medium text-foreground">ToonlyReels by SEMO Group</p>
                <p>Email: info@semogroup.com</p>
              </div>
            </section>

            <div className="pt-4 border-t border-border space-y-1">
              <p className="text-xs text-center text-muted-foreground/70">
                © 2026 ToonlyReels by SEMO Group. All rights reserved.
              </p>
              <p className="text-xs text-center text-muted-foreground/70">
                App by: Sekete Films Production
              </p>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};

export default TermsOfService;
