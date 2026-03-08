import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { DateRangePicker, type DateRange } from "@/components/admin/DateRangePicker";
import { useAutopaySchedule } from "@/hooks/useAutopaySchedule";
import { format } from "date-fns";
import { Calendar, DollarSign, CheckCircle, XCircle, Clock, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function AutopayScheduleTab() {
  const navigate = useNavigate();
  const [dateRange, setDateRange] = useState<DateRange>({ from: undefined, to: undefined });
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [search, setSearch] = useState("");

  const { data, isLoading } = useAutopaySchedule(dateRange, {
    status: statusFilter,
    paymentType: typeFilter,
    search,
  });

  const summary = data?.summary;
  const entries = data?.entries || [];

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Upcoming
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-20" /> : (
              <>
                <div className="text-2xl font-bold">{summary?.totalUpcoming || 0}</div>
                <p className="text-xs text-muted-foreground">
                  ${(summary?.totalUpcomingAmount || 0).toLocaleString()} expected
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-green-600" />
              Collected
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-20" /> : (
              <div className="text-2xl font-bold text-green-600">
                ${(summary?.totalCollected || 0).toLocaleString()}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <XCircle className="h-4 w-4 text-destructive" />
              Failed
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-20" /> : (
              <div className="text-2xl font-bold text-destructive">
                {summary?.totalFailed || 0}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              Success Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-20" /> : (
              <div className="text-2xl font-bold">{summary?.successRate || 0}%</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <DateRangePicker value={dateRange} onChange={setDateRange} className="w-full sm:w-auto" />
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="upcoming">Upcoming</SelectItem>
            <SelectItem value="success">Success</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Payment Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="Monthly Dues">Monthly Dues</SelectItem>
            <SelectItem value="Annual Initiation Fee">Annual Initiation Fee</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : entries.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Calendar className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>No autopay entries found for the selected filters.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Payment Type</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Card</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {entry.date ? format(new Date(entry.date), "MMM d, yyyy") : "—"}
                    </TableCell>
                    <TableCell>
                      <button
                        className="text-left hover:underline text-primary font-medium"
                        onClick={() => entry.member_id && navigate(`/admin/members/${entry.member_id}`)}
                      >
                        {entry.member_name}
                      </button>
                      <div className="text-xs text-muted-foreground">{entry.member_email}</div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          entry.payment_type === "Monthly Dues"
                            ? "border-primary/30 text-primary"
                            : "border-amber-500/30 text-amber-700"
                        }
                      >
                        {entry.payment_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="capitalize">{entry.tier}</TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {entry.card_info || "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ${entry.amount.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {entry.status === "success" && (
                        <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                          <CheckCircle className="h-3 w-3 mr-1" /> Success
                        </Badge>
                      )}
                      {entry.status === "failed" && (
                        <div>
                          <Badge variant="destructive">
                            <XCircle className="h-3 w-3 mr-1" /> Failed
                          </Badge>
                          {entry.decline_reason && (
                            <p className="text-xs text-destructive mt-1 max-w-[150px] truncate" title={entry.decline_reason}>
                              {entry.decline_reason}
                            </p>
                          )}
                        </div>
                      )}
                      {entry.status === "upcoming" && (
                        <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
                          <Clock className="h-3 w-3 mr-1" /> Upcoming
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
