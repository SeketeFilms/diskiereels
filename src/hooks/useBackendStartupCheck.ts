import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Runs once per session for admin users. Verifies:
 *  1) the frontend and backend are on the same Supabase project
 *  2) RLS + expected policies are in place for critical tables
 *
 * Non-admins pay zero cost (early exit before any RPC call).
 */
export const useBackendStartupCheck = () => {
  useEffect(() => {
    const STORAGE_KEY = 'diskie:backend-check:v1';
    if (sessionStorage.getItem(STORAGE_KEY) === 'ok') return;

    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      const { data: role } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();
      if (!role || cancelled) return;

      const { data, error } = await supabase.rpc('get_backend_status');
      if (error || cancelled) return;

      const status = data as any;
      const envUrl = import.meta.env.VITE_SUPABASE_URL || '';
      const envRef = envUrl.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1] || '';
      const dbRef = status?.project_ref || '';
      const mismatch = envRef && dbRef && !dbRef.includes(envRef);
      const failingTables = (status?.tables || []).filter(
        (t: any) => !t.rls_enabled || t.policy_count < 1
      );

      if (mismatch) {
        toast.error('Backend mismatch: frontend and database point at different Supabase projects.', {
          action: { label: 'View', onClick: () => (window.location.href = '/admin/backend-status') },
        });
      } else if (failingTables.length > 0) {
        toast.warning(`Backend check: ${failingTables.length} table(s) missing RLS/policies`, {
          action: { label: 'View', onClick: () => (window.location.href = '/admin/backend-status') },
        });
      } else {
        sessionStorage.setItem(STORAGE_KEY, 'ok');
      }
    })();

    return () => { cancelled = true; };
  }, []);
};
