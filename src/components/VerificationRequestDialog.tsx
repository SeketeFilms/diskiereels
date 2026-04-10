import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { BadgeCheck, Upload, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { z } from 'zod';

interface VerificationRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const verificationSchema = z.object({
  fullName: z.string().trim().min(2, "Full name is required").max(100),
  companyName: z.string().trim().max(100).optional(),
  businessEmail: z.string().trim().email("Valid email required").max(255),
});

const VerificationRequestDialog = ({ open, onOpenChange, onSuccess }: VerificationRequestDialogProps) => {
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [businessEmail, setBusinessEmail] = useState('');
  const [idDocument, setIdDocument] = useState<File | null>(null);
  const [businessDocument, setBusinessDocument] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    const validation = verificationSchema.safeParse({ fullName, companyName, businessEmail });
    if (!validation.success) {
      toast.error(validation.error.issues[0].message);
      return;
    }

    if (!idDocument) {
      toast.error('Please upload an ID document');
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      let idDocumentUrl = null;
      let businessDocumentUrl = null;

      // Upload ID document
      const idFileName = `${user.id}/id-document-${Date.now()}.${idDocument.name.split('.').pop()}`;
      const { error: idUploadError } = await supabase.storage
        .from('avatars')
        .upload(idFileName, idDocument, { upsert: true });

      if (idUploadError) throw idUploadError;

      const { data: idUrlData } = supabase.storage.from('avatars').getPublicUrl(idFileName);
      idDocumentUrl = idUrlData.publicUrl;

      // Upload business document if provided
      if (businessDocument) {
        const bizFileName = `${user.id}/business-document-${Date.now()}.${businessDocument.name.split('.').pop()}`;
        const { error: bizUploadError } = await supabase.storage
          .from('avatars')
          .upload(bizFileName, businessDocument, { upsert: true });

        if (!bizUploadError) {
          const { data: bizUrlData } = supabase.storage.from('avatars').getPublicUrl(bizFileName);
          businessDocumentUrl = bizUrlData.publicUrl;
        }
      }

      // Submit verification request
      const { data: verificationData, error } = await supabase.from('creator_verifications').insert({
        user_id: user.id,
        full_name: fullName.trim(),
        company_name: companyName.trim() || null,
        business_email: businessEmail.trim(),
        id_document_url: idDocumentUrl,
        business_document_url: businessDocumentUrl,
      }).select('id').single();

      if (error) {
        if (error.code === '23505') {
          toast.error('You have already submitted a verification request');
        } else {
          throw error;
        }
        return;
      }

      // Get user profile for username
      const { data: profile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .single();

      // Notify admins via edge function (fire and forget)
      fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notify-verification`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: JSON.stringify({
            verification_id: verificationData?.id,
            user_id: user.id,
            full_name: fullName.trim(),
            business_email: businessEmail.trim(),
            username: profile?.username,
          }),
        }
      ).catch(err => console.error('Failed to notify admins:', err));

      toast.success('Verification request submitted! We will review it shortly.');
      onSuccess();
      onOpenChange(false);
      
      // Reset form
      setFullName('');
      setCompanyName('');
      setBusinessEmail('');
      setIdDocument(null);
      setBusinessDocument(null);
    } catch (error) {
      console.error('Verification submission error:', error);
      toast.error('Failed to submit verification request');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BadgeCheck className="w-5 h-5 text-blue-500" />
            Get Verified
          </DialogTitle>
          <DialogDescription>
            Submit your identity and business information for verification. 
            Verified creators are trusted to upload safe content for kids.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Legal Name *</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Enter your full legal name"
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="companyName">Company/Studio Name (Optional)</Label>
            <Input
              id="companyName"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Enter company or studio name"
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="businessEmail">Business Email *</Label>
            <Input
              id="businessEmail"
              type="email"
              value={businessEmail}
              onChange={(e) => setBusinessEmail(e.target.value)}
              placeholder="your@business-email.com"
              maxLength={255}
            />
          </div>

          <div className="space-y-2">
            <Label>ID Document (Passport/License) *</Label>
            <div className="border-2 border-dashed border-border rounded-lg p-4">
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => setIdDocument(e.target.files?.[0] || null)}
                className="hidden"
                id="id-document"
              />
              <label htmlFor="id-document" className="flex flex-col items-center cursor-pointer">
                <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                <span className="text-sm text-muted-foreground">
                  {idDocument ? idDocument.name : 'Click to upload ID document'}
                </span>
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Business Document (Optional)</Label>
            <div className="border-2 border-dashed border-border rounded-lg p-4">
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => setBusinessDocument(e.target.files?.[0] || null)}
                className="hidden"
                id="business-document"
              />
              <label htmlFor="business-document" className="flex flex-col items-center cursor-pointer">
                <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                <span className="text-sm text-muted-foreground">
                  {businessDocument ? businessDocument.name : 'Business registration (optional)'}
                </span>
              </label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              'Submit for Verification'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default VerificationRequestDialog;
