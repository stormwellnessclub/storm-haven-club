import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAgreements, useForms, useCreateAgreement, useUpdateAgreement, useDeleteAgreement, type Agreement, type Form } from "@/hooks/useAgreements";
import { useState } from "react";
import { Loader2, Plus, Edit, Trash2, Save, X, FileText, CheckCircle, AlertCircle, Upload } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AgreementPDFViewer } from "@/components/AgreementPDFViewer";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const AGREEMENT_TYPES = [
  { value: "liability_waiver", label: "Liability Waiver" },
  { value: "membership_agreement", label: "Membership Agreement" },
  { value: "kids_care", label: "Kids Care" },
  { value: "guest_pass", label: "Guest Pass" },
  { value: "private_event", label: "Private Event" },
  { value: "single_class_pass", label: "Single Class Pass" },
  { value: "class_package", label: "Class Package" },
];

const FORM_TYPES = [
  { value: "kids_care_service", label: "Kids Care Service" },
  { value: "kids_care_minor_consent", label: "Kids Care Minor Consent" },
  { value: "private_event", label: "Private Event" },
  { value: "private_event_class", label: "Private Event Class" },
];

function AgreementManagement() {
  const { data: agreements, isLoading } = useAgreements(undefined, true); // Include inactive for admin view
  const createAgreement = useCreateAgreement();
  const updateAgreement = useUpdateAgreement();
  const deleteAgreement = useDeleteAgreement();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAgreement, setEditingAgreement] = useState<Agreement | null>(null);
  const [deletingAgreement, setDeletingAgreement] = useState<Agreement | null>(null);
  const [formData, setFormData] = useState({
    agreement_type: "liability_waiver",
    title: "",
    pdf_url: "",
    display_order: 0,
    is_required: true,
    version: "1.0",
    is_active: true,
    effective_date: "",
  });

  const handleOpenDialog = (agreement?: Agreement) => {
    if (agreement) {
      setEditingAgreement(agreement);
      setFormData({
        agreement_type: agreement.agreement_type,
        title: agreement.title,
        pdf_url: agreement.pdf_url,
        display_order: agreement.display_order,
        is_required: agreement.is_required,
        version: agreement.version || "1.0",
        is_active: agreement.is_active,
        effective_date: agreement.effective_date || "",
      });
    } else {
      setEditingAgreement(null);
      setFormData({
        agreement_type: "liability_waiver",
        title: "",
        pdf_url: "",
        display_order: 0,
        is_required: true,
        version: "1.0",
        is_active: true,
        effective_date: "",
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingAgreement(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim() || !formData.pdf_url.trim()) {
      toast.error("Title and PDF URL are required");
      return;
    }

    try {
      if (editingAgreement) {
        await updateAgreement.mutateAsync({
          id: editingAgreement.id,
          agreement_type: formData.agreement_type,
          title: formData.title.trim(),
          pdf_url: formData.pdf_url.trim(),
          display_order: formData.display_order,
          is_required: formData.is_required,
          version: formData.version || null,
          is_active: formData.is_active,
          effective_date: formData.effective_date || null,
        });
      } else {
        await createAgreement.mutateAsync({
          agreement_type: formData.agreement_type,
          title: formData.title.trim(),
          pdf_url: formData.pdf_url.trim(),
          display_order: formData.display_order,
          is_required: formData.is_required,
          version: formData.version || null,
          is_active: formData.is_active,
          effective_date: formData.effective_date || null,
        });
      }
      handleCloseDialog();
    } catch (error: any) {
      console.error("Failed to save agreement:", error);
      // Error toast is handled by the mutation
    }
  };

  const handleDelete = async () => {
    if (!deletingAgreement) return;

    try {
      await deleteAgreement.mutateAsync(deletingAgreement.id);
      setDeletingAgreement(null);
    } catch (error: any) {
      console.error("Failed to delete agreement:", error);
      // Error toast is handled by the mutation
    }
  };

  const handlePDFUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (file.type !== "application/pdf") {
      toast.error("Please upload a PDF file.");
      return;
    }

    // Validate file size (max 50MB for PDFs)
    if (file.size > 50 * 1024 * 1024) {
      toast.error("Please upload a PDF smaller than 50MB.");
      return;
    }

    try {
      const fileExt = file.name.split(".").pop() || "pdf";
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `agreements/${fileName}`;

      // Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from("agreements")
        .upload(filePath, file, {
          upsert: true,
          cacheControl: "3600",
        });

      if (uploadError) {
        console.error("[Agreement PDF Upload] Storage error:", uploadError);
        toast.error("Failed to upload PDF. Please try again.");
        return;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("agreements")
        .getPublicUrl(filePath);

      const pdfUrl = `${urlData.publicUrl}?t=${Date.now()}`; // Cache bust

      // Update form data with the uploaded PDF URL
      setFormData({ ...formData, pdf_url: pdfUrl });
      toast.success("PDF uploaded successfully!");
    } catch (error: any) {
      console.error("[Agreement PDF Upload] Error:", error);
      toast.error(error.message || "Failed to upload PDF. Please try again.");
    }
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  // Group agreements by type
  const agreementsByType = agreements?.reduce((acc, agreement) => {
    if (!acc[agreement.agreement_type]) {
      acc[agreement.agreement_type] = [];
    }
    acc[agreement.agreement_type].push(agreement);
    return acc;
  }, {} as Record<string, Agreement[]>) || {};

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Agreement Management</h1>
            <p className="text-muted-foreground">
              Manage agreement documents and PDFs. Agreements are displayed to members on the Waivers & Agreements page.
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Add Agreement
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingAgreement ? "Edit Agreement" : "Add New Agreement"}
                </DialogTitle>
                <DialogDescription>
                  Add or update agreement documents. Multiple PDFs can be associated with the same agreement type.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="agreement_type">Agreement Type *</Label>
                    <Select
                      value={formData.agreement_type}
                      onValueChange={(value) => setFormData({ ...formData, agreement_type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {AGREEMENT_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="display_order">Display Order</Label>
                    <Input
                      id="display_order"
                      type="number"
                      value={formData.display_order}
                      onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
                      min="0"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g., Membership Agreement"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pdf_url">PDF URL *</Label>
                  <div className="flex gap-2">
                    <Input
                      id="pdf_url"
                      value={formData.pdf_url}
                      onChange={(e) => setFormData({ ...formData, pdf_url: e.target.value })}
                      placeholder="https://example.com/agreement.pdf or upload file"
                      required
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById('pdf-upload')?.click()}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Upload PDF
                    </Button>
                    <input
                      id="pdf-upload"
                      type="file"
                      accept="application/pdf"
                      className="hidden"
                      onChange={handlePDFUpload}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Upload a PDF file or provide a URL to an existing PDF
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="version">Version</Label>
                    <Input
                      id="version"
                      value={formData.version}
                      onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                      placeholder="1.0"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="effective_date">Effective Date</Label>
                    <Input
                      id="effective_date"
                      type="date"
                      value={formData.effective_date}
                      onChange={(e) => setFormData({ ...formData, effective_date: e.target.value })}
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="is_required"
                    checked={formData.is_required}
                    onChange={(e) => setFormData({ ...formData, is_required: e.target.checked })}
                    className="rounded border-gray-300"
                  />
                  <Label htmlFor="is_required">Required Agreement</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="rounded border-gray-300"
                  />
                  <Label htmlFor="is_active">Active</Label>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={handleCloseDialog}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    <Save className="h-4 w-4 mr-2" />
                    Save
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          {/* Delete Confirmation Dialog */}
          <AlertDialog open={!!deletingAgreement} onOpenChange={(open) => !open && setDeletingAgreement(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Agreement</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete "{deletingAgreement?.title}"? This will mark it as inactive. Members will no longer see this agreement.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {/* Agreements by Type */}
        {Object.keys(agreementsByType).length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground mb-4">No agreements configured</p>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Agreement
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {AGREEMENT_TYPES.map((type) => {
              const typeAgreements = agreementsByType[type.value] || [];
              if (typeAgreements.length === 0) return null;

              return (
                <Card key={type.value}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      {type.label}
                    </CardTitle>
                    <CardDescription>
                      {typeAgreements.length} {typeAgreements.length === 1 ? 'document' : 'documents'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {typeAgreements.map((agreement) => (
                        <div
                          key={agreement.id}
                          className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-semibold">{agreement.title}</h3>
                                {agreement.is_required && (
                                  <Badge variant="outline" className="text-xs">
                                    Required
                                  </Badge>
                                )}
                                {!agreement.is_active && (
                                  <Badge variant="secondary" className="text-xs">
                                    Inactive
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                PDF: {agreement.pdf_url}
                              </p>
                              {agreement.version && (
                                <p className="text-xs text-muted-foreground">
                                  Version: {agreement.version}
                                </p>
                              )}
                              <p className="text-xs text-muted-foreground">
                                Order: {agreement.display_order}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleOpenDialog(agreement)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => setDeletingAgreement(agreement)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          <div className="mt-3">
                            <AgreementPDFViewer
                              pdfUrl={agreement.pdf_url}
                              title={agreement.title}
                              height="300px"
                              showControls={true}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

function FormsManagement() {
  const { data: forms, isLoading } = useForms();
  // Similar structure to AgreementManagement but for forms
  // TODO: Implement form management UI similar to agreements

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Forms Management</CardTitle>
        <CardDescription>
          Manage fillable forms (Kids Care Service Forms, Private Event Forms, etc.)
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!forms || forms.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No forms configured</p>
        ) : (
          <div className="space-y-4">
            {forms.map((form) => (
              <div key={form.id} className="border rounded-lg p-4">
                <h3 className="font-semibold">{form.title}</h3>
                <p className="text-sm text-muted-foreground">{form.description}</p>
                <p className="text-xs text-muted-foreground mt-1">Type: {form.form_type}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Agreements() {
  return (
    <AdminLayout>
      <Tabs defaultValue="agreements" className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Agreements & Forms</h1>
            <p className="text-muted-foreground">
              Manage agreement documents and fillable forms for members
            </p>
          </div>
        </div>

        <TabsList>
          <TabsTrigger value="agreements">Agreements</TabsTrigger>
          <TabsTrigger value="forms">Forms</TabsTrigger>
        </TabsList>

        <TabsContent value="agreements">
          <AgreementManagement />
        </TabsContent>

        <TabsContent value="forms">
          <FormsManagement />
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
}

