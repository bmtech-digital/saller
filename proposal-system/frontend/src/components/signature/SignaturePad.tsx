import { useRef, useState, useEffect } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Eraser, Check } from 'lucide-react';
import { Button } from '../ui/Button';

interface SignaturePadProps {
  onSign: (signatureData: { dataUrl: string; timestamp: string }) => void;
  isLoading?: boolean;
}

export function SignaturePad({ onSign, isLoading = false }: SignaturePadProps) {
  const sigCanvas = useRef<SignatureCanvas>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isEmpty, setIsEmpty] = useState(true);

  // Prevent scroll when touching the signature canvas on iOS
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const preventScroll = (e: TouchEvent) => {
      // Prevent scroll only when touching the canvas area
      if (e.target instanceof HTMLCanvasElement) {
        e.preventDefault();
      }
    };

    container.addEventListener('touchmove', preventScroll, { passive: false });
    container.addEventListener('touchstart', preventScroll, { passive: false });

    return () => {
      container.removeEventListener('touchmove', preventScroll);
      container.removeEventListener('touchstart', preventScroll);
    };
  }, []);

  const handleClear = () => {
    sigCanvas.current?.clear();
    setIsEmpty(true);
  };

  const handleEnd = () => {
    setIsEmpty(sigCanvas.current?.isEmpty() ?? true);
  };

  const handleSubmit = () => {
    if (sigCanvas.current && !sigCanvas.current.isEmpty()) {
      const dataUrl = sigCanvas.current.getTrimmedCanvas().toDataURL('image/png');
      onSign({
        dataUrl,
        timestamp: new Date().toISOString(),
      });
    }
  };

  return (
    <div className="space-y-4">
      <div
        ref={containerRef}
        className="border-2 border-dashed border-dark-300 rounded-xl bg-white p-2 touch-none"
      >
        <SignatureCanvas
          ref={sigCanvas}
          canvasProps={{
            className: 'signature-canvas w-full h-48 sm:h-64 cursor-crosshair touch-none',
            style: {
              borderRadius: '8px',
              touchAction: 'none',
            },
          }}
          backgroundColor="rgba(0,0,0,0)"
          penColor="black"
          onEnd={handleEnd}
        />
      </div>

      <p className="text-sm text-dark-500 text-center">
        חתום באצבע או בעכבר בתוך המסגרת
      </p>

      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          variant="outline"
          onClick={handleClear}
          className="flex-1"
          disabled={isEmpty || isLoading}
        >
          <Eraser className="w-5 h-5" />
          נקה חתימה
        </Button>
        <Button
          onClick={handleSubmit}
          className="flex-1"
          disabled={isEmpty || isLoading}
          isLoading={isLoading}
        >
          <Check className="w-5 h-5" />
          שלח הסכם חתום
        </Button>
      </div>
    </div>
  );
}
