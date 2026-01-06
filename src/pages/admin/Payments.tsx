import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  ShoppingBag,
  UserPlus,
} from "lucide-react";
import { SellMembershipPackage } from "@/components/admin/SellMembershipPackage";
import { SellClassPackage } from "@/components/admin/SellClassPackage";

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
      return <Badge className="bg-muted/20 text-muted-foreground">Paid</Badge>;
    case "failed":
      return <Badge className="bg-destructive/20 text-destructive-foreground">Failed</Badge>;
    case "refunded":
      return <Badge className="bg-accent/20 text-accent-foreground">Refunded</Badge>;
    case "pending":
      return <Badge className="bg-secondary/20 text-secondary-foreground">Pending</Badge>;
    default:
      return null;
  }
};

export default function Payments() {
  const [searchQuery, setSearchQuery] = useState("");
  const [showMembershipDialog, setShowMembershipDialog] = useState(false);
  const [showClassPackageDialog, setShowClassPackageDialog] = useState(false);

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
        {/* Action Buttons */}
        <div className="flex gap-4">
          <Button onClick={() => setShowMembershipDialog(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Sell Membership
          </Button>
          <Button variant="outline" onClick={() => setShowClassPackageDialog(true)}>
            <ShoppingBag className="h-4 w-4 mr-2" />
            Sell Class Package
          </Button>
        </div>

        <Tabs defaultValue="transactions" className="space-y-4">
          <TabsList>
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
            <TabsTrigger value="process">Process Payment</TabsTrigger>
          </TabsList>

          <TabsContent value="transactions" className="space-y-4">
        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Revenue Today</p>
                  <p className="text-2xl font-bold">${totalRevenue.toLocaleString()}</p>
                </div>
                <DollarSign className="h-8 w-8 text-muted-foreground" />
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
                <TrendingUp className="h-8 w-8 text-secondary-foreground" />
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
                <AlertTriangle className="h-8 w-8 text-destructive" />
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
          </TabsContent>

          <TabsContent value="process" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Process Payment</CardTitle>
                <CardDescription>
                  Choose to create a payment link or process payment directly.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Card className="p-4 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setShowMembershipDialog(true)}>
                    <div className="flex items-center gap-3">
                      <UserPlus className="h-8 w-8 text-primary" />
                      <div>
                        <h3 className="font-semibold">Membership Payment</h3>
                        <p className="text-sm text-muted-foreground">Process membership activation</p>
                      </div>
                    </div>
                  </Card>
                  <Card className="p-4 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setShowClassPackageDialog(true)}>
                    <div className="flex items-center gap-3">
                      <ShoppingBag className="h-8 w-8 text-primary" />
                      <div>
                        <h3 className="font-semibold">Class Package</h3>
                        <p className="text-sm text-muted-foreground">Sell class packages</p>
                      </div>
                    </div>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <SellMembershipPackage
        open={showMembershipDialog}
        onOpenChange={setShowMembershipDialog}
      />
      <SellClassPackage
        open={showClassPackageDialog}
        onOpenChange={setShowClassPackageDialog}
      />
    </AdminLayout>
  );
}
