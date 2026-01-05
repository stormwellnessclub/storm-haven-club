import { useState } from "react";
import { MemberLayout } from "@/components/member/MemberLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useForms } from "@/hooks/useAgreements";
import { AgreementPDFViewer } from "@/components/AgreementPDFViewer";
import { toast } from "sonner";
import { Loader2, FileText, Check } from "lucide-react";

interface FormData {
  childFullName: string;
  childDateOfBirth: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  relationshipToChild: string;
  allergies: string;
  medicalConditions: string;
  medications: string;
  specialInstructions: string;
  authorizedPickupPersons: string;
  photoRelease: boolean;
  termsAcknowledged: boolean;
}

export default function KidsCareServiceForm() {
  const {
    profile,
    isLoading: profileLoading,
    completeKidsCareServiceForm,
    isCompletingKidsCareServiceForm,
  } = useUserProfile();

  const { data: forms, isLoading: formsLoading } = useForms("kids_care_service");

  const [formData, setFormData] = useState<FormData>({
    childFullName: "",
    childDateOfBirth: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    relationshipToChild: "",
    allergies: "",
    medicalConditions: "",
    medications: "",
    specialInstructions: "",
    authorizedPickupPersons: "",
    photoRelease: false,
    termsAcknowledged: false,
  });

  const handleInputChange = (field: keyof FormData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.termsAcknowledged) {
      toast.error("Please acknowledge the terms and conditions");
      return;
    }

    if (!formData.childFullName || !formData.childDateOfBirth || !formData.emergencyContactName || !formData.emergencyContactPhone) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      // Store form data and mark as completed
      // In a real implementation, you might want to store the form data in member_forms table
      completeKidsCareServiceForm();
      toast.success("Service form submitted successfully!");
    } catch (error: any) {
      toast.error("Failed to submit form: " + error.message);
    }
  };

  if (profileLoading || formsLoading) {
    return (
      <MemberLayout title="Kids Care Service Form">
        <Card>
          <CardContent className="p-8">
            <Loader2 className="h-8 w-8 animate-spin mx-auto" />
          </CardContent>
        </Card>
      </MemberLayout>
    );
  }

  const isCompleted = profile?.kids_care_service_form_completed || false;
  const formPdfUrl = forms && forms.length > 0 ? forms[0].pdf_url : null;

  return (
    <MemberLayout title="Kids Care Service Form">
      <div className="space-y-6 max-w-3xl">
        <div className="mb-6">
          <p className="text-muted-foreground">
            Please complete the Kids Care Service Set-Up Form before booking Kids Care services. 
            This form helps us ensure the safety and well-being of your child.
          </p>
        </div>

        {isCompleted && (
          <Card className="bg-green-50 border-green-200">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 text-green-700">
                <Check className="h-6 w-6" />
                <div>
                  <p className="font-semibold">Service Form Completed</p>
                  <p className="text-sm text-green-600">
                    Your Kids Care service form has been completed. You can now book Kids Care services.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* PDF Form View */}
        {formPdfUrl && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-accent" />
                <CardTitle>Service Set-Up Form</CardTitle>
              </div>
              <CardDescription>
                Please review the form below and complete the fields on this page.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AgreementPDFViewer
                pdfUrl={formPdfUrl}
                title="Kids Care Service Set-Up Form"
                height="600px"
                showControls={true}
              />
            </CardContent>
          </Card>
        )}

        {/* Online Form */}
        <Card>
          <CardHeader>
            <CardTitle>Complete Service Form</CardTitle>
            <CardDescription>
              Please provide the following information about your child. All fields marked with * are required.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <Label htmlFor="childFullName">
                    Child's Full Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="childFullName"
                    value={formData.childFullName}
                    onChange={(e) => handleInputChange("childFullName", e.target.value)}
                    required
                    disabled={isCompleted}
                  />
                </div>

                <div>
                  <Label htmlFor="childDateOfBirth">
                    Date of Birth <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="childDateOfBirth"
                    type="date"
                    value={formData.childDateOfBirth}
                    onChange={(e) => handleInputChange("childDateOfBirth", e.target.value)}
                    required
                    disabled={isCompleted}
                  />
                </div>

                <div>
                  <Label htmlFor="emergencyContactName">
                    Emergency Contact Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="emergencyContactName"
                    value={formData.emergencyContactName}
                    onChange={(e) => handleInputChange("emergencyContactName", e.target.value)}
                    required
                    disabled={isCompleted}
                  />
                </div>

                <div>
                  <Label htmlFor="emergencyContactPhone">
                    Emergency Contact Phone <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="emergencyContactPhone"
                    type="tel"
                    value={formData.emergencyContactPhone}
                    onChange={(e) => handleInputChange("emergencyContactPhone", e.target.value)}
                    required
                    disabled={isCompleted}
                  />
                </div>

                <div>
                  <Label htmlFor="relationshipToChild">Relationship to Child</Label>
                  <Input
                    id="relationshipToChild"
                    value={formData.relationshipToChild}
                    onChange={(e) => handleInputChange("relationshipToChild", e.target.value)}
                    placeholder="e.g., Parent, Guardian, Grandparent"
                    disabled={isCompleted}
                  />
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="allergies">Allergies</Label>
                  <Textarea
                    id="allergies"
                    value={formData.allergies}
                    onChange={(e) => handleInputChange("allergies", e.target.value)}
                    placeholder="List any allergies (food, medication, environmental, etc.)"
                    rows={3}
                    disabled={isCompleted}
                  />
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="medicalConditions">Medical Conditions</Label>
                  <Textarea
                    id="medicalConditions"
                    value={formData.medicalConditions}
                    onChange={(e) => handleInputChange("medicalConditions", e.target.value)}
                    placeholder="List any medical conditions we should be aware of"
                    rows={3}
                    disabled={isCompleted}
                  />
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="medications">Current Medications</Label>
                  <Textarea
                    id="medications"
                    value={formData.medications}
                    onChange={(e) => handleInputChange("medications", e.target.value)}
                    placeholder="List any medications your child is currently taking"
                    rows={3}
                    disabled={isCompleted}
                  />
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="specialInstructions">Special Instructions</Label>
                  <Textarea
                    id="specialInstructions"
                    value={formData.specialInstructions}
                    onChange={(e) => handleInputChange("specialInstructions", e.target.value)}
                    placeholder="Any special instructions or notes for our staff"
                    rows={3}
                    disabled={isCompleted}
                  />
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="authorizedPickupPersons">Authorized Pick-Up Persons</Label>
                  <Textarea
                    id="authorizedPickupPersons"
                    value={formData.authorizedPickupPersons}
                    onChange={(e) => handleInputChange("authorizedPickupPersons", e.target.value)}
                    placeholder="List full names of persons authorized to pick up your child"
                    rows={3}
                    disabled={isCompleted}
                  />
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="photoRelease"
                    checked={formData.photoRelease}
                    onCheckedChange={(checked) => handleInputChange("photoRelease", checked as boolean)}
                    disabled={isCompleted}
                  />
                  <Label htmlFor="photoRelease" className="font-normal cursor-pointer">
                    I authorize Storm Wellness Club to photograph my child for promotional purposes (optional)
                  </Label>
                </div>

                <div className="flex items-start gap-3">
                  <Checkbox
                    id="termsAcknowledged"
                    checked={formData.termsAcknowledged}
                    onCheckedChange={(checked) => handleInputChange("termsAcknowledged", checked as boolean)}
                    required
                    disabled={isCompleted}
                  />
                  <Label htmlFor="termsAcknowledged" className="font-normal cursor-pointer">
                    I acknowledge that I have reviewed the service form and provided accurate information. 
                    I understand that my child must be signed in and out by an authorized adult. *
                  </Label>
                </div>
              </div>

              {!isCompleted && (
                <Button type="submit" className="w-full" disabled={isCompletingKidsCareServiceForm}>
                  {isCompletingKidsCareServiceForm ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Submit Service Form"
                  )}
                </Button>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    </MemberLayout>
  );
}

