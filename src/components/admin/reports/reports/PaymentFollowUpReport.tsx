import { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, CheckCircle2, Clock, XCircle, CreditCard } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface PaymentFollowUpReportProps {
  dateRange: { start: Date; end: Date };
  filters: Record<string, string | boolean>;
}

interface CardSetupAttempt {
  id: string;
  created_at: string;
  completed_at: string | null;
  source: string;
  status: string;
  decline_code: string | null;
  decline_message: string | null;
  card_brand: string | null;
  card_last4: string | null;
  stripe_customer_id: string;
  member_id: string | null;
  application_id: string | null;
  metadata: Record<string, unknown> | null;
  // Joined fields
  member_first_name?: string;
  member_last_name?: string;
  member_email?: string;
  application_first_name?: string;
  application_last_name?: string;
  application_email?: string;
}

export function PaymentFollowUpReport({ dateRange, filters }: PaymentFollowUpReportProps) {
  const [data, setData] = useState<CardSetupAttempt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Fetch card setup attempts with member/application info
        const { data: attempts, error: fetchError } = await supabase
          .from('card_setup_attempts')
          .select(`
            *,
            members!card_setup_attempts_member_id_fkey(first_name, last_name, email),
            membership_applications!card_setup_attempts_application_id_fkey(first_name, last_name, email)
          `)
          .gte('created_at', dateRange.start.toISOString())
          .lte('created_at', dateRange.end.toISOString())
          .order('created_at', { ascending: false });

        if (fetchError) throw fetchError;

        // Flatten the data
        const flattenedData = (attempts || []).map((a: any) => ({
          ...a,
          member_first_name: a.members?.first_name,
          member_last_name: a.members?.last_name,
          member_email: a.members?.email,
          application_first_name: a.membership_applications?.first_name,
          application_last_name: a.membership_applications?.last_name,
          application_email: a.membership_applications?.email,
        }));

        setData(flattenedData);
      } catch (err) {
        console.error("Error fetching payment follow-up data:", err);
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [dateRange]);

  // Filter based on selected status filter
  const filteredData = useMemo(() => {
    const statusFilter = filters.status as string;
    if (!statusFilter || statusFilter === 'all') return data;
    return data.filter(a => a.status === statusFilter);
  }, [data, filters.status]);

  // Summary stats
  const stats = useMemo(() => {
    const total = data.length;
    const succeeded = data.filter(a => a.status === 'succeeded').length;
    const failed = data.filter(a => a.status === 'failed').length;
    const initiated = data.filter(a => a.status === 'initiated').length;
    const abandoned = data.filter(a => a.status === 'abandoned').length;

    return { total, succeeded, failed, initiated, abandoned };
  }, [data]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'succeeded':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'initiated':
        return <Clock className="h-4 w-4 text-amber-500" />;
      case 'abandoned':
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "destructive" | "outline" | "secondary"> = {
      succeeded: "default",
      failed: "destructive",
      initiated: "secondary",
      abandoned: "outline",
    };
    return (
      <Badge variant={variants[status] || "outline"} className="flex items-center gap-1">
        {getStatusIcon(status)}
        {status}
      </Badge>
    );
  };

  const getSourceLabel = (source: string) => {
    const labels: Record<string, string> = {
      self_service: "Self-Service (Apply Page)",
      admin_portal: "Admin Portal",
      member_portal: "Member Portal",
      checkout_link: "Checkout Link",
    };
    return labels[source] || source;
  };

  const getName = (attempt: CardSetupAttempt) => {
    if (attempt.member_first_name) {
      return `${attempt.member_first_name} ${attempt.member_last_name || ''}`.trim();
    }
    if (attempt.application_first_name) {
      return `${attempt.application_first_name} ${attempt.application_last_name || ''}`.trim();
    }
    if (attempt.metadata && typeof attempt.metadata === 'object') {
      const meta = attempt.metadata as Record<string, unknown>;
      if (meta.applicant_name) return meta.applicant_name as string;
    }
    return '—';
  };

  const getEmail = (attempt: CardSetupAttempt) => {
    if (attempt.member_email) return attempt.member_email;
    if (attempt.application_email) return attempt.application_email;
    if (attempt.metadata && typeof attempt.metadata === 'object') {
      const meta = attempt.metadata as Record<string, unknown>;
      if (meta.applicant_email) return meta.applicant_email as string;
    }
    return '—';
  };

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center text-destructive">
        <AlertCircle className="h-8 w-8 mx-auto mb-2" />
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-sm text-muted-foreground">Total Attempts</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-green-600">{stats.succeeded}</div>
            <p className="text-sm text-muted-foreground">Succeeded</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
            <p className="text-sm text-muted-foreground">Failed/Declined</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-amber-600">{stats.initiated}</div>
            <p className="text-sm text-muted-foreground">In Progress</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-gray-600">{stats.abandoned}</div>
            <p className="text-sm text-muted-foreground">Abandoned</p>
          </CardContent>
        </Card>
      </div>

      {/* Data Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date/Time</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Card Info</TableHead>
              <TableHead>Decline Reason</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  No card setup attempts in this period
                </TableCell>
              </TableRow>
            ) : (
              filteredData.map((attempt) => (
                <TableRow key={attempt.id}>
                  <TableCell className="whitespace-nowrap">
                    {format(new Date(attempt.created_at), "MMM d, yyyy h:mm a")}
                  </TableCell>
                  <TableCell className="font-medium">{getName(attempt)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {getEmail(attempt)}
                  </TableCell>
                  <TableCell>
                    <span className="text-xs">{getSourceLabel(attempt.source)}</span>
                  </TableCell>
                  <TableCell>{getStatusBadge(attempt.status)}</TableCell>
                  <TableCell>
                    {attempt.card_brand && attempt.card_last4 ? (
                      <span className="text-sm">
                        {attempt.card_brand.toUpperCase()} •••• {attempt.card_last4}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {attempt.decline_code || attempt.decline_message ? (
                      <span className="text-sm text-red-600" title={attempt.decline_message || ''}>
                        {attempt.decline_code || attempt.decline_message}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Follow-up needed section */}
      {stats.initiated > 0 || stats.failed > 0 ? (
        <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <h4 className="font-semibold text-amber-800 dark:text-amber-200 mb-2">
            Follow-up Needed
          </h4>
          <p className="text-sm text-amber-700 dark:text-amber-300">
            {stats.initiated > 0 && (
              <span className="block">
                • <strong>{stats.initiated}</strong> attempt(s) were started but not completed (may need follow-up)
              </span>
            )}
            {stats.failed > 0 && (
              <span className="block">
                • <strong>{stats.failed}</strong> attempt(s) were declined - consider reaching out to help resolve
              </span>
            )}
          </p>
        </div>
      ) : null}
    </div>
  );
}
