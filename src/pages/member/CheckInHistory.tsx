import { useState } from "react";
import { MemberLayout } from "@/components/member/MemberLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useCheckInHistory } from "@/hooks/useCheckInHistory";
import { useAmenityUsage, AMENITY_TYPES, AmenityUsageLog } from "@/hooks/useAmenityUsage";
import { LogAmenityDialog } from "@/components/member/LogAmenityDialog";
import { format } from "date-fns";
import { Clock, Plus, Flame, Trash2, Sparkles } from "lucide-react";
import { useDeleteAmenityUsage } from "@/hooks/useAmenityUsage";
import { GenerateWorkoutModal } from "@/components/member/GenerateWorkoutModal";
import { useGenerateAIWorkout, WorkoutPreferences } from "@/hooks/useAIWorkouts";
import { clearPersisted } from "@/hooks/usePersistedState";

export default function CheckInHistory() {
  const [showAmenityDialog, setShowAmenityDialog] = useState(false);
  const [showWorkoutModal, setShowWorkoutModal] = useState(false);
  const [selectedCheckInId, setSelectedCheckInId] = useState<string | undefined>();
  const { data: checkIns, isLoading: checkInsLoading } = useCheckInHistory();
  const { data: amenityLogs, isLoading: amenityLoading } = useAmenityUsage();
  const deleteAmenity = useDeleteAmenityUsage();
  const generateAIWorkout = useGenerateAIWorkout();

  const handleGenerateAIWorkout = async (preferences: WorkoutPreferences) => {
    try {
      await generateAIWorkout.mutateAsync(preferences);
      clearPersisted("workouts.generate.step.v1");
      clearPersisted("workouts.generate.prefs.v1");
      setShowWorkoutModal(false);
    } catch {
      // handled by hook
    }
  };

  const isLoading = checkInsLoading || amenityLoading;

  // Group amenity logs by check_in_id and by date for unlinked ones
  const amenitiesByCheckIn = (amenityLogs || []).reduce((acc, log) => {
    const key = log.check_in_id || "unlinked";
    if (!acc[key]) acc[key] = [];
    acc[key].push(log);
    return acc;
  }, {} as Record<string, AmenityUsageLog[]>);

  // Group amenities by date for the summary
  const amenitiesByType = (amenityLogs || []).reduce((acc, log) => {
    acc[log.amenity_type] = (acc[log.amenity_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const getAmenityLabel = (type: string) => {
    return AMENITY_TYPES.find((a) => a.value === type)?.label || type;
  };

  const getAmenityIcon = (type: string) => {
    return AMENITY_TYPES.find((a) => a.value === type)?.icon || "🏢";
  };

  const handleLogForCheckIn = (checkInId: string) => {
    setSelectedCheckInId(checkInId);
    setShowAmenityDialog(true);
  };

  const handleLogGeneral = () => {
    setSelectedCheckInId(undefined);
    setShowAmenityDialog(true);
  };

  return (
    <MemberLayout title="Visit History">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h2 className="heading-section">Visit History</h2>
            <p className="text-muted-foreground mt-1">
              Your check-ins and amenity usage
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={() => setShowWorkoutModal(true)}>
              <Sparkles className="h-4 w-4 mr-2" />
              Generate Workout
            </Button>
            <Button variant="outline" onClick={handleLogGeneral}>
              <Plus className="h-4 w-4 mr-2" />
              Log Amenity
            </Button>
          </div>
        </div>

        {/* Amenity Usage Summary */}
        {Object.keys(amenitiesByType).length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Flame className="h-4 w-4 text-primary" />
                Recovery Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {Object.entries(amenitiesByType).map(([type, count]) => (
                  <Badge key={type} variant="secondary" className="text-sm py-1 px-3">
                    {getAmenityIcon(type)} {getAmenityLabel(type)}: {count}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Total Visits</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{checkIns?.length || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Amenity Sessions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{amenityLogs?.length || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Unique Amenities</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Object.keys(amenitiesByType).length}</div>
              <p className="text-xs text-muted-foreground">of 6 available</p>
            </CardContent>
          </Card>
        </div>

        {/* Check-in Timeline */}
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : !checkIns?.length && !amenityLogs?.length ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Clock className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
              <p className="text-lg font-medium mb-2">No visits yet</p>
              <p className="text-muted-foreground">
                Your check-in history will appear here after your first visit
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {(checkIns || []).map((checkIn) => {
              const linkedAmenities = amenitiesByCheckIn[checkIn.id] || [];
              return (
                <Card key={checkIn.id}>
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">
                            {format(new Date(checkIn.checked_in_at), "EEEE, MMMM d, yyyy")}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground ml-6">
                          Checked in at {format(new Date(checkIn.checked_in_at), "h:mm a")}
                          {checkIn.checked_out_at && (
                            <> · Out at {format(new Date(checkIn.checked_out_at), "h:mm a")}</>
                          )}
                        </p>
                        {checkIn.notes && (
                          <p className="text-sm text-muted-foreground ml-6 italic">{checkIn.notes}</p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleLogForCheckIn(checkIn.id)}
                        className="text-xs"
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Log Amenity
                      </Button>
                    </div>

                    {/* Linked amenities */}
                    {linkedAmenities.length > 0 && (
                      <div className="mt-3 ml-6 space-y-1.5">
                        {linkedAmenities.map((log) => (
                          <div
                            key={log.id}
                            className="flex items-center justify-between p-2 rounded bg-muted/50 text-sm"
                          >
                            <div className="flex items-center gap-2">
                              <span>{getAmenityIcon(log.amenity_type)}</span>
                              <span>{getAmenityLabel(log.amenity_type)}</span>
                              {log.duration_minutes && (
                                <Badge variant="outline" className="text-xs">
                                  {log.duration_minutes} min
                                </Badge>
                              )}
                              {log.notes && (
                                <span className="text-muted-foreground text-xs">— {log.notes}</span>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteAmenity.mutate(log.id)}
                              className="h-6 w-6 p-0"
                            >
                              <Trash2 className="h-3 w-3 text-muted-foreground" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}

            {/* Unlinked amenity logs */}
            {amenitiesByCheckIn["unlinked"]?.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Other Amenity Sessions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1.5">
                  {amenitiesByCheckIn["unlinked"].map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between p-2 rounded bg-muted/50 text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <span>{getAmenityIcon(log.amenity_type)}</span>
                        <span>{getAmenityLabel(log.amenity_type)}</span>
                        <span className="text-muted-foreground text-xs">
                          {format(new Date(log.used_at), "MMM d, h:mm a")}
                        </span>
                        {log.duration_minutes && (
                          <Badge variant="outline" className="text-xs">
                            {log.duration_minutes} min
                          </Badge>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteAmenity.mutate(log.id)}
                        className="h-6 w-6 p-0"
                      >
                        <Trash2 className="h-3 w-3 text-muted-foreground" />
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>

      <LogAmenityDialog
        open={showAmenityDialog}
        onOpenChange={setShowAmenityDialog}
        checkInId={selectedCheckInId}
      />

      <GenerateWorkoutModal
        open={showWorkoutModal}
        onOpenChange={setShowWorkoutModal}
        onGenerate={handleGenerateAIWorkout}
        isGenerating={generateAIWorkout.isPending}
      />
    </MemberLayout>
  );
}
