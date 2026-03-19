import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Mail, Clock, MessageSquarePlus } from "lucide-react";
import { useAdminHourRequests, useUpdateHourRequestStatus } from "@/hooks/useKidsCareHourRequests";
import { formatTime12h } from "@/lib/timeFormat";
import { format, parseISO } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function KidsCareHourRequests() {
  const { data: requests, isLoading } = useAdminHourRequests();
  const updateStatus = useUpdateHourRequestStatus();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!requests || requests.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <MessageSquarePlus className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p>No hour requests yet</p>
        <p className="text-sm mt-1">Parents can submit schedule requests from the Kids Care page</p>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Parent Hour Requests</CardTitle>
        <CardDescription>
          Hours parents have requested — use this to guide schedule expansion
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Parent</TableHead>
              <TableHead>Preferred Days</TableHead>
              <TableHead>Times</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.map((req) => (
              <TableRow key={req.id}>
                <TableCell>
                  <div className="space-y-1">
                    <p className="font-medium text-sm">
                      {req.profiles
                        ? `${req.profiles.first_name || ''} ${req.profiles.last_name || ''}`.trim() || '—'
                        : '—'}
                    </p>
                    {req.profiles?.email && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Mail className="h-3 w-3" />
                        {req.profiles.email}
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {req.preferred_days.map((d) => (
                      <Badge key={d} variant="secondary" className="text-xs">{d}</Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {formatTime12h(req.preferred_start_time)} – {formatTime12h(req.preferred_end_time)}
                  </div>
                </TableCell>
                <TableCell className="max-w-[200px]">
                  {req.notes ? (
                    <span className="text-sm text-muted-foreground truncate block">{req.notes}</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {format(parseISO(req.created_at), "MMM d, yyyy")}
                </TableCell>
                <TableCell>
                  <Select
                    value={req.status}
                    onValueChange={(value) => updateStatus.mutate({ id: req.id, status: value })}
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="reviewed">Reviewed</SelectItem>
                      <SelectItem value="accommodated">Accommodated</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
