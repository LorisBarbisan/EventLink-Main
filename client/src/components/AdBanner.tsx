import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export function AdBanner() {
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem('adBannerDismissed');
    if (dismissed === 'true') {
      setIsDismissed(true);
    }
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem('adBannerDismissed', 'true');
  };

  if (isDismissed) {
    return null;
  }

  return (
    <Card className="sticky top-4 overflow-hidden" data-testid="card-ad-banner">
      <div className="relative">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDismiss}
          className="absolute top-2 right-2 z-10 h-6 w-6 p-0 rounded-full bg-background/80 hover:bg-background"
          data-testid="button-dismiss-ad"
        >
          <X className="h-4 w-4" />
        </Button>
        
        <CardContent className="p-4">
          <a
            href="https://www.amazon.co.uk/Bibury-Multi-Tool-Multitools-Screwdriver-Activities/dp/B07QK3WH7D?crid=1A62MY33QFBHL&dib=eyJ2IjoiMSJ9.jXuZYK8ZXVDIZUhFBJ4Mlsv54NVW8eQMJneoCO4VQrP6v_uTAuR8I4EX5jvYmd92QKPLoxxVP2ghfEy74Ta5PNTCWlY_u-Ed-j0guCqLnUeu4xisLsQzZbccbDZ2UxCaYcDSW5htGEunecCme4f1koB0MPHdJ9c1zVddKzhwlzNs27OfneYduxkmWAHAmKM0mplXvz_9YGTirVtTO9h7Mf-wt2FnLN2qQ9ofG_eKBNfp0Xbgyrb0L0YMhF6wPqokQ5dn4J56W5pfsi6sp_7A6frs_tRaPac2ss7Zfo_40yA.EIy6vMYa6WRcDVtysQG-qzN-FU1F6uLP9ZVYLukWRK4&dib_tag=se&keywords=leatherman%2Bmulti-tool&qid=1762244483&sprefix=leatherman%2Caps%2C346&sr=8-3&th=1&linkCode=ll1&tag=eventlink2025-21&linkId=4400fdd5f90d696440d178d953b3bd66&language=en_GB&ref_=as_li_ss_tl"
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="block hover:opacity-90 transition-opacity"
            data-testid="link-amazon-product"
          >
            <div className="flex flex-col gap-3">
              {/* Product Image */}
              <div className="w-full aspect-square bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 rounded-lg flex items-center justify-center overflow-hidden">
                <img
                  src="https://m.media-amazon.com/images/I/71gZnG4RZNL._AC_SL1500_.jpg"
                  alt="Bibury Multi-Tool"
                  className="w-full h-full object-contain p-4"
                  loading="lazy"
                />
              </div>

              {/* Product Info */}
              <div className="space-y-2">
                <h3 className="font-semibold text-sm leading-tight line-clamp-2">
                  Bibury Multi-Tool, 15-in-1 Stainless Steel Multitools
                </h3>
                
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-primary">£12.99</span>
                </div>
                
                <div className="flex items-center gap-1 text-xs text-yellow-600 dark:text-yellow-500">
                  {'★'.repeat(5)}
                  <span className="ml-1 text-muted-foreground">(4,000+)</span>
                </div>

                <p className="text-xs text-muted-foreground line-clamp-2">
                  Perfect for outdoor activities, camping, and DIY projects. Compact and portable design.
                </p>

                <div className="pt-2">
                  <div className="inline-flex items-center gap-1 px-3 py-1.5 bg-gradient-primary text-white text-sm font-medium rounded-md">
                    View on Amazon →
                  </div>
                </div>

                <p className="text-[10px] text-muted-foreground italic">
                  Sponsored • As an Amazon Associate, EventLink earns from qualifying purchases
                </p>
              </div>
            </div>
          </a>
        </CardContent>
      </div>
    </Card>
  );
}
