'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Target, Upload, Ruler, RefreshCw, Plus, Trash2, CheckCircle2, ChevronRight, Zap, Info, Moon, Sun } from 'lucide-react';
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
  const [targetTheme, setTargetTheme] = useState<'dark' | 'paper'>('dark');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const loupeCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Initialize a synthetic precision rimfire benchrest target sheet if no user image
  useEffect(() => {
    generateSyntheticBenchrestTarget(targetType, targetTheme);
  }, [targetType, targetTheme]);

  const generateSyntheticBenchrestTarget = (type: 'ara' | 'five_shot' | 'custom', theme: 'dark' | 'paper' = 'dark') => {
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 600;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const isDark = theme === 'dark';

    if (isDark) {
      // Tactical Dark Target (Precision high-contrast night optic style)
      ctx.fillStyle = '#080A0F';
      ctx.fillRect(0, 0, 600, 600);

      // Fine tactical precision grid
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.07)';
      ctx.lineWidth = 1;
      const gridSize = 20;
      for (let x = 0; x <= 600; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 600);
        ctx.stroke();
      }
      for (let y = 0; y <= 600; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(600, y);
        ctx.stroke();
      }

      // Major grid lines every 1 inch (140px)
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.15)';
      ctx.lineWidth = 1.5;
      for (let x = 20; x < 600; x += 140) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 600);
        ctx.stroke();
      }
      for (let y = 20; y < 600; y += 140) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(600, y);
        ctx.stroke();
      }
    } else {
      // Classic Cardstock paper background
      ctx.fillStyle = '#F4F1EA';
      ctx.fillRect(0, 0, 600, 600);

      // Subtle paper grain
      ctx.fillStyle = 'rgba(0,0,0,0.02)';
      for (let i = 0; i < 4000; i++) {
        ctx.fillRect(Math.random() * 600, Math.random() * 600, 2, 2);
      }
    }

    const centerX = 300;
    const centerY = 300;
    const ppi = 140; // 140px = 1 inch
    setPixelsPerInch(ppi);

    if (type === 'ara') {
      // ARA 25-Bull Style Target Bullseye
      ctx.strokeStyle = isDark ? '#38BDF8' : '#1E293B';
      ctx.lineWidth = isDark ? 2 : 1.5;

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

      // Subtle dashed inner rings in dark mode
      if (isDark) {
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)';
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(centerX, centerY, ppi * 0.125, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Center dot (dot is 0.050")
      ctx.fillStyle = isDark ? '#F59E0B' : '#0F172A';
      ctx.beginPath();
      ctx.arc(centerX, centerY, isDark ? 5 : 4, 0, Math.PI * 2);
      ctx.fill();

      // Calibration Quarter in bottom corner
      drawCalibrationCoin(ctx, 100, 480, ppi * 0.955, isDark);
    } else {
      // 5-Shot Tuning Test Square Target (typical for PSL & Lentz workshop testing)
      ctx.strokeStyle = isDark ? '#38BDF8' : '#0F172A';
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

      if (isDark) {
        // High-contrast orange center aiming point with glow
        ctx.fillStyle = '#FF5500';
        ctx.fillRect(centerX - 8, centerY - 8, 16, 16);
        ctx.strokeStyle = '#FFAA00';
        ctx.lineWidth = 2;
        ctx.strokeRect(centerX - 8, centerY - 8, 16, 16);

        // Center crosshair tick
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(centerX - 12, centerY);
        ctx.lineTo(centerX + 12, centerY);
        ctx.moveTo(centerX, centerY - 12);
        ctx.lineTo(centerX, centerY + 12);
        ctx.stroke();
      } else {
        // Classic red square aiming point
        ctx.fillStyle = '#EF4444';
        ctx.fillRect(centerX - 8, centerY - 8, 16, 16);
      }

      // Calibration Quarter in bottom corner
      drawCalibrationCoin(ctx, 100, 480, ppi * 0.955, isDark);
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

  const drawCalibrationCoin = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    diameterPx: number,
    isDark = false
  ) => {
    const radius = diameterPx / 2;
    ctx.save();
    if (isDark) {
      ctx.fillStyle = '#1A2333';
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#7DD3FC';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('QUARTER', x, y - 6);
      ctx.font = '10px monospace';
      ctx.fillText('0.955"', x, y + 8);
    } else {
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
    }
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
      const isDark = targetTheme === 'dark';

      if (isDark) {
        // High-contrast luminous bullet impact ring
        ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
        ctx.beginPath();
        ctx.arc(shot.x, shot.y, bulletRadiusPx + 2, 0, Math.PI * 2);
        ctx.fill();

        // Dark bullet wipe hole
        ctx.fillStyle = '#030712';
        ctx.beginPath();
        ctx.arc(shot.x, shot.y, bulletRadiusPx, 0, Math.PI * 2);
        ctx.fill();

        // Inner rimfire lead core
        ctx.fillStyle = '#1E293B';
        ctx.beginPath();
        ctx.arc(shot.x, shot.y, bulletRadiusPx * 0.65, 0, Math.PI * 2);
        ctx.fill();

        // Outer precision ring
        ctx.strokeStyle = isSelected ? '#38BDF8' : 'rgba(56, 189, 248, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(shot.x, shot.y, bulletRadiusPx, 0, Math.PI * 2);
        ctx.stroke();
      } else {
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
      }

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
    <div className="flex flex-col gap-5">

      {/* ── TOP CONTROL BAR ── */}
      <div className="flex items-center gap-3 flex-wrap">

        {/* Target type toggle */}
        <div className="flex bg-neutral-900 rounded-2xl p-1 border border-white/10 shadow-inner flex-1 min-w-[160px]">
          <button
            onClick={() => setTargetType('five_shot')}
            className={`flex-1 py-3 rounded-xl font-black text-sm transition-all ${
              targetType === 'five_shot'
                ? 'bg-sky-500 text-white shadow-md'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            5-Shot
          </button>
          <button
            onClick={() => setTargetType('ara')}
            className={`flex-1 py-3 rounded-xl font-black text-sm transition-all ${
              targetType === 'ara'
                ? 'bg-sky-500 text-white shadow-md'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            ARA Bull
          </button>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Calibrate */}
          <button
            onClick={() => {
              setCalibrationActive(!calibrationActive);
              setCalibPointA(null);
              setCalibPointB(null);
            }}
            className={`flex items-center gap-2 px-4 py-3 rounded-2xl font-bold text-sm border transition-all min-h-[48px] ${
              calibrationActive
                ? 'bg-amber-500 text-black border-amber-300 shadow-lg scale-[1.02]'
                : 'bg-neutral-900 text-neutral-200 border-white/10 hover:bg-neutral-800'
            }`}
            title={calibrationActive ? 'Tap 2 Coin Edges' : 'Calibrate Scale'}
          >
            <Ruler className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">{calibrationActive ? 'Tap Edges' : 'Calibrate'}</span>
          </button>

          {/* Auto Detect */}
          <button
            onClick={runAutoDetectHoles}
            className="flex items-center gap-2 px-4 py-3 rounded-2xl text-sm font-bold bg-violet-500/20 text-violet-300 border border-violet-500/40 hover:bg-violet-500/30 transition-all min-h-[48px]"
            title="Auto-detect bullet holes"
          >
            <Zap className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">Auto-Find</span>
          </button>

          {/* Dark / Paper Target Theme Toggle */}
          <button
            onClick={() => setTargetTheme(targetTheme === 'dark' ? 'paper' : 'dark')}
            className={`flex items-center gap-2 px-3.5 py-3 rounded-2xl font-bold text-sm border transition-all min-h-[48px] ${
              targetTheme === 'dark'
                ? 'bg-sky-500/20 text-sky-300 border-sky-500/40 shadow-sm'
                : 'bg-amber-500/20 text-amber-200 border-amber-500/40 shadow-sm'
            }`}
            title={targetTheme === 'dark' ? 'Switch to Classic Paper Target' : 'Switch to Tactical Night Target'}
          >
            {targetTheme === 'dark' ? <Moon className="w-4 h-4 text-sky-400" /> : <Sun className="w-4 h-4 text-amber-400" />}
            <span className="hidden sm:inline font-mono text-xs uppercase font-bold">{targetTheme === 'dark' ? 'Night' : 'Paper'}</span>
          </button>

          {/* Upload Photo */}
          <label
            className="flex items-center gap-2 px-4 py-3 rounded-2xl text-sm font-bold bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-white/10 transition-all cursor-pointer min-h-[48px]"
            title="Upload target photo"
          >
            <Upload className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">Photo</span>
            <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
          </label>
        </div>
      </div>

      {/* ── MAIN CONTENT — canvas left, metrics right on desktop ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

        {/* ── CANVAS VIEWPORT ── */}
        <div className="lg:col-span-7 flex flex-col gap-3">
          <div className="relative w-full aspect-square rounded-2xl overflow-hidden border-2 border-white/10 bg-[#05060A] select-none touch-none shadow-2xl" style={{ boxShadow: '0 0 40px rgba(56,189,248,0.06), inset 0 0 60px rgba(0,0,0,0.6)' }}>

            {/* Crosshair corner accents */}
            <div className="absolute top-3 left-3 w-5 h-5 border-t-2 border-l-2 border-sky-500/60 rounded-tl pointer-events-none z-10" />
            <div className="absolute top-3 right-3 w-5 h-5 border-t-2 border-r-2 border-sky-500/60 rounded-tr pointer-events-none z-10" />
            <div className="absolute bottom-3 left-3 w-5 h-5 border-b-2 border-l-2 border-sky-500/60 rounded-bl pointer-events-none z-10" />
            <div className="absolute bottom-3 right-3 w-5 h-5 border-b-2 border-r-2 border-sky-500/60 rounded-br pointer-events-none z-10" />

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

            {/* Zoom loupe */}
            {hoverPos && (
              <div
                className="absolute pointer-events-none rounded-full shadow-2xl overflow-hidden border-2 border-sky-400 z-20"
                style={{
                  width: 140,
                  height: 140,
                  left: `${(hoverPos.x / 600) * 100}%`,
                  top: `${(hoverPos.y / 600) * 100}%`,
                  transform: 'translate(-50%, -125%)',
                  boxShadow: '0 0 20px rgba(56,189,248,0.4)',
                }}
              >
                <canvas ref={loupeCanvasRef} width={140} height={140} />
                {/* Crosshair overlay on loupe */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-full h-px bg-sky-400/40" />
                </div>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="h-full w-px bg-sky-400/40" />
                </div>
              </div>
            )}

            {/* Calibration overlay */}
            {calibrationActive && (
              <div className="absolute inset-0 z-10 pointer-events-none flex flex-col items-center justify-center">
                <div className="bg-black/80 backdrop-blur-md rounded-2xl px-6 py-5 border-2 border-amber-400/70 flex flex-col items-center gap-2.5 shadow-2xl">
                  <Ruler className="w-7 h-7 text-amber-400" />
                  <span className="text-amber-300 font-black text-lg text-center leading-tight">
                    {!calibPointA ? 'Tap Edge 1 of 2' : 'Tap Edge 2 of 2'}
                  </span>
                  <span className="text-amber-200/80 font-medium text-sm text-center">
                    {!calibPointA ? 'Touch one edge of your reference coin' : 'Now touch the opposite edge'}
                  </span>
                  {calibPointA && (
                    <div className="flex items-center gap-2 mt-1 px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-500/40">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
                      <span className="text-sm font-mono text-amber-300 font-bold">Edge 1 locked</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Canvas status bar */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-4 text-sm font-semibold">
              <span className="text-neutral-400">
                Shots: <strong className="text-white font-mono text-base">{shots.length}</strong>
                <span className="text-neutral-600">/5</span>
              </span>
              <span className="text-neutral-600">•</span>
              <span className="text-neutral-400">
                Scale: <strong className="text-neutral-200 font-mono">{pixelsPerInch} px/in</strong>
              </span>
            </div>
            {shots.length > 0 && (
              <button
                onClick={clearAllShots}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold text-neutral-500 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all min-h-[40px]"
              >
                <Trash2 className="w-4 h-4" />
                Reset
              </button>
            )}
          </div>
        </div>

        {/* ── METRICS SIDEBAR ── */}
        <div className="lg:col-span-5 flex flex-col gap-3">

          {/* VERTICAL SPREAD — hero card, tuner's #1 metric */}
          <div className="rounded-2xl p-5 relative overflow-hidden border border-red-500/30" style={{ background: 'linear-gradient(135deg, #1A0A0A 0%, #12060A 100%)', boxShadow: '0 0 30px rgba(239,68,68,0.08)' }}>
            <div className="absolute top-0 right-0 w-40 h-40 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs uppercase font-mono text-red-400 tracking-widest font-bold">⬆ Vertical Spread</span>
              <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-red-500/20 text-red-300 border border-red-500/30 font-mono">Harmonic</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-black font-mono tracking-tight text-white leading-none">
                {metrics.verticalSpreadInches}
              </span>
              <div className="flex flex-col">
                <span className="text-sm font-mono font-bold text-red-300">in</span>
                <span className="text-sm font-mono font-bold text-neutral-400">{(metrics.verticalSpreadInches / INCHES_PER_MOA_AT_50YD).toFixed(2)} MOA</span>
              </div>
            </div>
            <p className="text-xs text-red-200/50 mt-2 font-medium leading-snug">
              Tuner sweet spot compresses this toward zero
            </p>
          </div>

          {/* Secondary metrics 2-up */}
          <div className="grid grid-cols-2 gap-3">
            {/* Group Size */}
            <div className="rounded-2xl p-4 border border-sky-500/20" style={{ background: 'linear-gradient(135deg, #060E1A 0%, #080D18 100%)' }}>
              <span className="text-xs font-mono font-bold text-sky-400 uppercase tracking-wide block">Group (ES)</span>
              <div className="flex items-baseline gap-1 mt-2">
                <span className="text-3xl font-black font-mono text-white">{metrics.groupSizeInches}</span>
                <span className="text-xs font-mono font-bold text-sky-400">in</span>
              </div>
              <span className="text-sm font-mono font-bold text-sky-300/70 block mt-1">{metrics.groupMoa50Yd} MOA</span>
            </div>

            {/* Horizontal */}
            <div className="rounded-2xl p-4 border border-emerald-500/20" style={{ background: 'linear-gradient(135deg, #060F0A 0%, #080E0C 100%)' }}>
              <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wide block">Horizontal</span>
              <div className="flex items-baseline gap-1 mt-2">
                <span className="text-3xl font-black font-mono text-white">{metrics.horizontalSpreadInches}</span>
                <span className="text-xs font-mono font-bold text-emerald-400">in</span>
              </div>
              <span className="text-sm font-mono font-semibold text-emerald-300/60 block mt-1">Wind / Cant</span>
            </div>

            {/* Mean Radius */}
            <div className="rounded-2xl p-4 border border-violet-500/20" style={{ background: 'linear-gradient(135deg, #0C0816 0%, #0A0714 100%)' }}>
              <span className="text-xs font-mono font-bold text-violet-400 uppercase tracking-wide block">Mean Radius</span>
              <div className="flex items-baseline gap-1 mt-2">
                <span className="text-3xl font-black font-mono text-white">{metrics.meanRadiusInches}</span>
                <span className="text-xs font-mono font-bold text-violet-400">in</span>
              </div>
              <span className="text-sm font-mono font-semibold text-violet-300/60 block mt-1">Radial Avg</span>
            </div>

            {/* Ref Scale selector */}
            <div className="rounded-2xl p-4 border border-amber-500/20" style={{ background: 'linear-gradient(135deg, #120E04 0%, #100C04 100%)' }}>
              <span className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wide block">Ref Scale</span>
              <select
                value={selectedCalibration}
                onChange={(e) => setSelectedCalibration(e.target.value as any)}
                className="mt-2 w-full bg-black/40 border border-amber-500/30 rounded-xl px-2 py-2.5 text-sm text-amber-300 font-bold focus:outline-none focus:border-amber-400"
              >
                <option value="quarter">Quarter 0.955″</option>
                <option value="dime">Dime 0.705″</option>
                <option value="one_inch_square">1.000″ Ruler</option>
                <option value="ara_ring_100">ARA 100 · 0.500″</option>
              </select>
            </div>
          </div>

          {/* Save to Session — big CTA */}
          <div className="rounded-2xl p-4 border border-white/8 bg-[#0D1017]/80 flex flex-col gap-3 mt-auto">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-neutral-300">Current Dial Setting</span>
              <span className="text-sm font-mono font-black px-3 py-1.5 rounded-xl bg-sky-500/20 text-sky-300 border border-sky-500/30">
                {activeTunerClick} Clicks
              </span>
            </div>
            <button
              onClick={handleCommitToTuning}
              disabled={shots.length === 0}
              className="w-full py-4 px-4 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-black text-base shadow-lg flex items-center justify-center gap-2.5 transition-all active:scale-[0.98]"
              style={{ boxShadow: shots.length > 0 ? '0 4px 24px rgba(56,189,248,0.25)' : undefined }}
            >
              <CheckCircle2 className="w-5 h-5" />
              Save Run to Harmonic Log
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

