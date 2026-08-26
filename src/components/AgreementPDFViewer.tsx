import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ZoomIn, ZoomOut, Download, Printer, FileText, Loader2, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { resolvePdfUrl } from "@/lib/pdfAssets";
import { useIsMobile } from "@/hooks/use-mobile";

// Mobile-friendly card shown instead of iframe on phones
function MobilePDFCard({ pdfSrc, filename }: { pdfSrc: string; filename: string }) {
  const downloadPdf = async () => {
    try {
      const response = await fetch(pdfSrc);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("text/html")) {
        throw new Error("Received HTML instead of PDF");
      }
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      }, 100);
    } catch (err) {
      console.warn("[PDF download] Falling back to direct open:", err);
      window.open(pdfSrc, "_blank");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 text-center min-h-[200px]">
      <FileText className="h-12 w-12 mb-4 text-accent" />
      <h3 className="font-medium text-base mb-1">Document Ready</h3>
      <p className="text-sm text-muted-foreground mb-5 max-w-xs">
        Tap below to view or download this document.
      </p>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <Button asChild size="lg" className="w-full gap-2">
          <a href={pdfSrc} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4" />
            Open PDF
          </a>
        </Button>
        <Button variant="outline" size="lg" className="w-full gap-2" onClick={downloadPdf}>
          <Download className="h-4 w-4" />
          Download PDF
        </Button>
      </div>
    </div>
  );
}

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
  const [scale, setScale] = useState(1.0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const iframeLoadedRef = useRef(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    iframeLoadedRef.current = iframeLoaded;
  }, [iframeLoaded]);

  const pdfs = Array.isArray(pdfUrl) ? pdfUrl : [pdfUrl];
  const [selectedPdfIndex, setSelectedPdfIndex] = useState(0);
  const currentPdf = pdfs[selectedPdfIndex];

  useEffect(() => {
    if (isMobile) {
      setLoading(false);
      return;
    }

    setScale(1.0);
    setLoading(true);
    setError(null);
    setIframeLoaded(false);
    iframeLoadedRef.current = false;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    const pdfSrc = resolvePdfUrl(currentPdf);

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
      });

    timeoutRef.current = setTimeout(() => {
      if (!iframeLoadedRef.current) {
        setError("PDF preview unavailable");
        setLoading(false);
      }
    }, 10000);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [currentPdf, isMobile]);

  const handleIframeLoad = useCallback(() => {
    iframeLoadedRef.current = true;
    setIframeLoaded(true);
    setLoading(false);
    setError(null);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    onDocumentLoad?.();
  }, [onDocumentLoad]);

  const handleIframeError = useCallback(() => {
    setError("Failed to load PDF");
    setLoading(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, []);

  const handleDownload = () => {
    const filename = typeof currentPdf === 'string' ? currentPdf : `agreement-${selectedPdfIndex + 1}.pdf`;
    const pdfPath = resolvePdfUrl(currentPdf);
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

  if (pdfs.length === 1) {
    const pdfSrc = resolvePdfUrl(currentPdf);

    // Mobile: show simple open/download card instead of iframe
    if (isMobile) {
      return (
        <div className={cn("flex flex-col border rounded-lg overflow-hidden", className)}>
          {title && (
            <div className="px-4 py-2 bg-secondary/50 border-b">
              <h3 className="font-medium">{title}</h3>
            </div>
          )}
          <MobilePDFCard pdfSrc={pdfSrc} filename={currentPdf} />
        </div>
      );
    }

    return (
      <div className={cn("flex flex-col border rounded-lg overflow-hidden", className)}>
        {title && (
          <div className="px-4 py-2 bg-secondary/50 border-b flex items-center justify-between">
            <h3 className="font-medium">{title}</h3>
            {showControls && (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={zoomOut} disabled={scale <= 0.5} aria-label="Zoom out">
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground min-w-[60px] text-center">
                  {Math.round(scale * 100)}%
                </span>
                <Button variant="ghost" size="sm" onClick={zoomIn} disabled={scale >= 3.0}>
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={handleDownload} aria-label="Download agreement PDF">
                  <Download className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={handlePrint} aria-label="Print agreement">
                  <Printer className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        )}
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
            <PDFFallback pdfSrc={pdfSrc} filename={currentPdf} onDownload={handleDownload} />
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
          {pdfs.map((_, index) => (
            <TabsTrigger key={index} value={index.toString()}>
              Document {index + 1}
            </TabsTrigger>
          ))}
        </TabsList>
        {pdfs.map((pdf, index) => {
          const pdfSrc = resolvePdfUrl(pdf);
          
          return (
            <TabsContent key={index} value={index.toString()} className="m-0">
              <div className="flex flex-col">
                {/* Mobile: show simple card */}
                {isMobile ? (
                  <MobilePDFCard pdfSrc={pdfSrc} filename={typeof pdf === 'string' ? pdf : `agreement-${index + 1}.pdf`} />
                ) : (
                  <>
                    {showControls && (
                      <div className="px-4 py-2 border-b flex items-center justify-between bg-background">
                        <span className="text-sm text-muted-foreground">
                          Viewing Document {index + 1}
                        </span>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm" onClick={zoomOut} disabled={scale <= 0.5} aria-label="Zoom out">
                            <ZoomOut className="h-4 w-4" />
                          </Button>
                          <span className="text-sm text-muted-foreground min-w-[60px] text-center">
                            {Math.round(scale * 100)}%
                          </span>
                          <Button variant="ghost" size="sm" onClick={zoomIn} disabled={scale >= 3.0}>
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
                          <Button variant="ghost" size="sm" onClick={handlePrint} aria-label="Print agreement">
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
                  </>
                )}
              </div>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
