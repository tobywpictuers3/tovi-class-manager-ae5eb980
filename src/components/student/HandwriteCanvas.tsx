import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export type HandwriteTemplate = "blank" | "lines" | "staff";
export type PenMode = "pen" | "marker" | "eraser";

function formatA4Px(scale = 2) {
  // A4 ratio ~ 1 : 1.414
  // base 900x1273 then scale
  return { w: Math.round(900 * scale), h: Math.round(1273 * scale) };
}

function drawTemplate(ctx: CanvasRenderingContext2D, w: number, h: number, template: HandwriteTemplate) {
  ctx.save();
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);

  // frame
  ctx.strokeStyle = "rgba(0,0,0,0.10)";
  ctx.lineWidth = 2;
  ctx.strokeRect(20, 20, w - 40, h - 40);

  // lines
  ctx.strokeStyle = "rgba(0,0,0,0.12)";
  ctx.lineWidth = 2;

  if (template === "lines") {
    const top = 90;
    const gap = 64;
    for (let y = top; y < h - 90; y += gap) {
      ctx.beginPath();
      ctx.moveTo(50, y);
      ctx.lineTo(w - 50, y);
      ctx.stroke();
    }
  }

  if (template === "staff") {
    const left = 70;
    const right = w - 70;
    const groupTopStart = 90;
    const lineGap = 18;
    const groupGap = 90;

    for (let top = groupTopStart; top < h - 140; top += (lineGap * 4 + groupGap)) {
      for (let i = 0; i < 5; i++) {
        const y = top + i * lineGap;
        ctx.beginPath();
        ctx.moveTo(left, y);
        ctx.lineTo(right, y);
        ctx.stroke();
      }
    }
  }

  ctx.restore();
}

