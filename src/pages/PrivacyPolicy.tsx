import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

const PrivacyPolicy = () => {
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
          <h1 className="text-lg font-semibold">Privacy Policy</h1>
        </div>
      </div>

      <ScrollArea className="h-[calc(100vh-65px)]">
        <div className="p-4 pb-8 max-w-2xl mx-auto">
          <div className="space-y-6 text-sm text-muted-foreground">
            <p className="text-xs text-muted-foreground/70">
              Effective Date: January 2026
            </p>

            {/* Quick Summary for Parents */}
            <div className="bg-primary/10 border border-primary/20 rounded-xl p-4">
              <h3 className="font-bold text-foreground mb-2">📋 Quick Summary for Parents</h3>
              <ul className="text-xs space-y-1">
                <li>✅ We collect minimal data needed to run the app</li>
                <li>✅ We do NOT sell your child's data</li>
                <li>✅ We do NOT show behavioral ads to children</li>
                <li>✅ We do NOT allow messaging between users</li>
                <li>✅ You can delete all data anytime in Settings</li>
              </ul>
            </div>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground">1. Introduction</h2>
              <p>
                ToonlyReels ("App", "we", "us", or "our") is operated by SEMO Group. This Privacy 
                Policy explains how we collect, use, disclose, and safeguard information when 
                you use our mobile application.
              </p>
              <p className="font-semibold text-foreground">
                ToonlyReels is designed for children ages 4-15 and participates in the Google Play 
                "Designed for Families" program. We are fully COPPA compliant.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground">2. Information We Collect</h2>
              
              <div className="space-y-2">
                <h3 className="font-medium text-foreground">2.1 Account Information</h3>
                <ul className="list-disc list-inside space-y-1 pl-2">
                  <li>Username (no real names required)</li>
                  <li>Email address (for account verification and recovery)</li>
                  <li>Age range selection (not birthdate)</li>
                  <li>Profile avatar selection (preset options only)</li>
                  <li>Account type (viewer or creator)</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h3 className="font-medium text-foreground">2.2 Usage Data</h3>
                <ul className="list-disc list-inside space-y-1 pl-2">
                  <li>Videos watched and watch duration</li>
                  <li>Likes and saved videos</li>
                  <li>Comments posted (moderated for safety)</li>
                  <li>Device type for optimization</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h3 className="font-medium text-foreground">2.3 Content (Creators Only)</h3>
                <ul className="list-disc list-inside space-y-1 pl-2">
                  <li>Uploaded video content</li>
                  <li>Video titles, descriptions, and thumbnails</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h3 className="font-medium text-foreground">2.4 Information We Do NOT Collect</h3>
                <ul className="list-disc list-inside space-y-1 pl-2">
                  <li>❌ Real names of children</li>
                  <li>❌ Precise location data</li>
                  <li>❌ Phone numbers</li>
                  <li>❌ Photos of users</li>
                  <li>❌ Contact lists</li>
                  <li>❌ Birthdates</li>
                </ul>
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground">3. How We Use Information</h2>
              <ul className="list-disc list-inside space-y-1 pl-2">
                <li>To provide and maintain the App</li>
                <li>To personalize content recommendations</li>
                <li>To enable social features (likes, comments, follows)</li>
                <li>To enforce safety and moderation policies</li>
                <li>To communicate important updates</li>
                <li>To improve our service and user experience</li>
                <li>To comply with legal obligations</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground">4. Children's Privacy (COPPA Compliance)</h2>
              <p>
                We are committed to protecting children's privacy. In compliance with COPPA:
              </p>
              <ul className="list-disc list-inside space-y-1 pl-2">
                <li>We require parental consent before children under 13 can use the App</li>
                <li>We collect only the minimum information necessary</li>
                <li>We do NOT require real names or personal identifiers</li>
                <li>We do NOT serve behavioral or targeted advertising to children</li>
                <li>We do NOT allow children to publicly share personal information</li>
                <li>We do NOT allow direct messaging between users</li>
                <li>Parents can review, modify, or delete their child's data at any time</li>
                <li>Parents can refuse further collection of their child's data</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground">5. Parental Rights & Controls</h2>
              <p>
                Parents and guardians have the following rights:
              </p>
              <ul className="list-disc list-inside space-y-1 pl-2">
                <li><strong>Access:</strong> Review all data collected about your child</li>
                <li><strong>Delete:</strong> Delete your child's account and all data via Settings</li>
                <li><strong>Consent:</strong> Withdraw consent for data collection</li>
                <li><strong>Control:</strong> Use parental controls to manage app usage</li>
              </ul>
              <p className="mt-2">
                <strong>Parental Controls available in Settings:</strong>
              </p>
              <ul className="list-disc list-inside space-y-1 pl-2">
                <li>PIN-protected settings access</li>
                <li>Screen time limits (minutes per day)</li>
                <li>School hours lock (restrict usage during school)</li>
                <li>Bedtime lock (restrict usage at night)</li>
                <li>Content category filtering</li>
                <li>Comment visibility controls</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground">6. Data Sharing & Disclosure</h2>
              <p>
                <strong>We do NOT sell, rent, or trade personal information.</strong>
              </p>
              <p>We may share data only:</p>
              <ul className="list-disc list-inside space-y-1 pl-2">
                <li>With service providers who help operate the App (under strict agreements)</li>
                <li>To comply with legal obligations or law enforcement requests</li>
                <li>To protect the safety of children and users</li>
                <li>With your explicit consent</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground">7. Advertising Policy</h2>
              <div className="bg-fun-green/10 border border-fun-green/30 rounded-lg p-3">
                <p className="font-semibold text-foreground">
                  🚫 No Behavioral Advertising
                </p>
                <p className="text-xs mt-1">
                  ToonlyReels does NOT serve behavioral or targeted advertisements to children. 
                  Any advertisements shown are contextual and age-appropriate, and do not track 
                  children across apps or websites.
                </p>
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground">8. Data Security</h2>
              <p>
                We implement industry-standard security measures:
              </p>
              <ul className="list-disc list-inside space-y-1 pl-2">
                <li>Encrypted data transmission (HTTPS/TLS)</li>
                <li>Secure cloud storage with access controls</li>
                <li>Regular security audits and updates</li>
                <li>Server-side PIN hashing for parental controls</li>
                <li>Row-level security for database access</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground">9. Data Retention & Deletion</h2>
              <p>
                We retain data only as long as necessary to provide our services.
              </p>
              <ul className="list-disc list-inside space-y-1 pl-2">
                <li>You can delete your account anytime via Settings → Delete Account</li>
                <li>Upon deletion, ALL personal data is permanently removed within 30 days</li>
                <li>This includes: profile, videos, comments, likes, follows, and analytics</li>
                <li>Some data may be retained if required by law</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground">10. Cookies & Local Storage</h2>
              <p>ToonlyReels uses local storage only for:</p>
              <ul className="list-disc list-inside space-y-1 pl-2">
                <li>Remembering your login session</li>
                <li>Storing app preferences and settings</li>
                <li>Tracking milestone achievements locally</li>
                <li>Age verification status</li>
              </ul>
              <p className="mt-2 font-semibold">
                We do NOT use third-party tracking cookies.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground">11. Third-Party Services</h2>
              <p>
                ToonlyReels may use the following third-party services:
              </p>
              <ul className="list-disc list-inside space-y-1 pl-2">
                <li>Cloud hosting for secure data storage</li>
                <li>Content delivery networks for video streaming</li>
                <li>Analytics for app improvement (aggregated, non-personal data only)</li>
              </ul>
              <p className="mt-2">
                All third-party providers are contractually bound to protect user data and 
                comply with COPPA requirements.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground">12. Your Rights</h2>
              <p>You have the right to:</p>
              <ul className="list-disc list-inside space-y-1 pl-2">
                <li>Access your personal data</li>
                <li>Correct inaccurate information</li>
                <li>Delete your account and data</li>
                <li>Opt-out of non-essential communications</li>
                <li>Request a copy of your data</li>
                <li>Withdraw consent at any time</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground">13. Changes to This Policy</h2>
              <p>
                We may update this Privacy Policy from time to time. We will notify you of 
                material changes through the App or via email. The "Effective Date" at the 
                top indicates when this policy was last revised.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-foreground">14. Contact Us</h2>
              <p>
                If you have questions about this Privacy Policy, data practices, or wish to 
                exercise your parental rights, please contact us:
              </p>
              <div className="bg-muted/50 rounded-lg p-4 space-y-1">
                <p className="font-medium text-foreground">ToonlyReels by SEMO Group</p>
                <p>Email: info@semogroup.com</p>
              </div>
            </section>

            <div className="pt-4 border-t border-border">
              <p className="text-xs text-center text-muted-foreground/70">
                © 2026 ToonlyReels by SEMO Group. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};

export default PrivacyPolicy;
