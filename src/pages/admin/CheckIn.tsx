import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  QrCode, 
  Search, 
  UserCheck, 
  Clock, 
  CheckCircle2,
  AlertTriangle,
  XCircle,
  User,
  CreditCard,
  Calendar
} from "lucide-react";

const recentCheckIns = [
  { name: "Sarah Johnson", time: "8:45 AM", membership: "Premium", status: "success", photo: null },
  { name: "Michael Chen", time: "8:30 AM", membership: "Executive", status: "success", photo: null },
  { name: "Emily Davis", time: "8:15 AM", membership: "Standard", status: "success", photo: null },
  { name: "James Wilson", time: "8:00 AM", membership: "Premium", status: "warning", photo: null },
  { name: "Amanda Roberts", time: "7:45 AM", membership: "Executive", status: "success", photo: null },
  { name: "David Brown", time: "7:30 AM", membership: "Premium", status: "success", photo: null },
];

type MemberStatus = "active" | "past_due" | "frozen" | "expired";

interface ScannedMember {
  name: string;
  membership: string;
  status: MemberStatus;
  memberId: string;
  expiresAt: string;
  checkInCount: number;
}

export default function CheckIn() {
  const [manualSearch, setManualSearch] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [lastScanned, setLastScanned] = useState<ScannedMember | null>(null);

  const handleStartScanning = () => {
    setIsScanning(true);
    setTimeout(() => {
      setLastScanned({
        name: "Sarah Johnson",
        membership: "Premium",
        status: "active",
        memberId: "STM-001284",
        expiresAt: "Dec 31, 2025",
        checkInCount: 47,
      });
      setIsScanning(false);
    }, 2000);
  };

  const getStatusConfig = (status: MemberStatus) => {
    switch (status) {
      case "active":
        return {
          icon: CheckCircle2,
          label: "Check-In Approved",
          badge: <Badge className="bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300">Active</Badge>,
          bgClass: "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800",
          iconClass: "text-green-600",
        };
      case "past_due":
        return {
          icon: AlertTriangle,
          label: "Payment Past Due",
          badge: <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">Past Due</Badge>,
          bgClass: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800",
          iconClass: "text-amber-600",
        };
      case "frozen":
        return {
          icon: AlertTriangle,
          label: "Membership Frozen",
          badge: <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300">Frozen</Badge>,
          bgClass: "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800",
          iconClass: "text-blue-600",
        };
      case "expired":
        return {
          icon: XCircle,
          label: "Membership Expired",
          badge: <Badge className="bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300">Expired</Badge>,
          bgClass: "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800",
          iconClass: "text-red-600",
        };
    }
  };

  return (
    <AdminLayout title="Member Check-In">
      <div className="space-y-6">
        {/* Main Check-In Area */}
        <div className="grid gap-6 lg:grid-cols-5">
          {/* QR Scanner - Primary Focus */}
          <Card className="lg:col-span-3">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <QrCode className="h-5 w-5" />
                    QR Code Scanner
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Point the scanner at a member's QR code
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-xs">
                  Camera: Ready
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Scanner Preview */}
              <div className="aspect-[4/3] max-h-[400px] mx-auto bg-secondary/30 rounded-lg flex items-center justify-center border-2 border-dashed border-border relative overflow-hidden">
                {isScanning ? (
                  <div className="text-center space-y-4">
                    <div className="relative">
                      <div className="absolute inset-0 animate-ping">
                        <QrCode className="h-20 w-20 mx-auto text-accent/50" />
                      </div>
                      <QrCode className="h-20 w-20 mx-auto text-accent" />
                    </div>
                    <p className="text-muted-foreground font-medium">Scanning...</p>
                  </div>
                ) : (
                  <div className="text-center space-y-4 p-8">
                    <div className="mx-auto w-32 h-32 rounded-lg border-4 border-dashed border-muted-foreground/30 flex items-center justify-center">
                      <QrCode className="h-16 w-16 text-muted-foreground/40" />
                    </div>
                    <div className="space-y-2">
                      <p className="text-muted-foreground">Camera preview area</p>
                      <Button size="lg" onClick={handleStartScanning} className="mt-2">
                        <QrCode className="h-4 w-4 mr-2" />
                        Start Scanning
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Manual Search */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Manual Lookup</p>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name, member ID, or phone..."
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

          {/* Member Result Panel */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Scan Result</CardTitle>
            </CardHeader>
            <CardContent>
              {lastScanned ? (
                <div className="space-y-4">
                  {/* Status Banner */}
                  <div className={`p-4 rounded-lg border ${getStatusConfig(lastScanned.status).bgClass}`}>
                    <div className="flex items-center gap-3">
                      {(() => {
                        const StatusIcon = getStatusConfig(lastScanned.status).icon;
                        return <StatusIcon className={`h-8 w-8 ${getStatusConfig(lastScanned.status).iconClass}`} />;
                      })()}
                      <div>
                        <p className="font-semibold">{getStatusConfig(lastScanned.status).label}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Member Info */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="h-16 w-16 rounded-full bg-secondary flex items-center justify-center">
                        <User className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold">{lastScanned.name}</h3>
                        <p className="text-sm text-muted-foreground">{lastScanned.memberId}</p>
                      </div>
                    </div>

                    <div className="grid gap-3">
                      <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg">
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1">
                          <p className="text-xs text-muted-foreground">Membership</p>
                          <p className="font-medium">{lastScanned.membership}</p>
                        </div>
                        {getStatusConfig(lastScanned.status).badge}
                      </div>
                      
                      <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1">
                          <p className="text-xs text-muted-foreground">Expires</p>
                          <p className="font-medium">{lastScanned.expiresAt}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg">
                        <UserCheck className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1">
                          <p className="text-xs text-muted-foreground">Check-ins This Month</p>
                          <p className="font-medium">{lastScanned.checkInCount}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <Button className="w-full" variant="outline">
                    View Full Profile
                  </Button>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <User className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p className="font-medium">No Member Scanned</p>
                  <p className="text-sm mt-1">Scan a QR code to see member details</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Stats and Recent Activity */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Today's Stats */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <UserCheck className="h-4 w-4" />
                Today's Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-green-50 dark:bg-green-950/30 rounded-lg">
                  <p className="text-3xl font-bold text-green-700 dark:text-green-400">89</p>
                  <p className="text-xs text-green-600 dark:text-green-500">Total Check-Ins</p>
                </div>
                <div className="text-center p-4 bg-secondary/50 rounded-lg">
                  <p className="text-3xl font-bold">147</p>
                  <p className="text-xs text-muted-foreground">Currently In</p>
                </div>
                <div className="text-center p-4 bg-secondary/50 rounded-lg">
                  <p className="text-3xl font-bold">11am</p>
                  <p className="text-xs text-muted-foreground">Peak Hour</p>
                </div>
                <div className="text-center p-4 bg-amber-50 dark:bg-amber-950/30 rounded-lg">
                  <p className="text-3xl font-bold text-amber-700 dark:text-amber-400">3</p>
                  <p className="text-xs text-amber-600 dark:text-amber-500">Issues</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Check-Ins */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Recent Check-Ins
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-2">
                {recentCheckIns.map((checkIn, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-3 bg-secondary/30 rounded-lg"
                  >
                    {checkIn.status === "success" ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{checkIn.name}</p>
                      <p className="text-xs text-muted-foreground">{checkIn.membership}</p>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">{checkIn.time}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
