import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ZoomIn, ZoomOut, Download, Printer, FileText, Loader2, ExternalLink } from "lucide-react";
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

// Get PDF path from imported module, filename, or URL
const getPdfPath = (pdfInput: string): string => {
  // If it's already a full URL, use it directly
  if (pdfInput.startsWith('http://') || pdfInput.startsWith('https://')) {
    console.log(`[PDF] Using URL directly: ${pdfInput}`);
    return pdfInput;
  }
  
  // Extract filename from any path (including absolute paths starting with /)
  const filename = pdfInput.split('/').pop() || pdfInput;
  
  // PRIORITY 1: Try to map filename to imported PDF (most reliable - bundled by Vite)
  const importedPath = pdfMap[filename];
  if (importedPath) {
    console.log(`[PDF] Using imported: ${filename} -> ${importedPath}`);
    return importedPath;
  }
  
  // PRIORITY 2: If it's an absolute path starting with /, use it as-is (public folder)
  if (pdfInput.startsWith('/')) {
    console.log(`[PDF] Using public path: ${pdfInput}`);
    return pdfInput;
  }
  
  // PRIORITY 3: Default: assume it's in public/agreements/
  console.log(`[PDF] Using default public path: /agreements/${filename}`);
  return `/agreements/${filename}`;
};

// Fallback UI component when PDF fails to load
function PDFFallback({ 
  pdfSrc, 
  filename, 
  onDownload 
}: { 
  pdfSrc: string; 
  filename: string; 
  onDownload: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center min-h-[300px]">
      <FileText className="h-16 w-16 mb-4 text-accent" />
      <h3 className="font-medium text-lg mb-2">Unable to Preview PDF</h3>
      <p className="text-sm text-muted-foreground mb-6 max-w-md">
        Your browser cannot display this document inline. 
        Please download or open it in a new tab to review the agreement.
      </p>
      <div className="flex gap-3 flex-wrap justify-center">
        <Button onClick={onDownload} className="gap-2">
          <Download className="h-4 w-4" />
          Download PDF
        </Button>
        <Button 
          variant="outline" 
          onClick={() => window.open(pdfSrc, '_blank')}
          className="gap-2"
        >
          <ExternalLink className="h-4 w-4" />
          Open in New Tab
        </Button>
      </div>
    </div>
  );
}

export function AgreementPDFViewer({
  pdfUrl,
  title,
  showControls = true,
  height = "600px",
  className,
  onDocumentLoad,
}: AgreementPDFViewerProps) {
  const [scale, setScale] = useState(1.0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Handle both single PDF and multiple PDFs
  const pdfs = Array.isArray(pdfUrl) ? pdfUrl : [pdfUrl];
  const [selectedPdfIndex, setSelectedPdfIndex] = useState(0);
  const currentPdf = pdfs[selectedPdfIndex];

  // Reset state when PDF changes - add preflight check
  useEffect(() => {
    setScale(1.0);
    setLoading(true);
    setError(null);
    setIframeLoaded(false);

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    const pdfSrc = getPdfPath(currentPdf);
    
    // Preflight check - verify PDF is accessible
    fetch(pdfSrc, { method: 'HEAD' })
      .then(response => {
        if (!response.ok) {
          console.warn(`[PDF] Preflight failed for ${pdfSrc}: ${response.status}`);
          setError("PDF preview unavailable");
          setLoading(false);
        }
      })
      .catch(err => {
        console.warn(`[PDF] Preflight error for ${pdfSrc}:`, err);
        // Don't set error yet - let iframe try anyway
      });

    // Set a timeout to detect if PDF fails to load (5 seconds - faster since we have fallback buttons)
    timeoutRef.current = setTimeout(() => {
      if (!iframeLoaded) {
        console.warn(`[PDF] Load timeout for: ${currentPdf}`);
        console.warn(`[PDF] Resolved path was: ${pdfSrc}`);
        setError("PDF preview unavailable");
        setLoading(false);
      }
    }, 5000); // 5 second timeout

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [currentPdf]);

  // Handle successful iframe load
  const handleIframeLoad = () => {
    console.log(`[PDF] Loaded successfully: ${currentPdf}`);
    setIframeLoaded(true);
    setLoading(false);
    setError(null);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    onDocumentLoad?.();
  };

  // Handle iframe error
  const handleIframeError = () => {
    console.error(`[PDF] Failed to load: ${currentPdf}`);
    setError("Failed to load PDF");
    setLoading(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  };

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
        {/* Always show action buttons above viewer */}
        <div className="px-4 py-2 border-b bg-muted/30 flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleDownload} className="gap-1">
            <Download className="h-4 w-4" /> Download PDF
          </Button>
          <Button size="sm" variant="outline" onClick={() => window.open(pdfSrc, '_blank')} className="gap-1">
            <ExternalLink className="h-4 w-4" /> Open in New Tab
          </Button>
        </div>
        <ScrollArea className="w-full" style={{ height }}>
          {loading && !error && (
            <div className="flex items-center justify-center h-full min-h-[300px]">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Loading agreement...</p>
              </div>
            </div>
          )}
          {error ? (
            <PDFFallback 
              pdfSrc={pdfSrc} 
              filename={typeof currentPdf === 'string' ? currentPdf : 'agreement.pdf'} 
              onDownload={handleDownload}
            />
          ) : (
            <iframe
              src={pdfSrc}
              className={cn("w-full border-0", loading ? "opacity-0 absolute" : "opacity-100")}
              style={{ height: '100%', minHeight: height }}
              onLoad={handleIframeLoad}
              onError={handleIframeError}
              title={title || "PDF Viewer"}
            />
          )}
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
                  {selectedPdfIndex === index && loading && !error && (
                    <div className="flex items-center justify-center h-full min-h-[300px]">
                      <div className="text-center">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">Loading agreement...</p>
                      </div>
                    </div>
                  )}
                  {selectedPdfIndex === index && error ? (
                    <PDFFallback 
                      pdfSrc={pdfSrc} 
                      filename={typeof pdf === 'string' ? pdf : `agreement-${index + 1}.pdf`} 
                      onDownload={() => {
                        const link = document.createElement("a");
                        link.href = pdfSrc;
                        link.download = typeof pdf === 'string' ? pdf : `agreement-${index + 1}.pdf`;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      }}
                    />
                  ) : (
                    <iframe
                      src={pdfSrc}
                      className={cn("w-full border-0", selectedPdfIndex === index && loading ? "opacity-0 absolute" : "opacity-100")}
                      style={{ height: '100%', minHeight: height }}
                      onLoad={handleIframeLoad}
                      onError={handleIframeError}
                      title={title || `PDF ${index + 1}`}
                    />
                  )}
                </ScrollArea>
              </div>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
