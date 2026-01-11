import { QRCodeSVG } from "qrcode.react";
import { Loader2 } from "lucide-react";

interface EntryQRCodeProps {
  token: string | null;
  isLoading: boolean;
  size?: number;
}

export function EntryQRCode({ token, isLoading, size = 256 }: EntryQRCodeProps) {
  if (isLoading) {
    return (
      <div 
        className="flex items-center justify-center bg-white rounded-lg"
        style={{ width: size, height: size }}
      >
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!token) {
    return (
      <div 
        className="flex items-center justify-center bg-muted rounded-lg"
        style={{ width: size, height: size }}
      >
        <p className="text-sm text-muted-foreground text-center px-4">
          Unable to generate entry code
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-white rounded-lg shadow-inner">
      <QRCodeSVG
        value={token}
        size={size}
        level="M"
        includeMargin={false}
        bgColor="#FFFFFF"
        fgColor="#000000"
      />
    </div>
  );
}
