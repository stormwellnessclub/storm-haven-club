import { useState } from "react";
import { format, subDays } from "date-fns";
import { Mail, User, Eye, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { usePaymentEmails, type PaymentEmail } from "@/hooks/usePaymentTracking";
import { DateRangePicker, type DateRange } from "@/components/admin/DateRangePicker";
import { useNavigate } from "react-router-dom";

export function PaymentEmailsTab() {
  const navigate = useNavigate();
  const [dateRange, setDateRange] = useState<DateRange>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [filters, setFilters] = useState<{
    emailType?: string;
    status?: string;
    search?: string;
  }>({});
  const [selectedEmail, setSelectedEmail] = useState<PaymentEmail | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const { data: emails, isLoading } = usePaymentEmails(dateRange, filters);

  const emailTypes = [
    { value: "payment_failed", label: "Payment Failed" },
    { value: "charge_confirmation", label: "Charge Confirmation" },
    { value: "admin_payment_failed_alert", label: "Admin Alert" },
    { value: "annual_fee_payment_request", label: "Annual Fee Request" },
    { value: "add_card_for_dues", label: "Add Card Request" },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "sent":
        return <Badge className="bg-green-500/20 text-green-700 dark:text-green-400">Sent</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      case "pending":
        return <Badge variant="secondary">Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getEmailTypeLabel = (type: string) => {
    const found = emailTypes.find(e => e.value === type);
    return found ? found.label : type.replace(/_/g, " ");
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <DateRangePicker
              value={dateRange}
              onChange={setDateRange}
              className="w-[280px]"
            />
            <Select
              value={filters.emailType || "all"}
              onValueChange={(value) =>
                setFilters((f) => ({ ...f, emailType: value === "all" ? undefined : value }))
              }
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Email Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {emailTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filters.status || "all"}
              onValueChange={(value) =>
                setFilters((f) => ({ ...f, status: value === "all" ? undefined : value }))
              }
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="Search recipient..."
              value={filters.search || ""}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              className="w-[200px]"
            />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Payment Emails
            {emails && (
              <Badge variant="secondary" className="ml-2">
                {emails.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !emails || emails.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No payment emails in this period
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sent At</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {emails.map((email) => (
                  <TableRow key={email.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{email.recipient_name || "—"}</p>
                        <p className="text-xs text-muted-foreground">{email.recipient_email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{getEmailTypeLabel(email.email_type)}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[300px] truncate">
                      {email.subject || "—"}
                    </TableCell>
                    <TableCell>{getStatusBadge(email.status)}</TableCell>
                    <TableCell>
                      {email.sent_at
                        ? format(new Date(email.sent_at), "MMM d, yyyy h:mm a")
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSelectedEmail(email);
                            setPreviewOpen(true);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {email.member_id && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate(`/admin/members/${email.member_id}`)}
                          >
                            <User className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Email Details</DialogTitle>
          </DialogHeader>
          {selectedEmail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">To</p>
                  <p className="font-medium">{selectedEmail.recipient_email}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Type</p>
                  <Badge variant="outline">{getEmailTypeLabel(selectedEmail.email_type)}</Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Subject</p>
                  <p className="font-medium">{selectedEmail.subject || "—"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  {getStatusBadge(selectedEmail.status)}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Created</p>
                  <p>{format(new Date(selectedEmail.created_at), "MMM d, yyyy h:mm a")}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Sent</p>
                  <p>
                    {selectedEmail.sent_at
                      ? format(new Date(selectedEmail.sent_at), "MMM d, yyyy h:mm a")
                      : "Not sent"}
                  </p>
                </div>
              </div>

              {selectedEmail.template_data && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Template Data</p>
                  <ScrollArea className="h-[200px] border rounded-lg p-3">
                    <pre className="text-xs">
                      {JSON.stringify(selectedEmail.template_data, null, 2)}
                    </pre>
                  </ScrollArea>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
