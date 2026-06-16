import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Download, QrCode, RefreshCw } from "lucide-react";
import { useState } from "react";

interface Props {
  userId: number;
  profileUrl: string;
}

export function ProfileQRCode({ userId, profileUrl }: Props) {
  const { toast } = useToast();
  const [cacheBuster, setCacheBuster] = useState(0);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  const qrSrc = `/api/qr/${userId}${cacheBuster ? `?v=${cacheBuster}` : ""}`;

  const handleRegenerate = () => {
    setCacheBuster(Date.now());
    setImgLoaded(false);
    setImgError(false);
  };

  const handleDownload = async () => {
    try {
      const res = await fetch(qrSrc);
      if (!res.ok) throw new Error("Failed to fetch QR");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `eventlink-qr-profile.png`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "QR code downloaded" });
    } catch {
      toast({ title: "Download failed", variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <QrCode className="h-5 w-5" />
          Your QR Code
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        <p className="text-sm text-muted-foreground text-center">
          Share this QR code at events so people can instantly access your profile.
        </p>

        {/* QR image */}
        <div className="relative flex flex-col items-center gap-2 rounded-xl border border-border bg-white p-4 shadow-sm">
          {imgError ? (
            <div className="flex h-48 w-48 flex-col items-center justify-center gap-2 text-muted-foreground">
              <QrCode className="h-10 w-10 opacity-30" />
              <p className="text-xs text-center">QR generation requires<br />installing dependencies.</p>
              <p className="text-xs text-center text-primary">Run: npm install</p>
            </div>
          ) : (
            <>
              {!imgLoaded && (
                <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-white">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              )}
              <img
                src={qrSrc}
                alt="Profile QR code"
                className={`h-48 w-48 transition-opacity ${imgLoaded ? "opacity-100" : "opacity-0"}`}
                onLoad={() => setImgLoaded(true)}
                onError={() => setImgError(true)}
              />
            </>
          )}

          {/* EventLink branding */}
          <div className="flex items-center gap-1.5 pt-1">
            <span className="text-[11px] font-semibold text-muted-foreground tracking-wide uppercase">
              EventLink
            </span>
            <span className="text-[11px] text-muted-foreground">·</span>
            <span className="text-[11px] text-muted-foreground truncate max-w-[160px]">
              {profileUrl.replace(/^https?:\/\//, "")}
            </span>
          </div>
        </div>

        <div className="flex w-full flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            className="flex-1"
            onClick={handleRegenerate}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Regenerate
          </Button>
          <Button
            className="flex-1"
            onClick={handleDownload}
            disabled={imgError || !imgLoaded}
          >
            <Download className="mr-2 h-4 w-4" />
            Download PNG
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
