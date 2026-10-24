function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeColor(color: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : "#b8322a";
}

export function buildSealSvg(text: string, color: string): string {
  const sealText = Array.from(text.replace(/[\s　]+/g, "").slice(0, 8));
  const normalized = sealText.length > 0 ? sealText : ["印"];
  const fill = safeColor(color);
  const fontSize = normalized.length <= 2 ? 30 : normalized.length <= 4 ? 21 : 16;
  const rows = normalized
    .map((character, index) => {
      const y = 50 + (index - (normalized.length - 1) / 2) * (fontSize * 0.92);
      return `<text x="50" y="${y.toFixed(2)}" text-anchor="middle" dominant-baseline="central">${escapeXml(character)}</text>`;
    })
    .join("");

  return `<svg class="esign-seal" viewBox="0 0 100 100" role="img" aria-label="${escapeXml(text)}の印影" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke="${fill}"><circle cx="50" cy="50" r="47" stroke-width="4"/><circle cx="50" cy="50" r="40" stroke-width="1.5"/></g><g fill="${fill}" font-family="sans-serif" font-size="${fontSize}" font-weight="700">${rows}</g></svg>`;
}
