import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Shield, Users, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import toonreelsLogo from "@/assets/toonreels-logo.png";

interface AgeGateProps {
  onVerified: () => void;
}

const AgeGate = ({ onVerified }: AgeGateProps) => {
  const [isParent, setIsParent] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);

  const canProceed = isParent && acceptTerms && acceptPrivacy;

  const handleVerify = () => {
    if (canProceed) {
      localStorage.setItem("toonlyreels_age_verified", "true");
      localStorage.setItem("toonlyreels_verification_date", new Date().toISOString());
      onVerified();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-elevated border-2 border-primary/20">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4">
            <img src={toonreelsLogo} alt="ToonlyReels" className="w-20 h-20 mx-auto" />
          </div>
          <CardTitle className="text-2xl font-black flex items-center justify-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            Parental Verification
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-2">
            ToonlyReels is designed for children ages 4-15
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* COPPA Notice */}
          <div className="bg-fun-yellow/10 border border-fun-yellow/30 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-fun-yellow shrink-0 mt-0.5" />
              <div className="text-xs text-foreground/80">
                <p className="font-semibold mb-1">COPPA Compliance Notice</p>
                <p>
                  In accordance with the Children's Online Privacy Protection Act (COPPA), 
                  we require parental consent before children under 13 can use ToonlyReels.
                </p>
              </div>
            </div>
          </div>

          {/* Designed for Families Badge */}
          <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Users className="h-5 w-5 text-primary" />
              <span className="font-bold text-sm">Designed for Families</span>
            </div>
            <p className="text-xs text-muted-foreground">
              This app is part of the Google Play "Designed for Families" program 
              and meets all requirements for child safety.
            </p>
          </div>

          {/* Verification Checkboxes */}
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 bg-card rounded-lg border border-border">
              <Checkbox
                id="parent"
                checked={isParent}
                onCheckedChange={(checked) => setIsParent(checked as boolean)}
                className="mt-0.5"
              />
              <Label htmlFor="parent" className="text-sm cursor-pointer leading-relaxed">
                I am a <span className="font-semibold">parent or legal guardian</span> and I consent to my child using ToonlyReels
              </Label>
            </div>

            <div className="flex items-start gap-3 p-3 bg-card rounded-lg border border-border">
              <Checkbox
                id="terms"
                checked={acceptTerms}
                onCheckedChange={(checked) => setAcceptTerms(checked as boolean)}
                className="mt-0.5"
              />
              <Label htmlFor="terms" className="text-sm cursor-pointer leading-relaxed">
                I have read and accept the{" "}
                <Link to="/terms-of-service" className="text-primary underline font-semibold">
                  Terms of Service
                </Link>
              </Label>
            </div>

            <div className="flex items-start gap-3 p-3 bg-card rounded-lg border border-border">
              <Checkbox
                id="privacy"
                checked={acceptPrivacy}
                onCheckedChange={(checked) => setAcceptPrivacy(checked as boolean)}
                className="mt-0.5"
              />
              <Label htmlFor="privacy" className="text-sm cursor-pointer leading-relaxed">
                I have read and accept the{" "}
                <Link to="/privacy-policy" className="text-primary underline font-semibold">
                  Privacy Policy
                </Link>
              </Label>
            </div>
          </div>

          {/* Verify Button */}
          <Button
            onClick={handleVerify}
            disabled={!canProceed}
            className="w-full h-12 text-base font-bold"
          >
            <Shield className="h-5 w-5 mr-2" />
            Verify & Continue
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            By verifying, you confirm you are 18+ years old and authorize your child to use this app.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AgeGate;
