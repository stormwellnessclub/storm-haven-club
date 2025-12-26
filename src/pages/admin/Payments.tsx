import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  MoreHorizontal,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  CreditCard,
  RefreshCcw,
} from "lucide-react";

const mockPayments = [
  {
    id: "1",
    member: "Sarah Johnson",
    type: "Monthly Subscription",
    amount: 199,
    status: "paid",
    date: "Dec 25, 2024",
    method: "Visa •••• 4242",
  },
  {
    id: "2",
    member: "Michael Chen",
    type: "Monthly Subscription",
    amount: 199,
    status: "paid",
    date: "Dec 24, 2024",
    method: "Mastercard •••• 5555",
  },
  {
    id: "3",
    member: "Emily Davis",
    type: "Class Package",
    amount: 150,
    status: "paid",
    date: "Dec 23, 2024",
    method: "Visa •••• 1234",
  },
  {
    id: "4",
    member: "James Wilson",
    type: "Monthly Subscription",
    amount: 199,
    status: "failed",
    date: "Dec 22, 2024",
    method: "Visa •••• 9876",
  },
  {
    id: "5",
    member: "Amanda Roberts",
    type: "Monthly Subscription",
    amount: 299,
    status: "paid",
    date: "Dec 22, 2024",
    method: "Amex •••• 0005",
  },
  {
    id: "6",
    member: "David Brown",
    type: "Spa Treatment",
    amount: 120,
    status: "refunded",
    date: "Dec 20, 2024",
    method: "Visa •••• 3456",
  },
];

const getStatusBadge = (status: string) => {
  switch (status) {
    case "paid":
      return <Badge className="bg-green-100 text-green-800">Paid</Badge>;
    case "failed":
      return <Badge className="bg-red-100 text-red-800">Failed</Badge>;
    case "refunded":
      return <Badge className="bg-amber-100 text-amber-800">Refunded</Badge>;
    case "pending":
      return <Badge className="bg-blue-100 text-blue-800">Pending</Badge>;
    default:
      return null;
  }
};

export default function Payments() {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredPayments = mockPayments.filter(
    (payment) =>
      payment.member.toLowerCase().includes(searchQuery.toLowerCase()) ||
      payment.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalRevenue = mockPayments
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + p.amount, 0);

  const failedCount = mockPayments.filter((p) => p.status === "failed").length;

  return (
    <AdminLayout title="Payments">
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Revenue Today</p>
                  <p className="text-2xl font-bold">${totalRevenue.toLocaleString()}</p>
                </div>
                <DollarSign className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Monthly Revenue</p>
                  <p className="text-2xl font-bold">$48,250</p>
                </div>
                <TrendingUp className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Subscriptions</p>
                  <p className="text-2xl font-bold">1,284</p>
                </div>
                <CreditCard className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Failed Payments</p>
                  <p className="text-2xl font-bold">{failedCount}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="flex gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search payments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Payments Table */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Payment Method</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="font-medium">{payment.member}</TableCell>
                    <TableCell>{payment.type}</TableCell>
                    <TableCell className="font-medium">
                      ${payment.amount.toLocaleString()}
                    </TableCell>
                    <TableCell>{getStatusBadge(payment.status)}</TableCell>
                    <TableCell>{payment.date}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {payment.method}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>View Details</DropdownMenuItem>
                          <DropdownMenuItem>Send Receipt</DropdownMenuItem>
                          {payment.status === "failed" && (
                            <DropdownMenuItem>
                              <RefreshCcw className="h-4 w-4 mr-2" />
                              Retry Payment
                            </DropdownMenuItem>
                          )}
                          {payment.status === "paid" && (
                            <DropdownMenuItem className="text-destructive">
                              Issue Refund
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
