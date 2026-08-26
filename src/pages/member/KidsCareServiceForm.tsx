import { useState, useEffect } from "react";
import { MemberLayout } from "@/components/member/MemberLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useKidsCareChildren, useAddChild, useUpdateChild, useDeleteChild, type AddChildData, type KidsCareChild } from "@/hooks/useKidsCareChildren";
import { useUserProfile } from "@/hooks/useUserProfile";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Trash2, Baby, Check } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const EMPTY_FORM: AddChildData = {
  full_name: "",
  date_of_birth: "",
  allergies: "",
  medical_conditions: "",
  medications: "",
  special_instructions: "",
  emergency_contact_name: "",
  emergency_contact_phone: "",
  relationship_to_child: "",
  authorized_pickup_persons: "",
  preferred_activities: "",
  photo_release: false,
};

export default function KidsCareServiceForm() {
  const { data: children, isLoading } = useKidsCareChildren();
  const { profile, completeKidsCareServiceForm } = useUserProfile();
  const addChild = useAddChild();
  const updateChild = useUpdateChild();
  const deleteChild = useDeleteChild();

  // Mark service form as completed when at least one child is registered
  const hasChildren = children && children.length > 0;
  useEffect(() => {
    if (hasChildren && profile && !profile.kids_care_service_form_completed) {
      completeKidsCareServiceForm();
    }
  }, [hasChildren, profile?.kids_care_service_form_completed]);

  const [showForm, setShowForm] = useState(false);
  const [editingChild, setEditingChild] = useState<KidsCareChild | null>(null);
  const [formData, setFormData] = useState<AddChildData>(EMPTY_FORM);

  const handleInputChange = (field: keyof AddChildData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setFormData(EMPTY_FORM);
    setEditingChild(null);
    setShowForm(false);
  };

  const handleEditChild = (child: KidsCareChild) => {
    setEditingChild(child);
    setFormData({
      full_name: child.full_name,
      date_of_birth: child.date_of_birth || "",
      allergies: child.allergies || "",
      medical_conditions: child.medical_conditions || "",
      medications: child.medications || "",
      special_instructions: child.special_instructions || "",
      emergency_contact_name: child.emergency_contact_name || "",
      emergency_contact_phone: child.emergency_contact_phone || "",
      relationship_to_child: child.relationship_to_child || "",
      authorized_pickup_persons: child.authorized_pickup_persons || "",
      preferred_activities: child.preferred_activities || "",
      photo_release: child.photo_release,
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.full_name) {
      toast.error("Please enter the child's full name");
      return;
    }

    try {
      if (editingChild) {
        await updateChild.mutateAsync({ id: editingChild.id, ...formData });
      } else {
        await addChild.mutateAsync(formData);
      }
      resetForm();
    } catch {
      // Error handled in hook
    }
  };

  if (isLoading) {
    return (
      <MemberLayout title="Kids Care - Child Profiles">
        <Card>
          <CardContent className="p-8">
            <Loader2 className="h-8 w-8 animate-spin mx-auto" />
          </CardContent>
        </Card>
      </MemberLayout>
    );
  }

  const childrenRegistered = children && children.length > 0;

  return (
    <MemberLayout title="Kids Care - Child Profiles">
      <div className="space-y-6 max-w-3xl">
        <div className="mb-6">
          <p className="text-muted-foreground">
            Register each child's profile with their medical and emergency contact information.
            This information helps our staff ensure the safety and well-being of your children.
          </p>
        </div>

        {/* Registered Children List */}
        {childrenRegistered && (
          <div className="space-y-4">
            <h3 className="font-serif text-lg font-semibold flex items-center gap-2">
              <Baby className="h-5 w-5 text-accent" />
              Registered Children
            </h3>
            {children.map((child) => (
              <Card key={child.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="font-medium text-foreground">{child.full_name}</p>
                      {child.date_of_birth && (
                        <p className="text-sm text-muted-foreground">
                          DOB: {new Date(child.date_of_birth).toLocaleDateString()}
                        </p>
                      )}
                      {child.emergency_contact_name && (
                        <p className="text-sm text-muted-foreground">
                          Emergency: {child.emergency_contact_name} — {child.emergency_contact_phone}
                        </p>
                      )}
                      {child.allergies && child.allergies !== "None" && (
                        <p className="text-sm text-destructive">Allergies: {child.allergies}</p>
                      )}
                      {child.medical_conditions && child.medical_conditions !== "None" && (
                        <p className="text-sm text-warning">Medical: {child.medical_conditions}</p>
                      )}
                      {child.preferred_activities && child.preferred_activities !== "None" && (
                        <p className="text-sm text-muted-foreground">Activities: {child.preferred_activities}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        aria-label={`Edit ${child.full_name}`}
                        onClick={() => handleEditChild(child)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm" aria-label={`Remove ${child.full_name}`}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove {child.full_name}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will remove the child's profile. You can add them back later.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteChild.mutate(child.id)}>
                              Remove
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Add Child Button */}
        {!showForm && (
          <Button
            onClick={() => {
              setEditingChild(null);
              setFormData(EMPTY_FORM);
              setShowForm(true);
            }}
            className="w-full"
            variant={childrenRegistered ? "outline" : "default"}
          >
            <Plus className="mr-2 h-4 w-4" />
            {childrenRegistered ? "Add Another Child" : "Add Your First Child"}
          </Button>
        )}

        {/* Add/Edit Form */}
        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle>{editingChild ? "Edit Child Profile" : "Add Child Profile"}</CardTitle>
              <CardDescription>
                Fields marked with * are required.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <Label htmlFor="fullName">
                      Child's Full Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="fullName"
                      value={formData.full_name}
                      onChange={(e) => handleInputChange("full_name", e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="dateOfBirth">Date of Birth</Label>
                    <Input
                      id="dateOfBirth"
                      type="date"
                      value={formData.date_of_birth || ""}
                      onChange={(e) => handleInputChange("date_of_birth", e.target.value)}
                    />
                  </div>

                  <div>
                    <Label htmlFor="emergencyContactName">Emergency Contact Name</Label>
                    <Input
                      id="emergencyContactName"
                      value={formData.emergency_contact_name || ""}
                      onChange={(e) => handleInputChange("emergency_contact_name", e.target.value)}
                    />
                  </div>

                  <div>
                    <Label htmlFor="emergencyContactPhone">Emergency Contact Phone</Label>
                    <Input
                      id="emergencyContactPhone"
                      type="tel"
                      value={formData.emergency_contact_phone || ""}
                      onChange={(e) => handleInputChange("emergency_contact_phone", e.target.value)}
                    />
                  </div>

                  <div>
                    <Label htmlFor="relationshipToChild">Relationship to Child</Label>
                    <Input
                      id="relationshipToChild"
                      value={formData.relationship_to_child || ""}
                      onChange={(e) => handleInputChange("relationship_to_child", e.target.value)}
                      placeholder="e.g., Parent, Guardian"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <Label htmlFor="allergies">Allergies</Label>
                    <Textarea
                      id="allergies"
                      value={formData.allergies || ""}
                      onChange={(e) => handleInputChange("allergies", e.target.value)}
                      placeholder="List any allergies"
                      rows={2}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <Label htmlFor="medicalConditions">Medical Conditions</Label>
                    <Textarea
                      id="medicalConditions"
                      value={formData.medical_conditions || ""}
                      onChange={(e) => handleInputChange("medical_conditions", e.target.value)}
                      placeholder="List any medical conditions"
                      rows={2}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <Label htmlFor="medications">Current Medications</Label>
                    <Textarea
                      id="medications"
                      value={formData.medications || ""}
                      onChange={(e) => handleInputChange("medications", e.target.value)}
                      placeholder="List any medications"
                      rows={2}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <Label htmlFor="specialInstructions">Special Instructions</Label>
                    <Textarea
                      id="specialInstructions"
                      value={formData.special_instructions || ""}
                      onChange={(e) => handleInputChange("special_instructions", e.target.value)}
                      placeholder="Any special instructions for staff"
                      rows={2}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <Label htmlFor="preferredActivities">Preferred Activities</Label>
                    <Textarea
                      id="preferredActivities"
                      value={formData.preferred_activities || ""}
                      onChange={(e) => handleInputChange("preferred_activities", e.target.value)}
                      placeholder="e.g., Coloring, building blocks, outdoor play, reading"
                      rows={2}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <Label htmlFor="authorizedPickupPersons">Authorized Pick-Up Persons</Label>
                    <Textarea
                      id="authorizedPickupPersons"
                      value={formData.authorized_pickup_persons || ""}
                      onChange={(e) => handleInputChange("authorized_pickup_persons", e.target.value)}
                      placeholder="Full names of persons authorized to pick up your child"
                      rows={2}
                    />
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="photoRelease"
                      checked={formData.photo_release || false}
                      onCheckedChange={(checked) => handleInputChange("photo_release", checked as boolean)}
                    />
                    <Label htmlFor="photoRelease" className="font-normal cursor-pointer">
                      I authorize Storm Wellness Club to photograph my child for promotional purposes (optional)
                    </Label>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button type="submit" disabled={addChild.isPending || updateChild.isPending}>
                    {(addChild.isPending || updateChild.isPending) ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : editingChild ? (
                      "Update Child Profile"
                    ) : (
                      "Save Child Profile"
                    )}
                  </Button>
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Completion Status */}
        {childrenRegistered && (
          <Card className="bg-accent/10 border-accent/30">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 text-accent">
                <Check className="h-6 w-6" />
                <div>
                  <p className="font-semibold">
                    {children.length} child{children.length !== 1 ? "ren" : ""} registered
                  </p>
                  <p className="text-sm text-muted-foreground">
                    You can now book Kids Care sessions for your registered children.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </MemberLayout>
  );
}
