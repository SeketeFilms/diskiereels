import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, ShieldCheck, ShieldAlert, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface TableStatus {
  table: string;
  rls_enabled: boolean;
  policy_count: number;
  policies: string[];
}

interface BackendStatus {
  project_ref: string;
  database: string;
  checked_at: string;
  tables: TableStatus[];
  rls_disabled_public_tables: string[];
  security_definer_executable_by_authenticated: { function: string; schema: string; args: string }[];
}

const REQUIRED_POLICIES: Record<string, number> = {
  users: 1,
  documents: 1,
  accessibility: 1,
  verification_logs: 1,
};

const AdminBackendStatus = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [status, setStatus] = useState<BackendStatus | null>(null);
  const [envUrl, setEnvUrl] = useState('');
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const load = async (isManual = false) => {
    if (isManual) setRefreshing(true); else setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate('/auth');
      return;
    }
    const { data: role } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();
    if (!role) {
      setAuthorized(false);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    setAuthorized(true);
    setEnvUrl(import.meta.env.VITE_SUPABASE_URL || '');
    const { data, error } = await supabase.rpc('get_backend_status');
    if (error) {
      toast.error(error.message);
    } else {
      setStatus(data as unknown as BackendStatus);
      setLastRefreshed(new Date());
      if (isManual) {
        const failingCount = ((data as any)?.tables || []).filter((t: any) => !t.rls_enabled || t.policy_count < 1).length;
        if (failingCount === 0) toast.success('All checks passing');
        else toast.error(`${failingCount} check${failingCount === 1 ? '' : 's'} failing`);
      }
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="p-6 max-w-md text-center">
          <ShieldAlert className="w-10 h-10 mx-auto text-destructive mb-3" />
          <h1 className="text-xl font-bold mb-1">Admin only</h1>
          <p className="text-muted-foreground text-sm">You need the admin role to view backend status.</p>
        </Card>
      </div>
    );
  }

  const envProjectRef = envUrl.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1] || '';
  const dbProjectRef = status?.project_ref || envProjectRef;
  const match = envProjectRef && dbProjectRef && (envProjectRef === dbProjectRef || dbProjectRef.includes(envProjectRef));

  const failing = (status?.tables || []).filter(t => !t.rls_enabled || t.policy_count < (REQUIRED_POLICIES[t.table] || 1));

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-primary" /> Backend Status
          </h1>
          {lastRefreshed && (
            <p className="text-xs text-muted-foreground mt-1">
              Last refreshed: {lastRefreshed.toLocaleString()}
            </p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={() => load(true)} disabled={refreshing}>
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Re-checking…' : 'Refresh & Re-check'}
        </Button>
      </div>

      <Card className="p-4 space-y-2">
        <h2 className="font-semibold">Connection</h2>
        <div className="text-sm space-y-1 font-mono">
          <div>Frontend URL: <span className="text-muted-foreground">{envUrl || '—'}</span></div>
          <div>Frontend project ref: <span className="text-muted-foreground">{envProjectRef || '—'}</span></div>
          <div className="flex items-center gap-2">
            Environment match:
            {match ? (
              <Badge className="bg-green-600">OK</Badge>
            ) : (
              <Badge variant="destructive">MISMATCH</Badge>
            )}
          </div>
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">RLS &amp; Policy Assertions</h2>
          {failing.length === 0 ? (
            <Badge className="bg-green-600">All Passing</Badge>
          ) : (
            <Badge variant="destructive">{failing.length} Failing</Badge>
          )}
        </div>
        <div className="space-y-2">
          {(status?.tables || []).map(t => {
            const ok = t.rls_enabled && t.policy_count >= (REQUIRED_POLICIES[t.table] || 1);
            return (
              <div key={t.table} className="flex items-start justify-between border border-border rounded p-3">
                <div>
                  <div className="font-medium">public.{t.table}</div>
                  <div className="text-xs text-muted-foreground">
                    {t.policy_count} polic{t.policy_count === 1 ? 'y' : 'ies'}
                    {t.policies?.length ? `: ${t.policies.join(', ')}` : ''}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge className={t.rls_enabled ? 'bg-green-600' : 'bg-destructive'}>
                    RLS {t.rls_enabled ? 'ON' : 'OFF'}
                  </Badge>
                  {!ok && <span className="text-xs text-destructive">FAIL</span>}
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground pt-2">
          Checked at {status?.checked_at ? new Date(status.checked_at).toLocaleString() : '—'}
        </p>
      </Card>

      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Scanner: RLS Disabled in Public</h2>
          {status?.rls_disabled_public_tables?.length ? (
            <Badge variant="destructive">{status.rls_disabled_public_tables.length} tables</Badge>
          ) : (
            <Badge className="bg-green-600">Clean</Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Public tables without RLS enabled (source of <code>SUPA_rls_disabled_in_public</code>).
        </p>
        {status?.rls_disabled_public_tables?.length ? (
          <div className="flex flex-wrap gap-2">
            {status.rls_disabled_public_tables.map(t => (
              <Badge key={t} variant="outline" className="font-mono text-xs">public.{t}</Badge>
            ))}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">No unprotected tables.</div>
        )}
      </Card>

      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Scanner: Security Definer Functions Executable by Authenticated</h2>
          {status?.security_definer_executable_by_authenticated?.length ? (
            <Badge variant="destructive">{status.security_definer_executable_by_authenticated.length} fns</Badge>
          ) : (
            <Badge className="bg-green-600">Clean</Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          SECURITY DEFINER functions callable by any signed-in user (source of <code>SUPA_authenticated_security_definer_function_executable</code>).
        </p>
        <div className="space-y-1 max-h-72 overflow-auto">
          {(status?.security_definer_executable_by_authenticated || []).map(f => (
            <div key={`${f.function}(${f.args})`} className="text-xs font-mono border border-border rounded p-2">
              {f.schema}.{f.function}({f.args})
            </div>
          ))}
          {!status?.security_definer_executable_by_authenticated?.length && (
            <div className="text-sm text-muted-foreground">No exposed security-definer functions.</div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default AdminBackendStatus;
