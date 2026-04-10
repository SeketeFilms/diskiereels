import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, Send, Loader2, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

interface MonthlyReportSettingsProps {
  userId: string;
}

const MonthlyReportSettings = ({ userId }: MonthlyReportSettingsProps) => {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const sendMonthlyReport = async () => {
    if (!email) {
      toast.error('Please enter an email address');
      return;
    }

    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Please sign in first');
        return;
      }

      const response = await supabase.functions.invoke('send-monthly-report', {
        body: { 
          recipientEmail: email,
          userId 
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      setSent(true);
      toast.success('Monthly report sent to your email!');
      setTimeout(() => setSent(false), 5000);
    } catch (error: any) {
      console.error('Error sending report:', error);
      toast.error('Failed to send report. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Mail className="h-4 w-4" />
          Monthly Screen Time Report
        </CardTitle>
        <CardDescription className="text-xs">
          Get a detailed usage report sent to your email
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label className="text-sm">Parent Email Address</Label>
          <Input
            type="email"
            placeholder="parent@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-9"
          />
        </div>
        
        <Button 
          onClick={sendMonthlyReport} 
          className="w-full"
          disabled={sending || !email}
        >
          {sending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Sending Report...
            </>
          ) : sent ? (
            <>
              <CheckCircle className="h-4 w-4 mr-2" />
              Report Sent!
            </>
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              Send Monthly Report
            </>
          )}
        </Button>

        <p className="text-xs text-muted-foreground text-center">
          Report includes: daily usage, total screen time, content categories, and activity trends
        </p>
      </CardContent>
    </Card>
  );
};

export default MonthlyReportSettings;
