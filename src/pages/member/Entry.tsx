import { useState } from "react";
import { Link } from "react-router-dom";
import { MemberLayout } from "@/components/member/MemberLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Maximize2, Camera, Sun, AlertCircle } from "lucide-react";
import { EntryQRCode } from "@/components/member/EntryQRCode";
import { useEntryToken } from "@/hooks/useEntryToken";

export default function MemberEntry() {
  const { token, member, isLoading, error, refresh } = useEntryToken();
  const [showFullScreen, setShowFullScreen] = useState(false);

  const initials = member
    ? `${member.first_name?.[0] || ""}${member.last_name?.[0] || ""}`.toUpperCase()
    : "";

  if (isLoading) {
    return (
      <MemberLayout title="Member Entry">
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
          <Skeleton className="h-80 w-80 rounded-xl" />
          <Skeleton className="h-6 w-48" />
        </div>
      </MemberLayout>
    );
  }

  if (error) {
    return (
      <MemberLayout title="Member Entry">
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
          <Alert variant="destructive" className="max-w-md">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button onClick={refresh}>Try Again</Button>
        </div>
      </MemberLayout>
    );
  }

  return (
    <MemberLayout title="Member Entry">
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-md border-accent/30 shadow-lg">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-2xl font-bold">Member Entry</CardTitle>
            <CardDescription>
              Show this code at the front desk
            </CardDescription>
          </CardHeader>
          
          <CardContent className="flex flex-col items-center gap-6 pb-8">
            {/* QR Code */}
            <div className="relative p-2 rounded-xl border-4 border-accent bg-accent/5">
              <EntryQRCode token={token} isLoading={false} size={240} />
            </div>

            {/* Member Info */}
            {member && (
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16 border-2 border-accent/30">
                  <AvatarImage 
                    src={member.photo_url || undefined} 
                    alt={`${member.first_name} ${member.last_name}`}
                    className="object-cover"
                  />
                  <AvatarFallback className="bg-muted text-lg">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold text-lg">
                    {member.first_name} {member.last_name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {member.member_id}
                  </p>
                  <Badge variant="outline" className="mt-1">
                    {member.membership_type}
                  </Badge>
                </div>
              </div>
            )}

            {/* Photo Upload Prompt */}
            {member && !member.photo_url && (
              <Alert className="bg-amber-50 dark:bg-amber-900/20 border-amber-300 max-w-sm">
                <Camera className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-700 dark:text-amber-300">
                  <span className="font-medium">Add a profile photo</span> for faster entry verification.{" "}
                  <Link to="/member/profile" className="underline font-medium">
                    Go to Profile
                  </Link>
                </AlertDescription>
              </Alert>
            )}

            {/* Full Screen Button */}
            <Button
              variant="outline"
              className="w-full max-w-xs gap-2"
              onClick={() => setShowFullScreen(true)}
            >
              <Maximize2 className="h-4 w-4" />
              Open Full Screen
            </Button>

            {/* Brightness Tip */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Sun className="h-4 w-4" />
              <span>For best results, increase screen brightness</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Full Screen Modal */}
      <Dialog open={showFullScreen} onOpenChange={setShowFullScreen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] w-auto h-auto p-8 sm:p-12 flex flex-col items-center justify-center bg-background">
          <DialogHeader className="text-center mb-6">
            <DialogTitle className="text-2xl">Member Entry</DialogTitle>
          </DialogHeader>
          
          <div className="flex flex-col items-center gap-8">
            {/* Large QR Code */}
            <div className="p-4 rounded-xl border-4 border-accent bg-accent/5">
              <EntryQRCode token={token} isLoading={false} size={320} />
            </div>

            {/* Member Info */}
            {member && (
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20 border-2 border-accent/30">
                  <AvatarImage 
                    src={member.photo_url || undefined} 
                    alt={`${member.first_name} ${member.last_name}`}
                    className="object-cover"
                  />
                  <AvatarFallback className="bg-muted text-xl">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="text-center">
                  <p className="font-semibold text-xl">
                    {member.first_name} {member.last_name}
                  </p>
                  <p className="text-muted-foreground">
                    {member.member_id}
                  </p>
                  <Badge variant="outline" className="mt-2 text-sm">
                    {member.membership_type}
                  </Badge>
                </div>
              </div>
            )}

            {/* Brightness Reminder */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Sun className="h-5 w-5" />
              <span>Increase brightness for easy scanning</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </MemberLayout>
  );
}
