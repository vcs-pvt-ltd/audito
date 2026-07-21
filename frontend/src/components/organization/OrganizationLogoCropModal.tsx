"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Move, ZoomIn } from "lucide-react";
import { Button, Modal } from "@/components/ui";
import {
  ORGANIZATION_LOGO_CROPS,
  prepareOrganizationLogo,
  type OrganizationLogoCrop,
} from "@/lib/organizationLogo";

type Point = { x: number; y: number };

interface OrganizationLogoCropModalProps {
  open: boolean;
  file: File | null;
  initialCrop?: OrganizationLogoCrop;
  onClose: () => void;
  onApply: (logo: string, crop: OrganizationLogoCrop) => void;
  onError: (message: string) => void;
}

const VIEWPORT_WIDTH = 600;

export default function OrganizationLogoCropModal({
  open,
  file,
  initialCrop = "wide",
  onClose,
  onApply,
  onError,
}: OrganizationLogoCropModalProps) {
  const [previewUrl, setPreviewUrl] = useState("");
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [crop, setCrop] = useState<OrganizationLogoCrop>(initialCrop);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const [applying, setApplying] = useState(false);
  const dragRef = useRef<{ x: number; y: number; offset: Point } | null>(null);
  const onErrorRef = useRef(onError);

  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  useEffect(() => {
    if (!file) {
      setPreviewUrl("");
      setDimensions({ width: 0, height: 0 });
      return;
    }
    setPreviewUrl("");
    setDimensions({ width: 0, height: 0 });
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      setDimensions({ width: image.naturalWidth, height: image.naturalHeight });
      const ratio = ORGANIZATION_LOGO_CROPS[initialCrop].ratio;
      const height = VIEWPORT_WIDTH / ratio;
      const scale = Math.max(VIEWPORT_WIDTH / image.naturalWidth, height / image.naturalHeight);
      setOffset({
        x: Math.min(0, (VIEWPORT_WIDTH - image.naturalWidth * scale) / 2),
        y: Math.min(0, (height - image.naturalHeight * scale) / 2),
      });
    };
    image.onerror = () => onErrorRef.current("Unable to read the selected organization logo.");
    image.src = objectUrl;
    setPreviewUrl(objectUrl);
    setCrop(initialCrop);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    return () => URL.revokeObjectURL(objectUrl);
  }, [file, initialCrop]);

  const metrics = useMemo(() => {
    const ratio = ORGANIZATION_LOGO_CROPS[crop].ratio;
    const height = VIEWPORT_WIDTH / ratio;
    if (!dimensions.width || !dimensions.height) return null;
    const baseScale = Math.max(VIEWPORT_WIDTH / dimensions.width, height / dimensions.height);
    const scale = baseScale * zoom;
    return {
      ratio,
      height,
      scale,
      imageWidth: dimensions.width * scale,
      imageHeight: dimensions.height * scale,
    };
  }, [crop, dimensions, zoom]);

  const constrainOffset = (candidate: Point, currentZoom = zoom): Point => {
    const ratio = ORGANIZATION_LOGO_CROPS[crop].ratio;
    const height = VIEWPORT_WIDTH / ratio;
    if (!dimensions.width || !dimensions.height) return candidate;
    const scale = Math.max(VIEWPORT_WIDTH / dimensions.width, height / dimensions.height) * currentZoom;
    const imageWidth = dimensions.width * scale;
    const imageHeight = dimensions.height * scale;
    return {
      x: Math.min(0, Math.max(VIEWPORT_WIDTH - imageWidth, candidate.x)),
      y: Math.min(0, Math.max(height - imageHeight, candidate.y)),
    };
  };

  const displayedOffset = constrainOffset(offset);

  const changeCrop = (nextCrop: OrganizationLogoCrop) => {
    setCrop(nextCrop);
    setZoom(1);
    if (!dimensions.width || !dimensions.height) {
      setOffset({ x: 0, y: 0 });
      return;
    }
    const ratio = ORGANIZATION_LOGO_CROPS[nextCrop].ratio;
    const height = VIEWPORT_WIDTH / ratio;
    const scale = Math.max(VIEWPORT_WIDTH / dimensions.width, height / dimensions.height);
    setOffset({
      x: Math.min(0, (VIEWPORT_WIDTH - dimensions.width * scale) / 2),
      y: Math.min(0, (height - dimensions.height * scale) / 2),
    });
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { x: event.clientX, y: event.clientY, offset: displayedOffset };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current || !metrics) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const dx = ((event.clientX - dragRef.current.x) / rect.width) * VIEWPORT_WIDTH;
    const dy = ((event.clientY - dragRef.current.y) / rect.height) * metrics.height;
    setOffset(constrainOffset({ x: dragRef.current.offset.x + dx, y: dragRef.current.offset.y + dy }));
  };

  const finishDrag = () => { dragRef.current = null; };

  const handleApply = async () => {
    if (!file || !metrics) return;
    setApplying(true);
    try {
      const cropArea = {
        x: -displayedOffset.x / metrics.scale,
        y: -displayedOffset.y / metrics.scale,
        width: VIEWPORT_WIDTH / metrics.scale,
        height: metrics.height / metrics.scale,
      };
      onApply(await prepareOrganizationLogo(file, crop, cropArea), crop);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Unable to prepare the organization logo.");
    } finally {
      setApplying(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Crop organization logo"
      description="Drag to reposition the image, then use zoom to frame it for your report header."
      footer={<><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="button" loading={applying} disabled={!metrics} onClick={handleApply}>Apply logo</Button></>}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {(Object.entries(ORGANIZATION_LOGO_CROPS) as [OrganizationLogoCrop, { label: string }][]).map(([optionCrop, option]) => (
            <button key={optionCrop} type="button" onClick={() => changeCrop(optionCrop)} className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${crop === optionCrop ? "border-secondary-400/40 bg-secondary-500/15 text-secondary-300" : "border-white/10 bg-white/[0.03] text-gray-400 hover:text-gray-200"}`}>
              {option.label}{optionCrop === "wide" ? " (3:1)" : " (1:1)"}
            </button>
          ))}
        </div>

        <div
          className="relative mx-auto w-full max-w-[600px] touch-none select-none overflow-hidden rounded-xl border border-white/15 bg-black/50 shadow-inner cursor-move"
          style={{ aspectRatio: `${ORGANIZATION_LOGO_CROPS[crop].ratio}` }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishDrag}
          onPointerCancel={finishDrag}
        >
          {metrics && previewUrl ? (
            <img
              src={previewUrl}
              alt="Crop preview"
              draggable={false}
              className="pointer-events-none absolute max-w-none select-none"
              style={{
                width: `${(metrics.imageWidth / VIEWPORT_WIDTH) * 100}%`,
                height: `${(metrics.imageHeight / metrics.height) * 100}%`,
                left: `${(displayedOffset.x / VIEWPORT_WIDTH) * 100}%`,
                top: `${(displayedOffset.y / metrics.height) * 100}%`,
              }}
            />
          ) : <div className="flex h-full items-center justify-center text-sm text-gray-500">Preparing image…</div>}
          <div className="pointer-events-none absolute inset-0 border-[3px] border-secondary-300/70" />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,transparent_33%,rgba(255,255,255,.16)_33%,rgba(255,255,255,.16)_33.4%,transparent_33.4%,transparent_66.6%,rgba(255,255,255,.16)_66.6%,rgba(255,255,255,.16)_67%,transparent_67%)]" />
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-black/10 p-3.5">
          <div className="mb-2 flex items-center justify-between text-xs text-gray-400"><span className="inline-flex items-center gap-1.5"><ZoomIn size={14} /> Zoom</span><span>{Math.round(zoom * 100)}%</span></div>
          <input type="range" min="1" max="3" step="0.01" value={zoom} onChange={(event) => {
            const nextZoom = Number(event.target.value);
            setZoom(nextZoom);
            setOffset((current) => constrainOffset(current, nextZoom));
          }} className="w-full accent-secondary-400" />
        </div>
        <p className="flex items-center gap-1.5 text-xs text-gray-500"><Move size={13} /> Drag the logo within the frame. It is optimized below the upload limit when applied.</p>
      </div>
    </Modal>
  );
}
