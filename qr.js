/**
 * Lightweight QR code renderer using qrcode-generator ESM CDN with safe fallback.
 */

let qrLibPromise = null;

async function loadQrLib() {
  if (!qrLibPromise) {
    qrLibPromise = (async () => {
      const urls = [
        'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/+esm',
        'https://esm.sh/qrcode-generator@1.4.4',
      ];
      for (const url of urls) {
        try {
          const mod = await import(url);
          if (mod && typeof mod.default === 'function') return mod.default;
          if (typeof mod === 'function') return mod;
        } catch {
          // Try next CDN
        }
      }
      return null;
    })();
  }
  return qrLibPromise;
}

/**
 * Render a QR code into `container` safely.
 * Returns true if QR rendered, false if fallback text notice was shown.
 */
export async function renderQrCode(container, text) {
  if (!container) return false;
  container.replaceChildren();
  const qrcode = await loadQrLib();
  if (!qrcode) {
    const notice = document.createElement('p');
    notice.className = 'qr-fallback';
    notice.textContent = 'QR renderer unavailable offline — copy the link or SDP token below.';
    container.appendChild(notice);
    return false;
  }

  try {
    const qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    const count = qr.getModuleCount();
    const cell = 4;
    const margin = 12;
    const size = count * cell + margin * 2;

    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
    svg.setAttribute('width', '180');
    svg.setAttribute('height', '180');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Room QR Code');

    const bg = document.createElementNS(svgNS, 'rect');
    bg.setAttribute('width', String(size));
    bg.setAttribute('height', String(size));
    bg.setAttribute('fill', '#ffffff');
    bg.setAttribute('rx', '8');
    svg.appendChild(bg);

    let pathD = '';
    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        if (qr.isDark(r, c)) {
          const x = margin + c * cell;
          const y = margin + r * cell;
          pathD += `M${x},${y}h${cell}v${cell}h-${cell}z`;
        }
      }
    }
    const path = document.createElementNS(svgNS, 'path');
    path.setAttribute('d', pathD);
    path.setAttribute('fill', '#0f172a');
    svg.appendChild(path);

    container.appendChild(svg);
    return true;
  } catch {
    const notice = document.createElement('p');
    notice.className = 'qr-fallback';
    notice.textContent = 'Payload too large for QR — use Copy Token instead.';
    container.appendChild(notice);
    return false;
  }
}
