import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ZoomIn, ZoomOut, Download, Printer, FileText, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

interface AgreementPDFViewerProps {
  pdfUrl: string | string[];
  title?: string;
  showControls?: boolean;
  height?: string;
  className?: string;
  onDocumentLoad?: () => void;
}

export function AgreementPDFViewer({
  pdfUrl,
  title,
  showControls = true,
  height = "600px",
  className,
  onDocumentLoad,
}: AgreementPDFViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Handle both single PDF and multiple PDFs
  const pdfs = Array.isArray(pdfUrl) ? pdfUrl : [pdfUrl];
  const [selectedPdfIndex, setSelectedPdfIndex] = useState(0);
  const currentPdf = pdfs[selectedPdfIndex];

  // Get PDF path from imported module or filename
  const getPdfPath = (filename: string) => {
    return pdfMap[filename] || `/src/assets/agreements/${filename}`;
  };

  useEffect(() => {
    setPageNumber(1);
    setScale(1.0);
    setLoading(true);
    setError(null);
  }, [currentPdf]);


  const handleDownload = () => {
    const filename = typeof currentPdf === 'string' ? currentPdf : `agreement-${selectedPdfIndex + 1}.pdf`;
    const pdfPath = typeof currentPdf === 'string' ? getPdfPath(currentPdf) : currentPdf;
    const link = document.createElement("a");
    link.href = pdfPath;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  const zoomIn = () => setScale((prev) => Math.min(prev + 0.25, 3.0));
  const zoomOut = () => setScale((prev) => Math.max(prev - 0.25, 0.5));

  // Simple PDF display using iframe (more reliable than react-pdf for large files)
  if (pdfs.length === 1) {
    // Single PDF - use iframe for better compatibility
    const pdfSrc = typeof currentPdf === 'string' 
      ? getPdfPath(currentPdf)
      : currentPdf;

    return (
      <div className={cn("flex flex-col border rounded-lg overflow-hidden", className)}>
        {title && (
          <div className="px-4 py-2 bg-secondary/50 border-b flex items-center justify-between">
            <h3 className="font-medium">{title}</h3>
            {showControls && (
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={zoomOut}
                  disabled={scale <= 0.5}
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground min-w-[60px] text-center">
                  {Math.round(scale * 100)}%
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={zoomIn}
                  disabled={scale >= 3.0}
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={handleDownload}>
                  <Download className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={handlePrint}>
                  <Printer className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        )}
        <ScrollArea className="w-full" style={{ height }}>
          {loading && (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}
          {error && (
            <div className="flex items-center justify-center h-full p-8">
              <div className="text-center">
                <FileText className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">{error}</p>
              </div>
            </div>
          )}
          <iframe
            src={pdfSrc}
            className="w-full border-0"
            style={{ height: '100%', minHeight: height }}
            onLoad={() => setLoading(false)}
            onError={() => {
              setError("Failed to load PDF");
              setLoading(false);
            }}
            title={title || "PDF Viewer"}
          />
        </ScrollArea>
      </div>
    );
  }

  // Multiple PDFs - show tabs
  return (
    <div className={cn("flex flex-col border rounded-lg overflow-hidden", className)}>
      {title && (
        <div className="px-4 py-2 bg-secondary/50 border-b">
          <h3 className="font-medium">{title}</h3>
        </div>
      )}
      <Tabs value={selectedPdfIndex.toString()} onValueChange={(val) => setSelectedPdfIndex(parseInt(val))}>
        <TabsList className="w-full justify-start rounded-none border-b">
          {pdfs.map((pdf, index) => (
            <TabsTrigger key={index} value={index.toString()}>
              {typeof pdf === 'string' 
                ? `Document ${index + 1}`
                : `Document ${index + 1}`
              }
            </TabsTrigger>
          ))}
        </TabsList>
        {pdfs.map((pdf, index) => {
          const pdfSrc = typeof pdf === 'string' 
            ? getPdfPath(pdf)
            : pdf;
          
          return (
            <TabsContent key={index} value={index.toString()} className="m-0">
              <div className="flex flex-col">
                {showControls && (
                  <div className="px-4 py-2 border-b flex items-center justify-between bg-background">
                    <span className="text-sm text-muted-foreground">
                      Viewing {typeof pdf === 'string' ? `Document ${index + 1}` : `Document ${index + 1}`}
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={zoomOut}
                        disabled={scale <= 0.5}
                      >
                        <ZoomOut className="h-4 w-4" />
                      </Button>
                      <span className="text-sm text-muted-foreground min-w-[60px] text-center">
                        {Math.round(scale * 100)}%
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={zoomIn}
                        disabled={scale >= 3.0}
                      >
                        <ZoomIn className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => {
                          const link = document.createElement("a");
                          link.href = pdfSrc;
                          link.download = typeof pdf === 'string' ? pdf : `agreement-${index + 1}.pdf`;
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                        }}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={handlePrint}>
                        <Printer className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
                <ScrollArea className="w-full" style={{ height }}>
                  <iframe
                    src={pdfSrc}
                    className="w-full border-0"
                    style={{ height: '100%', minHeight: height }}
                    title={title || `PDF ${index + 1}`}
                  />
                </ScrollArea>
              </div>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}

