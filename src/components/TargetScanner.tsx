'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Target, Upload, Ruler, RefreshCw, Plus, Trash2, CheckCircle2, ChevronRight, Zap, Info } from 'lucide-react';
import { ShotPoint, TargetCalibration, TargetAnalysis, TuneRun } from '@/types';
import { CALIBRATION_STANDARDS } from '@/lib/constants';
import { calculateTargetMetrics, euclideanDistance, INCHES_PER_MOA_AT_50YD } from '@/lib/ballistics';

interface TargetScannerProps {
  onSaveRun: (run: Partial<TuneRun>) => void;
  activeTunerClick: number;
}

export const TargetScanner: React.FC<TargetScannerProps> = ({ onSaveRun, activeTunerClick }) => {
  const [selectedCalibration, setSelectedCalibration] = useState<keyof typeof CALIBRATION_STANDARDS>('quarter');
  const [calibrationActive, setCalibrationActive] = useState(false);
  const [calibPointA, setCalibPointA] = useState<{ x: number; y: number } | null>(null);
  const [calibPointB, setCalibPointB] = useState<{ x: number; y: number } | null>(null);
  const [pixelsPerInch, setPixelsPerInch] = useState<number>(140); // default baseline
  
  const [shots, setShots] = useState<ShotPoint[]>([]);
  const [activeShotId, setActiveShotId] = useState<string | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
  const [isDraggingShot, setIsDraggingShot] = useState<string | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [targetType, setTargetType] = useState<'ara' | 'five_shot' | 'custom'>('five_shot');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const loupeCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Initialize a synthetic precision rimfire benchrest target sheet if no user image
  useEffect(() => {
    generateSyntheticBenchrestTarget(targetType);
  }, [targetType]);

  const generateSyntheticBenchrestTarget = (type: 'ara' | 'five_shot' | 'custom') => {
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 600;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Cardstock paper background
    ctx.fillStyle = '#F4F1EA';
    ctx.fillRect(0, 0, 600, 600);

    // Subtle paper grain
    ctx.fillStyle = 'rgba(0,0,0,0.02)';
    for (let i = 0; i < 4000; i++) {
      ctx.fillRect(Math.random() * 600, Math.random() * 600, 2, 2);
    }

    const centerX = 300;
    const centerY = 300;
    const ppi = 140; // 140px = 1 inch
    setPixelsPerInch(ppi);

    if (type === 'ara') {
      // ARA 25-Bull Style Target Bullseye
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 1.5;

      // 50-ring, 100-ring
      const rings = [
        { r: ppi * 0.8, score: '25' },
        { r: ppi * 0.5, score: '50' },
        { r: ppi * 0.25, score: '100' },
      ];

      rings.forEach((ring) => {
        ctx.beginPath();
        ctx.arc(centerX, centerY, ring.r, 0, Math.PI * 2);
        ctx.stroke();
      });

      // Center dot (dot is 0.050")
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(centerX, centerY, 4, 0, Math.PI * 2);
      ctx.fill();

      // Calibration Quarter in bottom corner
      drawCalibrationCoin(ctx, 100, 480, ppi * 0.955);
    } else {
      // 5-Shot Tuning Test Square Target (typical for PSL & Lentz workshop testing)
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 2;

      // 1-inch outer test box
      const boxSize = ppi * 1.0;
      ctx.strokeRect(centerX - boxSize / 2, centerY - boxSize / 2, boxSize, boxSize);

      // Diamond reticle
      ctx.beginPath();
      ctx.moveTo(centerX, centerY - boxSize / 2);
      ctx.lineTo(centerX + boxSize / 2, centerY);
      ctx.lineTo(centerX, centerY + boxSize / 2);
      ctx.lineTo(centerX - boxSize / 2, centerY);
      ctx.closePath();
      ctx.stroke();

      // Center aiming point
      ctx.fillStyle = '#EF4444';
      ctx.fillRect(centerX - 8, centerY - 8, 16, 16);

      // Calibration Quarter in bottom corner
      drawCalibrationCoin(ctx, 100, 480, ppi * 0.955);
    }

    const img = new Image();
    img.src = canvas.toDataURL('image/png');
    img.onload = () => {
      imgRef.current = img;
      setImageLoaded(true);
      // Pre-populate 5 realistic tuned .22 LR shots cutting together
      setShots([
        { id: '1', x: 298, y: 292, isAutoDetected: true },
        { id: '2', x: 304, y: 295, isAutoDetected: true },
        { id: '3', x: 297, y: 306, isAutoDetected: true },
        { id: '4', x: 302, y: 301, isAutoDetected: true },
        { id: '5', x: 300, y: 298, isAutoDetected: true },
      ]);
    };
  };

  const drawCalibrationCoin = (ctx: CanvasRenderingContext2D, x: number, y: number, diameterPx: number) => {
    const radius = diameterPx / 2;
    ctx.save();
    ctx.fillStyle = '#CBD5E1';
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#64748B';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#475569';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('QUARTER', x, y - 6);
    ctx.fillText('0.955"', x, y + 6);
    ctx.restore();
  };

  // Redraw target canvas whenever shots, calibration, or hover changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imgRef.current) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(imgRef.current, 0, 0, canvas.width, canvas.height);

    // Draw .224" bullet holes (0.224 inches * pixelsPerInch)
    const bulletDiameterPx = (0.224 * pixelsPerInch);
    const bulletRadiusPx = bulletDiameterPx / 2;

    shots.forEach((shot, idx) => {
      const isSelected = shot.id === activeShotId || shot.id === isDraggingShot;

      // Bullet Wipe Ring (dark outer graphite/lube ring characteristic of rimfire match bullets)
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.beginPath();
      ctx.arc(shot.x, shot.y, bulletRadiusPx, 0, Math.PI * 2);
      ctx.fill();

      // Paper tear hole inside
      ctx.fillStyle = '#08090C';
      ctx.beginPath();
      ctx.arc(shot.x, shot.y, bulletRadiusPx * 0.85, 0, Math.PI * 2);
      ctx.fill();

      // Precision center crosshair
      ctx.strokeStyle = isSelected ? '#38BDF8' : '#10B981';
      ctx.lineWidth = 1.5;
      const crossSize = 6;
      ctx.beginPath();
      ctx.moveTo(shot.x - crossSize, shot.y);
      ctx.lineTo(shot.x + crossSize, shot.y);
      ctx.moveTo(shot.x, shot.y - crossSize);
      ctx.lineTo(shot.x, shot.y + crossSize);
      ctx.stroke();

      // Number badge
      ctx.fillStyle = isSelected ? '#38BDF8' : '#FFFFFF';
      ctx.font = 'bold 12px monospace';
      ctx.fillText(`${idx + 1}`, shot.x + bulletRadiusPx + 3, shot.y - 3);
    });

    // Extreme spread line & bounding box if >= 2 shots
    if (shots.length >= 2) {
      const metrics = calculateTargetMetrics(shots, pixelsPerInch);
      const xs = shots.map((s) => s.x);
      const ys = shots.map((s) => s.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);

      // Vertical dispersion guide lines (crucial for tuner)
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.45)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(minX - 25, minY);
      ctx.lineTo(maxX + 25, minY);
      ctx.moveTo(minX - 25, maxY);
      ctx.lineTo(maxX + 25, maxY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Vertical bracket
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 2;
      const bracketX = maxX + 25;
      ctx.beginPath();
      ctx.moveTo(bracketX - 6, minY);
      ctx.lineTo(bracketX, minY);
      ctx.lineTo(bracketX, maxY);
      ctx.lineTo(bracketX - 6, maxY);
      ctx.stroke();

      // High contrast label background pill on canvas
      const labelText = `${metrics.verticalSpreadInches}" V`;
      ctx.font = 'bold 13px monospace';
      const textWidth = ctx.measureText(labelText).width;
      const textY = (minY + maxY) / 2;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.fillRect(bracketX + 4, textY - 11, textWidth + 8, 18);
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 1;
      ctx.strokeRect(bracketX + 4, textY - 11, textWidth + 8, 18);

      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(labelText, bracketX + 8, textY + 3);

      // Center of Impact
      ctx.fillStyle = '#38BDF8';
      ctx.beginPath();
      ctx.arc(metrics.centerOfImpact.x, metrics.centerOfImpact.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Calibration measurement line if setting calibration
    if (calibPointA) {
      ctx.fillStyle = '#F59E0B';
      ctx.beginPath();
      ctx.arc(calibPointA.x, calibPointA.y, 5, 0, Math.PI * 2);
      ctx.fill();

      if (calibPointB) {
        ctx.beginPath();
        ctx.arc(calibPointB.x, calibPointB.y, 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(calibPointA.x, calibPointA.y);
        ctx.lineTo(calibPointB.x, calibPointB.y);
        ctx.stroke();
      }
    }
  }, [shots, activeShotId, isDraggingShot, pixelsPerInch, calibPointA, calibPointB, imageLoaded]);

  // Update Apple-style 3x Zoom Loupe Canvas
  useEffect(() => {
    if (!hoverPos || !canvasRef.current || !loupeCanvasRef.current) return;
    const loupeCtx = loupeCanvasRef.current.getContext('2d');
    const mainCtx = canvasRef.current.getContext('2d');
    if (!loupeCtx || !mainCtx) return;

    const loupeSize = 130;
    loupeCtx.clearRect(0, 0, loupeSize, loupeSize);

    // Clip to circle
    loupeCtx.save();
    loupeCtx.beginPath();
    loupeCtx.arc(loupeSize / 2, loupeSize / 2, loupeSize / 2 - 2, 0, Math.PI * 2);
    loupeCtx.clip();

    // Draw magnified main canvas area (3x zoom)
    const zoom = 3.0;
    const sourceW = loupeSize / zoom;
    const sourceH = loupeSize / zoom;
    const sx = hoverPos.x - sourceW / 2;
    const sy = hoverPos.y - sourceH / 2;

    loupeCtx.drawImage(
      canvasRef.current,
      sx,
      sy,
      sourceW,
      sourceH,
      0,
      0,
      loupeSize,
      loupeSize
    );

    // Reticle crosshair
    loupeCtx.strokeStyle = 'rgba(56, 189, 248, 0.8)';
    loupeCtx.lineWidth = 1;
    loupeCtx.beginPath();
    loupeCtx.moveTo(loupeSize / 2 - 15, loupeSize / 2);
    loupeCtx.lineTo(loupeSize / 2 + 15, loupeSize / 2);
    loupeCtx.moveTo(loupeSize / 2, loupeSize / 2 - 15);
    loupeCtx.lineTo(loupeSize / 2, loupeSize / 2 + 15);
    loupeCtx.stroke();

    // 0.224" bullet circumference guide in loupe
    const bulletRadiusInLoupe = (0.224 * pixelsPerInch * zoom) / 2;
    loupeCtx.strokeStyle = 'rgba(16, 185, 129, 0.6)';
    loupeCtx.beginPath();
    loupeCtx.arc(loupeSize / 2, loupeSize / 2, bulletRadiusInLoupe, 0, Math.PI * 2);
    loupeCtx.stroke();

    loupeCtx.restore();

    // Loupe border
    loupeCtx.strokeStyle = '#38BDF8';
    loupeCtx.lineWidth = 2;
    loupeCtx.beginPath();
    loupeCtx.arc(loupeSize / 2, loupeSize / 2, loupeSize / 2 - 2, 0, Math.PI * 2);
    loupeCtx.stroke();
  }, [hoverPos, shots, pixelsPerInch]);

  // Pointer interactions for dragging and pinpoint placing
  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    if (calibrationActive) {
      if (!calibPointA) {
        setCalibPointA({ x, y });
      } else if (!calibPointB) {
        setCalibPointB({ x, y });
        // Calculate new PPI
        const distPx = euclideanDistance(calibPointA, { x, y });
        const refInches = CALIBRATION_STANDARDS[selectedCalibration].diameterInches;
        if (refInches > 0 && distPx > 10) {
          const newPpi = Math.round(distPx / refInches);
          setPixelsPerInch(newPpi);
        }
        setCalibrationActive(false);
      }
      return;
    }

    // Check if clicked an existing shot to drag
    const hitRadius = (0.224 * pixelsPerInch) / 1.5;
    const hitShot = shots.find((s) => euclideanDistance(s, { x, y }) <= Math.max(15, hitRadius));

    if (hitShot) {
      setIsDraggingShot(hitShot.id);
      setActiveShotId(hitShot.id);
    } else {
      // Add new shot point
      if (shots.length < 10) {
        const newShot: ShotPoint = {
          id: Date.now().toString(),
          x,
          y,
        };
        setShots([...shots, newShot]);
        setActiveShotId(newShot.id);
      }
    }
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    setHoverPos({ x, y });

    if (isDraggingShot) {
      setShots((prev) =>
        prev.map((s) => (s.id === isDraggingShot ? { ...s, x, y } : s))
      );
    }
  };

  const handleCanvasPointerUp = () => {
    setIsDraggingShot(null);
  };

  const handleCanvasPointerLeave = () => {
    setHoverPos(null);
    setIsDraggingShot(null);
  };

  // Image file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        imgRef.current = img;
        setImageLoaded(true);
        // Clear shots for user to mark or auto-detect
        setShots([]);
        setCalibPointA(null);
        setCalibPointB(null);
      };
    };
    reader.readAsDataURL(file);
  };

  // Auto-detect holes using Canvas edge & contrast thresholding
  const runAutoDetectHoles = () => {
    if (!canvasRef.current || !imgRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = imgRef.current.naturalWidth || 600;
    canvas.height = imgRef.current.naturalHeight || 600;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(imgRef.current, 0, 0);
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = imgData.data;

    // Scan center 60% for dark circular clusters
    const foundHoles: { x: number; y: number }[] = [];
    const minIntensity = 55; // dark graphite smudge
    const step = 4;

    const startX = Math.floor(canvas.width * 0.2);
    const endX = Math.floor(canvas.width * 0.8);
    const startY = Math.floor(canvas.height * 0.2);
    const endY = Math.floor(canvas.height * 0.8);

    for (let y = startY; y < endY; y += step) {
      for (let x = startX; x < endX; x += step) {
        const i = (y * canvas.width + x) * 4;
        const brightness = (d[i] + d[i + 1] + d[i + 2]) / 3;

        if (brightness < minIntensity) {
          // Check if too close to an already detected hole
          const tooClose = foundHoles.some(
            (h) => euclideanDistance(h, { x, y }) < 18
          );
          if (!tooClose && foundHoles.length < 5) {
            foundHoles.push({ x, y });
          }
        }
      }
    }

    if (foundHoles.length > 0) {
      setShots(
        foundHoles.map((h, i) => ({
          id: `auto-${i}-${Date.now()}`,
          x: h.x,
          y: h.y,
          isAutoDetected: true,
        }))
      );
    }
  };

  const removeShot = (id: string) => {
    setShots(shots.filter((s) => s.id !== id));
    if (activeShotId === id) setActiveShotId(null);
  };

  const clearAllShots = () => {
    setShots([]);
    setActiveShotId(null);
  };

  const metrics = calculateTargetMetrics(shots, pixelsPerInch);

  const handleCommitToTuning = () => {
    onSaveRun({
      tunerClick: activeTunerClick,
      shotCount: shots.length,
      verticalSpreadInches: metrics.verticalSpreadInches,
      horizontalSpreadInches: metrics.horizontalSpreadInches,
      groupSizeInches: metrics.groupSizeInches,
      groupMoa50Yd: metrics.groupMoa50Yd,
      meanRadiusInches: metrics.meanRadiusInches,
      targetAnalysis: metrics,
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

      {/* ── METRICS SIDEBAR ── shows ABOVE canvas on mobile, right side on desktop ── */}
      <div className="order-first lg:order-none lg:col-span-4 flex flex-col gap-4">

        {/* Key Metrics Row — horizontal scroll on mobile to keep above-fold */}
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1 lg:flex-col lg:overflow-visible">

          {/* Core Vertical Dispersion Card (The Tuner Metric) */}
          <div className="bg-[#10131A]/90 border border-white/10 rounded-2xl p-5 backdrop-blur-xl shadow-glass relative overflow-hidden shrink-0 min-w-[200px] lg:min-w-0">
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs uppercase font-mono text-red-300 tracking-wider font-bold">
                Vertical Spread
              </span>
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/30 font-mono">
                Harmonic
              </span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-black font-mono tracking-tight text-white">
                {metrics.verticalSpreadInches}
              </span>
              <span className="text-sm font-mono font-bold text-neutral-300">in</span>
              <span className="text-xl font-black font-mono text-neutral-300 ml-2">
                {(metrics.verticalSpreadInches / INCHES_PER_MOA_AT_50YD).toFixed(2)}
                <span className="text-xs font-mono font-bold text-neutral-400 ml-1">MOA</span>
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-1.5 leading-relaxed font-medium hidden lg:block">
              Muzzle harmonics directly govern vertical launch angle. Sweet spot compresses this to near zero.
            </p>
          </div>

          {/* Secondary metrics 2-up grid (horizontal on mobile inside scroll, 2-col grid on desktop) */}
          <div className="grid grid-cols-2 gap-3 shrink-0 lg:shrink lg:w-full" style={{ minWidth: '220px' }}>
            {/* Group Size */}
            <div className="bg-[#10131A]/90 border border-white/10 rounded-xl p-4">
              <span className="text-xs font-mono font-bold text-neutral-300 uppercase block">Group (ES)</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl font-black font-mono text-white">{metrics.groupSizeInches}</span>
                <span className="text-xs font-mono font-bold text-neutral-400">in</span>
              </div>
              <span className="text-xs font-mono font-bold text-neutral-300 block mt-1">
                {metrics.groupMoa50Yd} MOA
              </span>
            </div>
            {/* Horizontal */}
            <div className="bg-[#10131A]/90 border border-white/10 rounded-xl p-4">
              <span className="text-xs font-mono font-bold text-neutral-300 uppercase block">Horizontal</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl font-black font-mono text-neutral-100">{metrics.horizontalSpreadInches}</span>
                <span className="text-xs font-mono font-bold text-neutral-400">in</span>
              </div>
              <span className="text-xs font-mono font-semibold text-neutral-400 block mt-1">Wind / Cant</span>
            </div>
            {/* Mean Radius */}
            <div className="bg-[#10131A]/90 border border-white/10 rounded-xl p-4">
              <span className="text-xs font-mono font-bold text-neutral-300 uppercase block">Mean Radius</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl font-black font-mono text-neutral-100">{metrics.meanRadiusInches}</span>
                <span className="text-xs font-mono font-bold text-neutral-400">in</span>
              </div>
              <span className="text-xs font-mono font-semibold text-neutral-400 block mt-1">Radial</span>
            </div>
            {/* Ref Standard */}
            <div className="bg-[#10131A]/90 border border-white/10 rounded-xl p-4">
              <span className="text-xs font-mono font-bold text-neutral-300 uppercase block">Ref Scale</span>
              <select
                value={selectedCalibration}
                onChange={(e) => setSelectedCalibration(e.target.value as any)}
                className="mt-1.5 w-full bg-neutral-900 border border-white/15 rounded-lg px-2 py-1.5 text-xs text-sky-300 font-bold focus:outline-none"
              >
                <option value="quarter">Quarter (0.955″)</option>
                <option value="dime">Dime (0.705″)</option>
                <option value="one_inch_square">1.000″ Ruler</option>
                <option value="ara_ring_100">ARA 100 (0.500″)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Commit to Active Tuning Run Button — sticky on mobile */}
        <div className="bg-[#10131A]/90 border border-white/10 rounded-2xl p-5 backdrop-blur-xl flex flex-col gap-3 sticky bottom-4 lg:static shadow-2xl lg:shadow-none">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-neutral-200">Tuner Dial Setting:</span>
            <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/40">
              {activeTunerClick} Clicks
            </span>
          </div>
          <button
            onClick={handleCommitToTuning}
            disabled={shots.length === 0}
            className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm md:text-base shadow-glow-blue flex items-center justify-center gap-2.5 transition-all active:scale-[0.98]"
          >
            <CheckCircle2 className="w-5 h-5" />
            <span>Save Run to Harmonic Session</span>
          </button>
        </div>
      </div>

      {/* ── CANVAS VIEWPORT ── */}
      <div className="order-last lg:order-none lg:col-span-8 bg-[#10131A]/90 border border-white/10 rounded-2xl p-4 backdrop-blur-xl shadow-glass flex flex-col items-center relative">

        {/* Compact Top Control Bar */}
        <div className="w-full flex items-center justify-between gap-2 mb-3 pb-3 border-b border-white/[0.08]">

          {/* Target type toggle */}
          <div className="flex bg-neutral-900 rounded-xl p-1 border border-white/15 text-sm">
            <button
              onClick={() => setTargetType('five_shot')}
              className={`px-4 py-3 rounded-xl transition-all font-bold text-sm ${
                targetType === 'five_shot' ? 'bg-sky-500 text-white shadow-sm' : 'text-neutral-300 hover:text-white'
              }`}
            >
              5-Shot
            </button>
            <button
              onClick={() => setTargetType('ara')}
              className={`px-4 py-3 rounded-xl transition-all font-bold text-sm ${
                targetType === 'ara' ? 'bg-sky-500 text-white shadow-sm' : 'text-neutral-300 hover:text-white'
              }`}
            >
              ARA
            </button>
          </div>

          {/* Action buttons — icon only on mobile, icon+label on sm+ */}
          <div className="flex items-center gap-2">
            {/* Calibrate */}
            <button
              onClick={() => {
                setCalibrationActive(!calibrationActive);
                setCalibPointA(null);
                setCalibPointB(null);
              }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold border transition-colors min-h-[44px] ${
                calibrationActive
                  ? 'bg-amber-500 text-black border-amber-400 font-extrabold shadow-md'
                  : 'bg-neutral-900 text-neutral-200 border-white/15 hover:bg-neutral-800'
              }`}
              title={calibrationActive ? 'Tap 2 Coin Edges' : 'Calibrate Scale'}
            >
              <Ruler className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">{calibrationActive ? 'Tap 2 Edges' : 'Calibrate'}</span>
            </button>

            {/* Auto Detect */}
            <button
              onClick={runAutoDetectHoles}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold bg-sky-500/20 text-sky-300 border border-sky-500/40 hover:bg-sky-500/30 transition-colors min-h-[44px]"
              title="Auto-Find bullet holes"
            >
              <Zap className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Auto-Find</span>
            </button>

            {/* Upload Photo */}
            <label
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-white/15 transition-colors cursor-pointer min-h-[44px]"
              title="Upload target photo"
            >
              <Upload className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Photo</span>
              <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>
        </div>

        {/* Canvas & Magnifier Container */}
        <div className="relative w-full aspect-square max-w-[560px] rounded-xl overflow-hidden border border-white/15 bg-neutral-950 flex items-center justify-center select-none touch-none shadow-inner">
          <canvas
            ref={canvasRef}
            width={600}
            height={600}
            onPointerDown={handleCanvasPointerDown}
            onPointerMove={handleCanvasPointerMove}
            onPointerUp={handleCanvasPointerUp}
            onPointerLeave={handleCanvasPointerLeave}
            className="w-full h-full object-contain cursor-crosshair"
          />

          {/* Apple-style floating 3x zoom loupe */}
          {hoverPos && (
            <div
              className="absolute pointer-events-none rounded-full shadow-2xl overflow-hidden border-2 border-sky-400 z-20 backdrop-blur-sm transition-transform duration-75"
              style={{
                width: 130,
                height: 130,
                left: `${(hoverPos.x / 600) * 100}%`,
                top: `${(hoverPos.y / 600) * 100}%`,
                transform: 'translate(-50%, -125%)',
              }}
            >
              <canvas ref={loupeCanvasRef} width={130} height={130} />
            </div>
          )}

          {/* ── Calibration canvas overlay (change 5) ── */}
          {/* Appears directly on canvas so user's eyes stay on the target */}
          {calibrationActive && (
            <div className="absolute inset-0 z-10 pointer-events-none flex flex-col items-center justify-center gap-3">
              <div className="bg-black/70 backdrop-blur-sm rounded-2xl px-6 py-4 border border-amber-400/60 flex flex-col items-center gap-2 shadow-2xl">
                <Ruler className="w-6 h-6 text-amber-400" />
                <span className="text-amber-300 font-extrabold text-base text-center leading-snug">
                  {!calibPointA
                    ? 'Tap Coin Edge  1 of 2'
                    : 'Tap Coin Edge  2 of 2'}
                </span>
                <span className="text-amber-200/70 font-medium text-xs text-center">
                  {!calibPointA
                    ? 'Touch one edge of your reference coin'
                    : 'Now touch the opposite edge'}
                </span>
                {calibPointA && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
                    <span className="text-xs font-mono text-amber-300 font-bold">Edge 1 locked</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Bottom toolbar */}
        <div className="w-full flex items-center justify-between mt-3 text-sm text-neutral-300 font-medium">
          <div className="flex items-center gap-3">
            <span>
              Shots: <strong className="text-white font-mono font-bold text-base">{shots.length}</strong>/5
            </span>
            <span className="text-neutral-500">•</span>
            <span>
              Scale: <strong className="text-neutral-100 font-mono font-bold">{pixelsPerInch} px/in</strong>
            </span>
          </div>
          <div className="flex items-center gap-2">
            {shots.length > 0 && (
              <button
                onClick={clearAllShots}
                className="text-neutral-400 hover:text-red-400 text-sm font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>
      </div>

    </div>
  );
};

