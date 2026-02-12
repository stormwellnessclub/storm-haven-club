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

export function SimpleAgreementCard({
  title,
  description,
  documents,
  onSign,
  isSigning,
  required = true,
}: SimpleAgreementCardProps) {
  const [acknowledged, setAcknowledged] = useState(false);

  const getPdfPath = (doc: DocumentInfo) => resolvePdfUrl(doc.url);
  const getFilename = (doc: DocumentInfo) => doc.url.split('/').pop() || 'agreement.pdf';

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
          const pdfPath = getPdfPath(doc);
          const filename = getFilename(doc);
          
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
                  asChild
                >
                  <a href={pdfPath} download={filename}>
                    <Download className="h-4 w-4" />
                    Download
                  </a>
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
