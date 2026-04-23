import { useState, useRef, useEffect } from 'react';

interface Marker {
  x: number;
  y: number;
  label: string;
}

interface Markers {
  1: Marker[];
  2: Marker[];
}

export function CoordinatesToolPage() {
  const [currentPage, setCurrentPage] = useState<1 | 2>(1);
  const [markers, setMarkers] = useState<Markers>(() => {
    const saved = localStorage.getItem('pdfCoordinates');
    return saved ? JSON.parse(saved) : { 1: [], 2: [] };
  });
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const [showGrid, setShowGrid] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('pdfCoordinates', JSON.stringify(markers));
  }, [markers]);

  // Convert displayed coordinates to original image coordinates
  const toOriginalCoords = (displayX: number, displayY: number) => {
    if (!imgRef.current) return { x: 0, y: 0 };
    const rect = imgRef.current.getBoundingClientRect();
    const scaleX = imgRef.current.naturalWidth / rect.width;
    const scaleY = imgRef.current.naturalHeight / rect.height;
    return {
      x: Math.round(displayX * scaleX),
      y: Math.round(displayY * scaleY)
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const displayX = e.clientX - rect.left;
    const displayY = e.clientY - rect.top;
    const original = toOriginalCoords(displayX, displayY);
    setCoords(original);
  };

  const handleClick = (e: React.MouseEvent) => {
    if (!imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const displayX = e.clientX - rect.left;
    const displayY = e.clientY - rect.top;
    const { x, y } = toOriginalCoords(displayX, displayY);

    const label = prompt('שם השדה:', `שדה ${markers[currentPage].length + 1}`);
    if (!label) return;

    setMarkers(prev => ({
      ...prev,
      [currentPage]: [...prev[currentPage], { x, y, label }]
    }));
  };

  const removeMarker = (index: number) => {
    setMarkers(prev => ({
      ...prev,
      [currentPage]: prev[currentPage].filter((_, i) => i !== index)
    }));
  };

  const updateLabel = (index: number, newLabel: string) => {
    setMarkers(prev => ({
      ...prev,
      [currentPage]: prev[currentPage].map((m, i) =>
        i === index ? { ...m, label: newLabel } : m
      )
    }));
  };

  const exportCoords = () => {
    const data = {
      page1: markers[1],
      page2: markers[2],
      imageSize: imgRef.current ? {
        width: imgRef.current.naturalWidth,
        height: imgRef.current.naturalHeight
      } : null
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pdf-coordinates.json';
    a.click();
  };

  const copyCoords = () => {
    const data = { page1: markers[1], page2: markers[2] };
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    alert('הקואורדינטות הועתקו ללוח!');
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-gray-800 p-4 shadow-lg">
        <h1 className="text-2xl font-bold text-orange-500 text-center mb-4">
          כלי קואורדינטות PDF
        </h1>
        <div className="flex flex-wrap gap-4 justify-center items-center">
          <button
            onClick={() => setCurrentPage(1)}
            className={`px-6 py-2 rounded-lg font-medium transition ${
              currentPage === 1 ? 'bg-orange-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            עמוד 1
          </button>
          <button
            onClick={() => setCurrentPage(2)}
            className={`px-6 py-2 rounded-lg font-medium transition ${
              currentPage === 2 ? 'bg-orange-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            עמוד 2
          </button>
          <div className="bg-gray-700 px-4 py-2 rounded-lg font-mono">
            X: <span className="text-orange-400">{coords.x}</span> | Y: <span className="text-orange-400">{coords.y}</span>
          </div>
          <button
            onClick={() => setShowGrid(!showGrid)}
            className="px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition"
          >
            {showGrid ? 'הסתר רשת' : 'הצג רשת'}
          </button>
        </div>
      </div>

      {/* Image Container */}
      <div className="flex justify-center p-4">
        <div
          ref={wrapperRef}
          className="relative cursor-crosshair"
          onMouseMove={handleMouseMove}
        >
          <img
            ref={imgRef}
            src={`/contr/page-000${currentPage}.jpg`}
            alt={`Page ${currentPage}`}
            onClick={handleClick}
            className="max-w-full max-h-[70vh] border-4 border-orange-500 rounded-lg"
          />

          {/* Grid Overlay */}
          {showGrid && (
            <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-30">
              {Array.from({ length: 21 }, (_, i) => (
                <g key={i}>
                  <line x1={`${i * 5}%`} y1="0" x2={`${i * 5}%`} y2="100%" stroke="#f97316" strokeWidth="0.5" />
                  <line x1="0" y1={`${i * 5}%`} x2="100%" y2={`${i * 5}%`} stroke="#f97316" strokeWidth="0.5" />
                </g>
              ))}
            </svg>
          )}

          {/* Markers - positioned as percentage of image */}
          {markers[currentPage].map((marker, index) => {
            // Convert original coords to percentage for display
            const naturalWidth = imgRef.current?.naturalWidth || 1;
            const naturalHeight = imgRef.current?.naturalHeight || 1;
            const leftPercent = (marker.x / naturalWidth) * 100;
            const topPercent = (marker.y / naturalHeight) * 100;
            return (
              <div
                key={index}
                className="absolute w-5 h-5 bg-orange-500 border-2 border-white rounded-full transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                style={{ left: `${leftPercent}%`, top: `${topPercent}%` }}
              >
                <span className="absolute top-6 left-1/2 transform -translate-x-1/2 bg-orange-500 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                  {marker.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Saved Coordinates Table */}
      <div className="mx-4 mb-8 bg-gray-800 rounded-lg p-4">
        <h3 className="text-xl font-bold text-orange-500 mb-4">
          נקודות שנשמרו - עמוד {currentPage}
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-right p-3 text-orange-400">שם השדה</th>
                <th className="text-right p-3 text-orange-400">X</th>
                <th className="text-right p-3 text-orange-400">Y</th>
                <th className="text-right p-3 text-orange-400">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {markers[currentPage].map((marker, index) => (
                <tr key={index} className="border-b border-gray-700">
                  <td className="p-3">
                    <input
                      type="text"
                      value={marker.label}
                      onChange={(e) => updateLabel(index, e.target.value)}
                      className="bg-gray-700 border border-orange-500 text-white px-3 py-1 rounded w-full"
                    />
                  </td>
                  <td className="p-3 font-mono">{marker.x}</td>
                  <td className="p-3 font-mono">{marker.y}</td>
                  <td className="p-3">
                    <button
                      onClick={() => removeMarker(index)}
                      className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded transition"
                    >
                      מחק
                    </button>
                  </td>
                </tr>
              ))}
              {markers[currentPage].length === 0 && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-gray-500">
                    לחץ על התמונה כדי להוסיף נקודות
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex gap-4 mt-4">
          <button
            onClick={exportCoords}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg transition"
          >
            ייצא JSON
          </button>
          <button
            onClick={copyCoords}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition"
          >
            העתק ללוח
          </button>
        </div>
      </div>
    </div>
  );
}
