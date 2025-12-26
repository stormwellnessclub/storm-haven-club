import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { QrCode, Search, UserCheck, Clock, AlertCircle, CheckCircle2 } from "lucide-react";

const recentCheckIns = [
  { name: "Sarah Johnson", time: "8:30 AM", membership: "Premium", status: "success" },
  { name: "Amanda Roberts", time: "7:15 AM", membership: "Executive", status: "success" },
  { name: "Michael Chen", time: "6:45 AM", membership: "Premium", status: "success" },
  { name: "Emily Davis", time: "6:30 AM", membership: "Standard", status: "success" },
  { name: "James Wilson", time: "6:00 AM", membership: "Premium", status: "warning" },
];

export default function CheckIn() {
  const [manualSearch, setManualSearch] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [lastScanned, setLastScanned] = useState<{
    name: string;
    membership: string;
    status: "active" | "past_due" | "frozen";
    photo?: string;
  } | null>(null);

  const handleStartScanning = () => {
    setIsScanning(true);
    // Simulate a successful scan after 2 seconds
    setTimeout(() => {
      setLastScanned({
        name: "Sarah Johnson",
        membership: "Premium",
        status: "active",
      });
      setIsScanning(false);
    }, 2000);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-100 text-green-800">Active</Badge>;
      case "past_due":
        return <Badge className="bg-red-100 text-red-800">Past Due</Badge>;
      case "frozen":
        return <Badge className="bg-blue-100 text-blue-800">Frozen</Badge>;
      default:
        return null;
    }
  };

  return (
    <AdminLayout title="Member Check-In">
      <div className="grid gap-6 lg:grid-cols-2">
        {/* QR Scanner Section */}
        <Card className="lg:row-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              QR Code Scanner
            </CardTitle>
            <CardDescription>
              Scan a member's QR code to check them in
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Scanner Area */}
            <div className="aspect-square max-w-md mx-auto bg-secondary/50 rounded-lg flex items-center justify-center border-2 border-dashed border-border">
              {isScanning ? (
                <div className="text-center space-y-4">
                  <div className="animate-pulse">
                    <QrCode className="h-24 w-24 mx-auto text-accent" />
                  </div>
                  <p className="text-muted-foreground">Scanning...</p>
                </div>
              ) : (
                <div className="text-center space-y-4 p-8">
                  <QrCode className="h-24 w-24 mx-auto text-muted-foreground/50" />
                  <p className="text-muted-foreground">
                    Camera preview will appear here
                  </p>
                  <Button onClick={handleStartScanning}>
                    Start Scanning
                  </Button>
                </div>
              )}
            </div>

            {/* Last Scanned Member */}
            {lastScanned && (
              <Card className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                      <CheckCircle2 className="h-8 w-8 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold">{lastScanned.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge>{lastScanned.membership}</Badge>
                        {getStatusBadge(lastScanned.status)}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Checked in at</p>
                      <p className="font-medium">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Manual Search */}
            <div className="space-y-3">
              <p className="text-sm font-medium">Or search manually:</p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, email, or phone..."
                    value={manualSearch}
                    onChange={(e) => setManualSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button variant="secondary">Search</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Today's Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5" />
              Today's Check-Ins
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-4 bg-secondary/50 rounded-lg">
                <p className="text-3xl font-bold">89</p>
                <p className="text-sm text-muted-foreground">Total</p>
              </div>
              <div className="p-4 bg-secondary/50 rounded-lg">
                <p className="text-3xl font-bold">32</p>
                <p className="text-sm text-muted-foreground">Morning</p>
              </div>
              <div className="p-4 bg-secondary/50 rounded-lg">
                <p className="text-3xl font-bold">57</p>
                <p className="text-sm text-muted-foreground">Afternoon</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Check-Ins */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Recent Check-Ins
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentCheckIns.map((checkIn, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between py-2 border-b border-border last:border-0"
                >
                  <div className="flex items-center gap-3">
                    {checkIn.status === "success" ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-amber-500" />
                    )}
                    <div>
                      <p className="font-medium text-sm">{checkIn.name}</p>
                      <p className="text-xs text-muted-foreground">{checkIn.membership}</p>
                    </div>
                  </div>
                  <span className="text-sm text-muted-foreground">{checkIn.time}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
