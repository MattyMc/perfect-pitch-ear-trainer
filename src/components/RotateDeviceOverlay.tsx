import React, { useState, useEffect } from 'react';
import { Smartphone } from 'lucide-react';

export default function RotateDeviceOverlay() {
  const [isLandscape, setIsLandscape] = useState(false);

  useEffect(() => {
    const checkOrientation = () => {
      setIsLandscape(window.innerWidth > window.innerHeight);
    };

    window.addEventListener('resize', checkOrientation);
    checkOrientation();

    return () => window.removeEventListener('resize', checkOrientation);
  }, []);

  if (!isLandscape) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900 text-white flex flex-col items-center justify-center p-8 text-center select-none">
      <Smartphone className="w-32 h-32 text-blue-400 mb-8 animate-spin-slow" />
      <h2 className="text-3xl font-bold mb-4">Please rotate your device</h2>
      <p className="text-xl text-slate-300">
        Practice is only supported in portrait orientation to keep the cards in the same place.
      </p>
    </div>
  );
}