// Minimal PDF generator embedding a JPEG (DCTDecode)
async function canvasToPdfBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  // Convert to JPEG bytes (easier to embed into PDF than PNG)
  const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
  const base64 = dataUrl.split(",")[1] || "";
  const jpgBytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

  // A4 size in points
  const pageW = 595.28;
  const pageH = 841.89;

  // Image size in pixels -> assume 72dpi-ish mapping; scale to fit page
  const imgWpx = canvas.width;
  const imgHpx = canvas.height;

  // Fit to A4 keeping aspect
  const imgAspect = imgWpx / imgHpx;
  const pageAspect = pageW / pageH;

  let drawW = pageW;
  let drawH = pageH;
  if (imgAspect > pageAspect) {
    drawW = pageW;
    drawH = pageW / imgAspect;
  } else {
    drawH = pageH;
    drawW = pageH * imgAspect;
  }

  const x = (pageW - drawW) / 2;
  const y = (pageH - drawH) / 2;

  const objects: string[] = [];
  const offsets: number[] = [];

  const addObj = (s: string) => {
    offsets.push(currentLength());
    objects.push(s);
  };

  const chunks: (string | Uint8Array)[] = [];
  const currentLength = () =>
    chunks.reduce((sum, c) => sum + (typeof c === "string" ? new TextEncoder().encode(c).length : c.length), 0);

  const write = (c: string | Uint8Array) => chunks.push(c);

  // PDF Header
  write("%PDF-1.3\n");

  // 1) Catalog
  addObj("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

  // 2) Pages
  addObj("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");

  // 3) Page
  addObj(
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " +
      pageW.toFixed(2) +
      " " +
      pageH.toFixed(2) +
      "] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n"
  );

  // 4) Image XObject
  addObj(
    `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imgWpx} /Height ${imgHpx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpgBytes.length} >>\nstream\n`
  );
  // stream bytes for object 4 will be written after objects strings; we must close it later
  // We'll handle this by writing objects sequentially.

  // 5) Content stream: draw image
  const content =
    `q\n${drawW.toFixed(2)} 0 0 ${drawH.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm\n/Im0 Do\nQ\n`;
  const contentBytes = new TextEncoder().encode(content);
  addObj(`5 0 obj\n<< /Length ${contentBytes.length} >>\nstream\n${content}endstream\nendobj\n`);

  // Now write objects with special handling for image object 4 (binary stream)
  // Rebuild: header already in chunks, but offsets based on currentLength must match actual write order.
  // We'll do a second pass simpler: construct whole PDF in one go.

  // Second pass (stable offsets)
  const enc = new TextEncoder();
  const parts: (string | Uint8Array)[] = [];
  const objOffsets: number[] = [0];
  const push = (p: string | Uint8Array) => parts.push(p);
  const len = () => parts.reduce((s, p) => s + (typeof p === "string" ? enc.encode(p).length : p.length), 0);

  push("%PDF-1.3\n");

  const writeObj = (objNum: number, contentPart: string | Uint8Array, tail?: string) => {
    objOffsets[objNum] = len();
    if (typeof contentPart === "string") {
      push(contentPart);
    } else {
      push(contentPart);
    }
    if (tail) push(tail);
  };

  // 1
  writeObj(1, "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  // 2
  writeObj(2, "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
  // 3
  writeObj(
    3,
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " +
      pageW.toFixed(2) +
      " " +
      pageH.toFixed(2) +
      "] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n"
  );
  // 4 (image)
  const imgHeader = `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imgWpx} /Height ${imgHpx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpgBytes.length} >>\nstream\n`;
  const imgTail = "\nendstream\nendobj\n";
  objOffsets[4] = len();
  push(imgHeader);
  push(jpgBytes);
  push(imgTail);

  // 5 (content)
  const cHeader = `5 0 obj\n<< /Length ${contentBytes.length} >>\nstream\n`;
  const cTail = "endstream\nendobj\n";
  objOffsets[5] = len();
  push(cHeader);
  push(content);
  push(cTail);

  // xref
  const xrefStart = len();
  const objCount = 6; // 0..5
  let xref = `xref\n0 ${objCount}\n0000000000 65535 f \n`;
  for (let i = 1; i < objCount; i++) {
    const off = objOffsets[i] || 0;
    xref += `${String(off).padStart(10, "0")} 00000 n \n`;
  }
  push(xref);

  // trailer
  push(`trailer\n<< /Size ${objCount} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`);

  const blob = new Blob(parts, { type: "application/pdf" });
  return blob;
}

export default function HandwriteCanvas(props: {
  initialTemplate: HandwriteTemplate;
  initialTitle: string;
  onCancel: () => void;
  onSave: (result: { png: Blob; pdf: Blob }) => Promise<void> | void;
}) {
  const { w, h } = useMemo(() => formatA4Px(2), []);
  const baseRef = useRef<HTMLCanvasElement | null>(null);
  const inkRef = useRef<HTMLCanvasElement | null>(null);

  const [template, setTemplate] = useState<HandwriteTemplate>(props.initialTemplate);
  const [mode, setMode] = useState<PenMode>("pen");
  const [penSize, setPenSize] = useState<number>(6);
  const [zoom, setZoom] = useState<number>(1);

  const [isDrawing, setIsDrawing] = useState(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const c = baseRef.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    drawTemplate(ctx, w, h, template);
  }, [template, w, h]);

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (w / rect.width);
    const y = (e.clientY - rect.top) * (h / rect.height);
    return { x, y };
  };

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDrawing(true);
    last.current = getPos(e);
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const ink = inkRef.current;
    const ctx = ink?.getContext("2d");
    if (!ctx || !last.current) return;

    const p = getPos(e);

    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (mode === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "rgba(0,0,0,1)";
      ctx.lineWidth = penSize * 2;
    } else if (mode === "marker") {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = "rgba(255, 205, 0, 0.35)";
      ctx.lineWidth = penSize * 2.4;
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = "rgba(0,0,0,0.95)";
      ctx.lineWidth = penSize;
    }

    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();

    last.current = p;
  };

  const end = (e: React.PointerEvent<HTMLCanvasElement>) => {
    setIsDrawing(false);
    last.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
  };

  const clearInk = () => {
    const ink = inkRef.current;
    const ctx = ink?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
  };

  const exportMergedCanvas = async (): Promise<HTMLCanvasElement> => {
    const out = document.createElement("canvas");
    out.width = w;
    out.height = h;
    const outCtx = out.getContext("2d");
    if (!outCtx) return out;

    const base = baseRef.current!;
    const ink = inkRef.current!;
    outCtx.drawImage(base, 0, 0);
    outCtx.drawImage(ink, 0, 0);
    return out;
  };

  const save = async () => {
    const merged = await exportMergedCanvas();

    const pngBlob: Blob | null = await new Promise((resolve) =>
      merged.toBlob((b) => resolve(b), "image/png", 1)
    );
    if (!pngBlob) return;

    const pdfBlob = await canvasToPdfBlob(merged);

    await props.onSave({ png: pngBlob, pdf: pdfBlob });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[170px]">
          <Label>תבנית</Label>
          <Select value={template} onValueChange={(v) => setTemplate(v as HandwriteTemplate)}>
            <SelectTrigger>
              <SelectValue placeholder="בחרי תבנית" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="blank">דף ריק</SelectItem>
              <SelectItem value="lines">דף שורות</SelectItem>
              <SelectItem value="staff">דף חמשות</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-[170px]">
          <Label>כלי</Label>
          <Select value={mode} onValueChange={(v) => setMode(v as PenMode)}>
            <SelectTrigger>
              <SelectValue placeholder="בחרי כלי" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pen">עט</SelectItem>
              <SelectItem value="marker">מרקר</SelectItem>
              <SelectItem value="eraser">מחק</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-[200px]">
          <Label>עובי</Label>
          <input
            className="w-full"
            type="range"
            min={2}
            max={18}
            value={penSize}
            onChange={(e) => setPenSize(Number(e.target.value))}
          />
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.1).toFixed(2)))}>-</Button>
          <div className="text-sm w-16 text-center">{Math.round(zoom * 100)}%</div>
          <Button variant="outline" onClick={() => setZoom((z) => Math.min(2.0, +(z + 0.1).toFixed(2)))}>+</Button>
        </div>

        <div className="flex gap-2 ms-auto">
          <Button variant="outline" onClick={clearInk}>ניקוי</Button>
          <Button variant="outline" onClick={props.onCancel}>ביטול</Button>
          <Button onClick={save}>שמירה (PNG + PDF)</Button>
        </div>
      </div>

      <div
        className="relative w-full overflow-auto rounded-lg border"
        style={{ touchAction: "none", background: "rgba(0,0,0,0.02)" }}
      >
        <div style={{ transform: `scale(${zoom})`, transformOrigin: "top right" }}>
          <div className="relative">
            <canvas ref={baseRef} width={w} height={h} style={{ display: "block", width: w / 2, height: h / 2 }} />
            <canvas
              ref={inkRef}
              width={w}
              height={h}
              style={{ position: "absolute", inset: 0, width: w / 2, height: h / 2 }}
              onPointerDown={start}
              onPointerMove={move}
              onPointerUp={end}
              onPointerCancel={end}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
