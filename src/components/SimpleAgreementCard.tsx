import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Download, ExternalLink, FileText, Loader2, Check } from "lucide-react";

// Import PDF files directly
import liabilityWaiver from "@/assets/agreements/liability-waiver.pdf";
import membershipAgreement from "@/assets/agreements/membership-agreement.pdf";
import kidsCareAgreement from "@/assets/agreements/kids-care-agreement.pdf";
import kidsCareParentConsent from "@/assets/agreements/kids-care-agreement-parent-consent-form.pdf";
import guestPassGeneral from "@/assets/agreements/guest-pass-agreement-general.pdf";
import guestPassAgreement from "@/assets/agreements/guest-pass-agreement.pdf";
import privateEventAgreement from "@/assets/agreements/private-event-agreement.pdf";
import singleClassPass1 from "@/assets/agreements/single-class-pass-agreement.pdf";
import singleClassPass2 from "@/assets/agreements/single-class-pass-agreement-2.pdf";

// Map filenames to imports
const pdfMap: Record<string, string> = {
  'liability-waiver.pdf': liabilityWaiver,
  'membership-agreement.pdf': membershipAgreement,
  'kids-care-agreement.pdf': kidsCareAgreement,
  'kids-care-agreement-parent-consent-form.pdf': kidsCareParentConsent,
  'guest-pass-agreement-general.pdf': guestPassGeneral,
  'guest-pass-agreement.pdf': guestPassAgreement,
  'private-event-agreement.pdf': privateEventAgreement,
  'single-class-pass-agreement.pdf': singleClassPass1,
  'single-class-pass-agreement-2.pdf': singleClassPass2,
};

// Get PDF path from imported module, filename, or URL
const getPdfPath = (pdfInput: string): string => {
  if (pdfInput.startsWith('http://') || pdfInput.startsWith('https://')) {
    return pdfInput;
  }
  
  const filename = pdfInput.split('/').pop() || pdfInput;
  const importedPath = pdfMap[filename];
  if (importedPath) {
    return importedPath;
  }
  
  if (pdfInput.startsWith('/')) {
    return pdfInput;
  }
  
  return `/agreements/${filename}`;
};

// Get display name from filename
const getDisplayName = (filename: string): string => {
  const name = filename.split('/').pop() || filename;
  return name
    .replace('.pdf', '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

export interface DocumentInfo {
  name?: string;
  url: string;
}

interface SimpleAgreementCardProps {
  title: string;
  description?: string;
  documents: DocumentInfo[];
  onSign: () => void;
  isSigning: boolean;
  required?: boolean;
}

export function SimpleAgreementCard({
  title,
  description,
  documents,
  onSign,
  isSigning,
  required = true,
}: SimpleAgreementCardProps) {
  const [acknowledged, setAcknowledged] = useState(false);

  const handleDownload = (doc: DocumentInfo) => {
    const pdfPath = getPdfPath(doc.url);
    const filename = doc.url.split('/').pop() || 'agreement.pdf';
    const link = document.createElement("a");
    link.href = pdfPath;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenInNewTab = (doc: DocumentInfo) => {
    const pdfPath = getPdfPath(doc.url);
    window.open(pdfPath, '_blank');
  };

  return (
    <div className="space-y-4">
      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}

      <div className="text-sm text-muted-foreground mb-3">
        Please review the following document{documents.length > 1 ? 's' : ''}:
      </div>

      <div className="space-y-3">
        {documents.map((doc, index) => {
          const displayName = doc.name || getDisplayName(doc.url);
          
          return (
            <div 
              key={index} 
              className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
            >
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-accent shrink-0" />
                <span className="font-medium text-sm">{displayName}</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownload(doc)}
                  className="gap-1.5"
                >
                  <Download className="h-4 w-4" />
                  Download
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenInNewTab(doc)}
                  className="gap-1.5"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center space-x-3 pt-4 pb-2">
        <Checkbox 
          id="acknowledge" 
          checked={acknowledged}
          onCheckedChange={(checked) => setAcknowledged(checked === true)}
        />
        <label 
          htmlFor="acknowledge" 
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
        >
          I have reviewed {documents.length > 1 ? 'all documents' : 'this document'} above
        </label>
      </div>

      <Button
        onClick={onSign}
        disabled={!acknowledged || isSigning}
        className="w-full"
        size="lg"
      >
        {isSigning ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Signing...
          </>
        ) : (
          <>
            <Check className="h-4 w-4 mr-2" />
            I Agree — Sign {title}
          </>
        )}
      </Button>
    </div>
  );
}
