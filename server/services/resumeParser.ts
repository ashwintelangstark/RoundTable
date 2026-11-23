function ensurePdfJsGlobals() {
  const g = globalThis as Record<string, unknown>;

  if (typeof g["DOMMatrix"] === "undefined") {
    class MinimalDOMMatrix {
      public a = 1;
      public b = 0;
      public c = 0;
      public d = 1;
      public e = 0;
      public f = 0;

      constructor(
        init?:
          | number[]
          | string
          | { a?: number; b?: number; c?: number; d?: number; e?: number; f?: number },
      ) {
        if (Array.isArray(init)) {
          if (init.length >= 6) {
            this.a = init[0] ?? 1;
            this.b = init[1] ?? 0;
            this.c = init[2] ?? 0;
            this.d = init[3] ?? 1;
            this.e = init[4] ?? 0;
            this.f = init[5] ?? 0;
          }
        } else if (init && typeof init === "object") {
          this.a = init.a ?? 1;
          this.b = init.b ?? 0;
          this.c = init.c ?? 0;
          this.d = init.d ?? 1;
          this.e = init.e ?? 0;
          this.f = init.f ?? 0;
        }
      }

      public get m11() {
        return this.a;
      }
      public get m12() {
        return this.b;
      }
      public get m21() {
        return this.c;
      }
      public get m22() {
        return this.d;
      }
      public get m41() {
        return this.e;
      }
      public get m42() {
        return this.f;
      }

      public multiply(other: MinimalDOMMatrix): MinimalDOMMatrix {
        return new MinimalDOMMatrix([
          this.a * other.a + this.c * other.b,
          this.b * other.a + this.d * other.b,
          this.a * other.c + this.c * other.d,
          this.b * other.c + this.d * other.d,
          this.a * other.e + this.c * other.f + this.e,
          this.b * other.e + this.d * other.f + this.f,
        ]);
      }

      public multiplySelf(other: MinimalDOMMatrix): this {
        const res = this.multiply(other);
        this.a = res.a;
        this.b = res.b;
        this.c = res.c;
        this.d = res.d;
        this.e = res.e;
        this.f = res.f;
        return this;
      }

      public preMultiplySelf(other: MinimalDOMMatrix): this {
        const res = new MinimalDOMMatrix(other).multiply(this);
        this.a = res.a;
        this.b = res.b;
        this.c = res.c;
        this.d = res.d;
        this.e = res.e;
        this.f = res.f;
        return this;
      }

      public translate(tx = 0, ty = 0): MinimalDOMMatrix {
        return this.multiply(new MinimalDOMMatrix([1, 0, 0, 1, tx, ty]));
      }

      public translateSelf(tx = 0, ty = 0): this {
        return this.multiplySelf(new MinimalDOMMatrix([1, 0, 0, 1, tx, ty]));
      }

      public scale(sx = 1, sy = sx): MinimalDOMMatrix {
        return this.multiply(new MinimalDOMMatrix([sx, 0, 0, sy, 0, 0]));
      }

      public scaleSelf(sx = 1, sy = sx): this {
        return this.multiplySelf(new MinimalDOMMatrix([sx, 0, 0, sy, 0, 0]));
      }

      public invertSelf(): this {
        const det = this.a * this.d - this.b * this.c;
        if (!det) {
          this.a = NaN;
          this.b = NaN;
          this.c = NaN;
          this.d = NaN;
          this.e = NaN;
          this.f = NaN;
          return this;
        }
        const a = this.d / det;
        const b = -this.b / det;
        const c = -this.c / det;
        const d = this.a / det;
        const e = (this.c * this.f - this.d * this.e) / det;
        const f = (this.b * this.e - this.a * this.f) / det;
        this.a = a;
        this.b = b;
        this.c = c;
        this.d = d;
        this.e = e;
        this.f = f;
        return this;
      }

      public inverse(): MinimalDOMMatrix {
        return new MinimalDOMMatrix(this).invertSelf();
      }

      public transformPoint(point: { x?: number; y?: number; z?: number; w?: number } = {}) {
        const x = point.x ?? 0;
        const y = point.y ?? 0;
        return {
          x: this.a * x + this.c * y + this.e,
          y: this.b * x + this.d * y + this.f,
          z: point.z ?? 0,
          w: point.w ?? 1,
        };
      }
    }

    g["DOMMatrix"] = MinimalDOMMatrix;
  }

  if (typeof g["ImageData"] === "undefined") {
    g["ImageData"] = class MinimalImageData {
      public data: Uint8ClampedArray;
      public width: number;
      public height: number;
      constructor(widthOrData: number | Uint8ClampedArray, widthOrHeight: number, height?: number) {
        if (typeof widthOrData === "number") {
          this.width = widthOrData;
          this.height = widthOrHeight;
          this.data = new Uint8ClampedArray(widthOrData * widthOrHeight * 4);
        } else {
          this.data = widthOrData;
          this.width = widthOrHeight;
          this.height = height ?? Math.floor(widthOrData.length / (4 * Math.max(1, widthOrHeight)));
        }
      }
    };
  }

  if (typeof g["Path2D"] === "undefined") {
    g["Path2D"] = class MinimalPath2D {
      public addPath() {}
      public closePath() {}
      public moveTo() {}
      public lineTo() {}
      public bezierCurveTo() {}
      public quadraticCurveTo() {}
      public arc() {}
      public arcTo() {}
      public ellipse() {}
      public rect() {}
    };
  }
}

export async function extractResumeText(
  buffer: Buffer,
  filename: string,
  mimetype = "",
): Promise<string> {
  const lower = filename.toLowerCase();

  if (lower.endsWith(".pdf") || mimetype.includes("pdf")) {
    ensurePdfJsGlobals();
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      const result = await parser.getText();
      return (result.text ?? "").replace(/\s+\n/g, "\n").trim();
    } finally {
      await parser.destroy().catch(() => {});
    }
  }

  if (lower.endsWith(".docx") || mimetype.includes("wordprocessingml")) {
    const mammothMod = await import("mammoth");
    const mammoth = mammothMod.default ?? mammothMod;
    const result = await mammoth.extractRawText({ buffer });
    return (result.value ?? "").trim();
  }

  // Fallback for .txt, .md, or plain text buffers
  return buffer.toString("utf8").replaceAll("\0", "").trim();
}
