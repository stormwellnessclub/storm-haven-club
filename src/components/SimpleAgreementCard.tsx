import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Download, ExternalLink, FileText, Loader2, Check } from "lucide-react";
import { resolvePdfUrl } from "@/lib/pdfAssets";

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

// "Open" is now handled by a native <a> tag in the JSX below,
// which is more reliable on iOS Safari than window.open().

/**
 * Mobile-safe PDF download: fetches the file as a blob and triggers
 * a download via an object URL. Falls back to direct navigation.
 */
const downloadPdf = async (url: string, filename: string) => {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    // Cleanup
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    }, 100);
  } catch {
    // Fallback: just open the URL
    window.location.href = url;
  }
};

export function SimpleAgreementCard({
  title,
  description,
  documents,
  onSign,
  isSigning,
  required = true,
}: SimpleAgreementCardProps) {
  const [acknowledged, setAcknowledged] = useState(false);

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
          const pdfPath = resolvePdfUrl(doc.url);
          const filename = doc.url.split('/').pop() || 'agreement.pdf';
          
          return (
            <div 
              key={index} 
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-lg border bg-muted/30"
            >
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-accent shrink-0" />
                <span className="font-medium text-sm">{displayName}</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => downloadPdf(pdfPath, filename)}
                >
                  <Download className="h-4 w-4" />
                  Download
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  asChild
                >
                  <a href={pdfPath} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                    Open
                  </a>
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
