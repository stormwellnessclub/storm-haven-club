import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Snowflake, Clock, CheckCircle, XCircle } from "lucide-react";

interface Props {
  dateRange: { start: Date; end: Date };
  filters: Record<string, string | boolean>;
}

export function FreezeHistoryReport({ dateRange, filters }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['report-freeze-history', dateRange, filters],
    queryFn: async () => {
      const { data: freezes, error } = await supabase
        .from('member_freezes')
        .select(`
          *,
          members (first_name, last_name, email, membership_type)
        `)
        .gte('created_at', dateRange.start.toISOString())
        .lte('created_at', dateRange.end.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      const statusCounts = (freezes || []).reduce((acc, freeze) => {
        const status = freeze.status || 'unknown';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return { freezes, statusCounts, total: (freezes || []).length };
    },
  });

  if (isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
      case 'active':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'rejected':
      case 'expired':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Snowflake className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Snowflake className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Requests</p>
                <p className="text-2xl font-bold">{data?.total || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Approved</p>
                <p className="text-2xl font-bold">{data?.statusCounts?.['approved'] || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-yellow-500" />
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold">{data?.statusCounts?.['pending'] || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Snowflake className="h-8 w-8 text-blue-400" />
              <div>
                <p className="text-sm text-muted-foreground">Active Freezes</p>
                <p className="text-2xl font-bold">{data?.statusCounts?.['active'] || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Member</TableHead>
            <TableHead>Tier</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Start Date</TableHead>
            <TableHead>End Date</TableHead>
            <TableHead>Reason</TableHead>
            <TableHead>Requested</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data?.freezes?.map((freeze) => (
            <TableRow key={freeze.id}>
              <TableCell className="font-medium">
                {freeze.members?.first_name} {freeze.members?.last_name}
              </TableCell>
              <TableCell className="capitalize">
                {freeze.members?.membership_type?.split('_')[0]}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="flex items-center gap-1 w-fit">
                  {getStatusIcon(freeze.status)}
                  {freeze.status}
                </Badge>
              </TableCell>
              <TableCell>
                {freeze.requested_start_date ? format(parseISO(freeze.requested_start_date), 'MMM d, yyyy') : '-'}
              </TableCell>
              <TableCell>
                {freeze.requested_end_date ? format(parseISO(freeze.requested_end_date), 'MMM d, yyyy') : '-'}
              </TableCell>
              <TableCell className="max-w-[200px] truncate">
                {freeze.reason || '-'}
              </TableCell>
              <TableCell>{format(parseISO(freeze.created_at), 'MMM d, yyyy')}</TableCell>
            </TableRow>
          ))}
          {(!data?.freezes || data.freezes.length === 0) && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                No freeze requests in this period
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
