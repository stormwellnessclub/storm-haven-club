import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Camera, Upload, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { SignedMemberPhoto } from "@/components/member/SignedMemberPhoto";

interface MemberPhotoUploadProps {
  memberId: string;
  currentPhotoUrl: string | null;
  firstName: string;
  lastName: string;
  onPhotoUpdated?: (url: string) => void;
}

export function MemberPhotoUpload({
  memberId,
  currentPhotoUrl,
  firstName,
  lastName,
  onPhotoUpdated,
}: MemberPhotoUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const initials = `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a JPG, PNG, or WebP image.",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload an image smaller than 5MB.",
        variant: "destructive",
      });
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = (event) => {
      setPreviewUrl(event.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Upload to Supabase Storage
    await uploadPhoto(file);
  };

  const uploadPhoto = async (file: File) => {
    setIsUploading(true);

    try {
      const fileExt = file.name.split(".").pop() || "jpg";
      const filePath = `${memberId}/profile.${fileExt}`;

      // Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from("member-photos")
        .upload(filePath, file, {
          upsert: true,
          cacheControl: "3600",
        });

      if (uploadError) {
        console.error("[Photo Upload] Storage error:", uploadError);
        throw new Error("Failed to upload photo");
      }

      // Update member record
      const { error: updateError } = await supabase
        .from("members")
        .update({ photo_url: filePath })
        .eq("id", memberId);

      if (updateError) {
        console.error("[Photo Upload] Update error:", updateError);
        throw new Error("Failed to save photo");
      }

      toast({
        title: "Photo updated",
        description: "Your profile photo has been updated successfully.",
      });

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["user-membership"] });
      queryClient.invalidateQueries({ queryKey: ["entry-token"] });

      if (onPhotoUpdated) {
        onPhotoUpdated(filePath);
      }
    } catch (error: any) {
      console.error("[Photo Upload] Error:", error);
      toast({
        title: "Upload failed",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
      setPreviewUrl(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemovePreview = () => {
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <Avatar className="h-32 w-32 border-4 border-accent/30">
          {previewUrl ? (
            <AvatarImage
              src={previewUrl}
              alt={`${firstName} ${lastName}`}
              className="object-cover"
            />
          ) : (
            <SignedMemberPhoto
              photoUrl={currentPhotoUrl}
              alt={`${firstName} ${lastName}`}
              className="object-cover"
            />
          )}
          <AvatarFallback className="text-2xl bg-muted">
            {initials || <Camera className="h-8 w-8 text-muted-foreground" />}
          </AvatarFallback>
        </Avatar>
        
        {isUploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
            <Loader2 className="h-8 w-8 animate-spin text-white" />
          </div>
        )}
        
        {previewUrl && !isUploading && (
          <button
            onClick={handleRemovePreview}
            className="absolute -top-2 -right-2 p-1 bg-destructive text-destructive-foreground rounded-full hover:bg-destructive/90"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileSelect}
        className="hidden"
      />

      <Button
        variant="outline"
        size="sm"
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
        className="gap-2"
      >
        <Upload className="h-4 w-4" />
        {currentPhotoUrl ? "Change Photo" : "Upload Photo"}
      </Button>

      <p className="text-xs text-muted-foreground text-center max-w-xs">
        Upload a clear headshot for entry verification. JPG, PNG, or WebP up to 5MB.
      </p>
    </div>
  );
}
