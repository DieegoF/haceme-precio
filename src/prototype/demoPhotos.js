/* Ilustraciones conceptuales propias (SVG) para los productos de ejemplo. Sin fotos de terceros. */
const W = 800, H = 680;
const uri = (body, bg = "#F4E6CF") =>
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<defs>
<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${bg}"/><stop offset="1" stop-color="#E8D3B0"/></linearGradient>
<radialGradient id="sh" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#000" stop-opacity=".28"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
<linearGradient id="wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F3EEE6"/><stop offset="1" stop-color="#E6DDCF"/></linearGradient>
<linearGradient id="scr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2B4C7E"/><stop offset=".55" stop-color="#6E5BA8"/><stop offset="1" stop-color="#E07A5F"/></linearGradient>
<linearGradient id="blue" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2C4A6E"/><stop offset="1" stop-color="#1A2F4A"/></linearGradient>
<linearGradient id="denim" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5B86B5"/><stop offset="1" stop-color="#36597F"/></linearGradient>
<pattern id="weave" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="14" height="14" fill="#8C857B"/><rect width="7" height="14" fill="#958E84"/><rect y="6" width="14" height="2" fill="#7F786F" opacity=".5"/></pattern>
<pattern id="twill" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(-35)"><rect width="10" height="10" fill="none"/><rect width="10" height="3" fill="#fff" opacity=".07"/></pattern>
</defs>
<rect width="${W}" height="${H}" fill="url(#bg)"/>${body}</svg>`);

const shadow = (cx, cy, rx, ry) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#sh)"/>`;

/* ---------- iPhone ---------- */
const phoneFront = uri(`${shadow(400, 640, 190, 22)}
<rect x="270" y="70" width="260" height="540" rx="44" fill="#1B1B1B"/>
<rect x="282" y="82" width="236" height="516" rx="34" fill="url(#scr)"/>
<rect x="352" y="90" width="96" height="22" rx="11" fill="#1B1B1B"/>
<text x="400" y="190" text-anchor="middle" font-family="Inter,Arial" font-size="58" font-weight="300" fill="#fff">9:41</text>
<text x="400" y="222" text-anchor="middle" font-family="Inter,Arial" font-size="16" fill="#fff" opacity=".85">viernes 20 de noviembre</text>
<circle cx="340" cy="540" r="22" fill="#fff" opacity=".25"/><circle cx="460" cy="540" r="22" fill="#fff" opacity=".25"/>
<rect x="360" y="580" width="80" height="5" rx="3" fill="#fff" opacity=".8"/>
<path d="M300 100 L420 100 L300 330 Z" fill="#fff" opacity=".06"/>`);

const phoneBack = uri(`${shadow(400, 640, 190, 22)}
<rect x="270" y="70" width="260" height="540" rx="44" fill="url(#blue)"/>
<rect x="276" y="76" width="248" height="528" rx="40" fill="none" stroke="#3E5F86" stroke-width="3"/>
<rect x="296" y="98" width="118" height="118" rx="30" fill="#24405F" stroke="#3A5A80" stroke-width="2"/>
<circle cx="330" cy="132" r="26" fill="#0E1A29" stroke="#4A6C93" stroke-width="5"/><circle cx="330" cy="132" r="9" fill="#2B4A73"/>
<circle cx="380" cy="182" r="26" fill="#0E1A29" stroke="#4A6C93" stroke-width="5"/><circle cx="380" cy="182" r="9" fill="#2B4A73"/>
<circle cx="388" cy="122" r="7" fill="#F5E6B8"/>
<path d="M300 300 L520 120 L520 200 L300 400 Z" fill="#fff" opacity=".05"/>`);

const phoneBattery = uri(`${shadow(400, 640, 190, 22)}
<rect x="270" y="70" width="260" height="540" rx="44" fill="#1B1B1B"/>
<rect x="282" y="82" width="236" height="516" rx="34" fill="#F2F2F7"/>
<rect x="352" y="90" width="96" height="22" rx="11" fill="#1B1B1B"/>
<text x="304" y="160" font-family="Inter,Arial" font-size="20" font-weight="700" fill="#111">Batería</text>
<rect x="298" y="185" width="204" height="150" rx="14" fill="#fff"/>
<text x="314" y="222" font-family="Inter,Arial" font-size="14" fill="#555">Condición máxima</text>
<text x="314" y="270" font-family="Inter,Arial" font-size="44" font-weight="700" fill="#111">88%</text>
<rect x="314" y="292" width="172" height="12" rx="6" fill="#E5E5EA"/><rect x="314" y="292" width="151" height="12" rx="6" fill="#34C759"/>
<rect x="298" y="352" width="204" height="70" rx="14" fill="#fff"/>
<text x="314" y="385" font-family="Inter,Arial" font-size="14" fill="#555">Carga optimizada</text>
<rect x="452" y="372" width="36" height="22" rx="11" fill="#34C759"/><circle cx="477" cy="383" r="9" fill="#fff"/>`);

const phoneBox = uri(`${shadow(400, 600, 260, 26)}
<path d="M190 300 L400 230 L610 300 L400 370 Z" fill="#FAFAFA" stroke="#E2DED8" stroke-width="2"/>
<path d="M190 300 L400 370 L400 590 L190 520 Z" fill="#EDEAE5"/>
<path d="M610 300 L400 370 L400 590 L610 520 Z" fill="#E2DDD5"/>
<path d="M310 290 L400 262 L490 290 L400 320 Z" fill="none" stroke="#C9C3BA" stroke-width="3"/>
<path d="M600 450 C 700 440, 700 560, 620 560 C 540 560, 560 470, 640 480 C 700 490, 690 590, 600 600" fill="none" stroke="#FFFFFF" stroke-width="9" stroke-linecap="round"/>
<rect x="585" y="590" width="30" height="18" rx="4" fill="#DDD"/>`);

/* ---------- Sillón ---------- */
const sofaScene = (extra = "") => `
<rect width="${W}" height="470" fill="url(#wall)"/><rect y="470" width="${W}" height="210" fill="#C9A97A"/>
<rect y="466" width="${W}" height="8" fill="#B8956A"/>
<rect x="520" y="110" width="150" height="110" fill="#fff" stroke="#B8956A" stroke-width="8"/><path d="M540 200 L585 150 L615 180 L640 160 L655 200 Z" fill="#E07A5F" opacity=".7"/>
<rect x="80" y="330" width="60" height="140" rx="6" fill="#D9C2A0"/><path d="M110 330 C 60 260, 70 200, 110 230 C 140 180, 170 240, 110 330" fill="#5E8C61"/>${extra}`;
const sofaBody = (dx = 0, s = 1) => `<g transform="translate(${dx} 0) scale(${s})">
${shadow(420, 545, 270, 18)}
<rect x="170" y="300" width="500" height="150" rx="26" fill="url(#weave)"/>
<rect x="150" y="380" width="70" height="140" rx="22" fill="url(#weave)"/><rect x="620" y="380" width="70" height="140" rx="22" fill="url(#weave)"/>
<rect x="210" y="420" width="205" height="80" rx="18" fill="url(#weave)" stroke="#7A736A" stroke-width="2"/>
<rect x="425" y="420" width="205" height="80" rx="18" fill="url(#weave)" stroke="#7A736A" stroke-width="2"/>
<rect x="190" y="505" width="460" height="22" rx="8" fill="#7F786F"/>
<path d="M210 527 L198 575 L212 575 L226 527 Z" fill="#B07D4F"/><path d="M630 527 L642 575 L628 575 L614 527 Z" fill="#B07D4F"/></g>`;
const sofaFront = uri(sofaScene(sofaBody()));
const sofaFabric = uri(`<rect width="${W}" height="${H}" fill="url(#weave)"/>
<path d="M0 420 C 200 360, 600 470, 800 400 L800 680 L0 680 Z" fill="#7F786F" opacity=".35"/>
<circle cx="560" cy="250" r="90" fill="#fff" opacity=".07"/>
<rect x="40" y="40" width="250" height="56" rx="28" fill="#fff" opacity=".92"/><text x="165" y="76" text-anchor="middle" font-family="Inter,Arial" font-size="22" font-weight="600" fill="#1B1B1B">Tela antimanchas</text>`, "#8C857B");
const sofaSize = uri(`<rect width="${W}" height="${H}" fill="#FBF5EC"/>
<g fill="none" stroke="#1B1B1B" stroke-width="4" stroke-linejoin="round">
<rect x="170" y="230" width="460" height="140" rx="22"/><rect x="140" y="310" width="70" height="140" rx="20"/><rect x="590" y="310" width="70" height="140" rx="20"/>
<rect x="200" y="350" width="400" height="80" rx="16"/><path d="M200 450 L190 500 M600 450 L610 500"/></g>
<g stroke="#C8102E" stroke-width="3" fill="#C8102E" font-family="Inter,Arial" font-size="28" font-weight="700">
<path d="M140 560 L660 560"/><path d="M140 548 L140 572 M660 548 L660 572"/><text x="400" y="600" text-anchor="middle" stroke="none">180 cm</text>
<path d="M710 230 L710 500"/><path d="M698 230 L722 230 M698 500 L722 500"/><text x="730" y="372" stroke="none" font-size="24">85</text>
<path d="M100 230 L100 500" opacity=".5"/><text x="40" y="372" stroke="none" font-size="24">80</text></g>`, "#FBF5EC");
const sofaLegs = uri(`<rect width="${W}" height="380" fill="url(#weave)"/><rect y="360" width="${W}" height="40" rx="0" fill="#7F786F"/>
<rect y="400" width="${W}" height="280" fill="#C9A97A"/>
${shadow(330, 640, 120, 14)}
<path d="M300 400 L262 630 L312 630 L350 400 Z" fill="#B07D4F"/><path d="M312 400 L285 630 L297 630 L326 400 Z" fill="#C99566" opacity=".7"/>
<path d="M560 400 L590 600 L620 600 L600 400 Z" fill="#B07D4F" opacity=".75"/>
<rect x="430" y="470" width="300" height="56" rx="28" fill="#fff" opacity=".92"/><text x="580" y="506" text-anchor="middle" font-family="Inter,Arial" font-size="22" font-weight="600" fill="#1B1B1B">Madera de paraíso</text>`);

/* ---------- Bici ---------- */
const wheel = (cx, cy) => `<circle cx="${cx}" cy="${cy}" r="120" fill="none" stroke="#1B1B1B" stroke-width="18"/>
<circle cx="${cx}" cy="${cy}" r="104" fill="none" stroke="#555" stroke-width="3"/>
${Array.from({ length: 12 }, (_, i) => { const a = (i * Math.PI) / 6; return `<line x1="${cx}" y1="${cy}" x2="${cx + 104 * Math.cos(a)}" y2="${cy + 104 * Math.sin(a)}" stroke="#9A9A9A" stroke-width="2"/>`; }).join("")}
<circle cx="${cx}" cy="${cy}" r="12" fill="#333"/>`;
const bikeSide = uri(`${shadow(400, 600, 330, 18)}
${wheel(210, 470)}${wheel(590, 470)}
<g stroke-linecap="round" stroke-linejoin="round" fill="none">
<path d="M210 470 L360 470 L300 300 Z" stroke="#1B1B1B" stroke-width="16"/>
<path d="M300 300 L520 290 L360 470" stroke="#1B1B1B" stroke-width="18"/>
<path d="M520 290 L590 470" stroke="#C8102E" stroke-width="14"/>
<path d="M300 300 L285 255" stroke="#1B1B1B" stroke-width="12"/><path d="M250 248 L320 248" stroke="#1B1B1B" stroke-width="16"/>
<path d="M520 290 L510 230 L560 220" stroke="#1B1B1B" stroke-width="12"/><path d="M545 210 L585 228" stroke="#333" stroke-width="10"/>
<path d="M330 380 L400 375" stroke="#C8102E" stroke-width="8"/></g>
<circle cx="360" cy="470" r="30" fill="none" stroke="#777" stroke-width="6"/>`);
const gear = (cx, cy, r, teeth) => {
  let d = "";
  for (let i = 0; i < teeth * 2; i++) { const a = (i * Math.PI) / teeth; const rr = i % 2 ? r : r + 14; d += `${i ? "L" : "M"}${cx + rr * Math.cos(a)} ${cy + rr * Math.sin(a)} `; }
  return `<path d="${d}Z" fill="#2A2A2A"/><circle cx="${cx}" cy="${cy}" r="${r - 30}" fill="none" stroke="#444" stroke-width="10"/><circle cx="${cx}" cy="${cy}" r="22" fill="#666"/>`;
};
const bikeGears = uri(`<rect width="${W}" height="${H}" fill="#DCD6CC"/>${gear(330, 360, 170, 32)}
<path d="M330 190 C 560 180, 700 230, 700 300" fill="none" stroke="#8A8A8A" stroke-width="12" stroke-dasharray="10 6"/>
<path d="M330 530 C 560 540, 700 480, 700 420" fill="none" stroke="#8A8A8A" stroke-width="12" stroke-dasharray="10 6"/>
${gear(690, 360, 60, 12)}
<rect x="440" y="580" width="300" height="56" rx="28" fill="#fff" opacity=".92"/><text x="590" y="616" text-anchor="middle" font-family="Inter,Arial" font-size="22" font-weight="600" fill="#1B1B1B">Transmisión 1×12</text>`, "#DCD6CC");
const bikeBrake = uri(`<rect width="${W}" height="${H}" fill="#E4DED4"/>
<circle cx="380" cy="340" r="210" fill="#C9C9C9" stroke="#9A9A9A" stroke-width="6"/>
${Array.from({ length: 18 }, (_, i) => { const a = (i * Math.PI) / 9; return `<ellipse cx="${380 + 160 * Math.cos(a)}" cy="${340 + 160 * Math.sin(a)}" rx="14" ry="8" transform="rotate(${(i * 20) + 90} ${380 + 160 * Math.cos(a)} ${340 + 160 * Math.sin(a)})" fill="#8E8E8E"/>`; }).join("")}
<circle cx="380" cy="340" r="90" fill="#555"/><circle cx="380" cy="340" r="30" fill="#333"/>
<rect x="470" y="140" width="150" height="110" rx="26" fill="#C8102E"/><rect x="500" y="170" width="90" height="50" rx="12" fill="#1B1B1B"/>
<rect x="460" y="560" width="290" height="56" rx="28" fill="#fff" opacity=".92"/><text x="605" y="596" text-anchor="middle" font-family="Inter,Arial" font-size="22" font-weight="600" fill="#1B1B1B">Frenos hidráulicos</text>`, "#E4DED4");

/* ---------- Campera de jean ---------- */
const jacket = (back = false) => `${shadow(400, 640, 230, 18)}
<path d="M290 120 L360 100 Q400 135 440 100 L510 120 L620 190 L690 470 L620 495 L580 300 L580 600 L220 600 L220 300 L180 495 L110 470 L180 190 Z" fill="url(#denim)"/>
<path d="M290 120 L360 100 Q400 135 440 100 L510 120 L620 190 L690 470 L620 495 L580 300 L580 600 L220 600 L220 300 L180 495 L110 470 L180 190 Z" fill="url(#twill)"/>
<g fill="none" stroke="#E7B66A" stroke-width="3" stroke-dasharray="7 5">
${back
  ? `<path d="M225 250 Q400 300 575 250"/><path d="M300 330 L300 590 M500 330 L500 590"/><path d="M225 560 L575 560"/>`
  : `<path d="M400 125 L400 600"/><path d="M240 250 L360 250 L360 330 L240 330 Z"/><path d="M440 250 L560 250 L560 330 L440 330 Z"/><path d="M225 560 L575 560"/><path d="M240 215 L560 215"/>`}
</g>
${back ? "" : `<path d="M360 100 L330 190 L400 150 L470 190 L440 100 Q400 135 360 100 Z" fill="#4A75A3" stroke="#36597F" stroke-width="3"/>
${[180, 260, 340, 420, 500].map((y) => `<circle cx="412" cy="${y}" r="9" fill="#C9A44C" stroke="#8C6D25" stroke-width="2"/>`).join("")}
<circle cx="300" cy="262" r="7" fill="#C9A44C"/><circle cx="500" cy="262" r="7" fill="#C9A44C"/>`}
${back ? `<rect x="370" y="140" width="60" height="22" rx="4" fill="#C8102E"/><text x="400" y="157" text-anchor="middle" font-family="Inter,Arial" font-size="13" font-weight="700" fill="#fff">M</text>` : ""}`;
const jacketFront = uri(jacket(false));
const jacketBack = uri(jacket(true));

export const DEMO_PHOTOS = {
  p1: [phoneFront, phoneBack, phoneBattery, phoneBox],
  p2: [sofaFront, sofaFabric, sofaSize, sofaLegs],
  p3: [bikeSide, bikeGears, bikeBrake],
  p4: [jacketFront, jacketBack],
};

/* ---------- Ropa (tienda Aura): ilustraciones con color por variante ---------- */
const COLORS = { Negro: "#232323", Blanco: "#F4F1EC", Gris: "#9A9A9A", Rosa: "#E8B4B8", Azul: "#4E77A6", Natural: "#E9DCC6", Verde: "#7E8F6A" };
const shade = (hex, k) => {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(c * k)));
  return "#" + [f(n >> 16), f((n >> 8) & 255), f(n & 255)].map((x) => x.toString(16).padStart(2, "0")).join("");
};
const studio = (body, bg = "#EFE6DA") => uri(`<rect width="${W}" height="${H}" fill="${bg}"/><rect y="560" width="${W}" height="120" fill="${shade(bg.length === 7 ? bg : "#EFE6DA", 0.94)}"/>${shadow(400, 600, 230, 16)}${body}`, bg);
const tee = (c, back) => { const col = COLORS[c] || c; return studio(`
<path d="M250 130 L340 105 Q400 150 460 105 L550 130 L660 210 L605 290 L555 255 L555 580 L245 580 L245 255 L195 290 L140 210 Z" fill="${col}" stroke="${shade(col, 0.85)}" stroke-width="3"/>
${back ? `<path d="M340 108 Q400 125 460 108" fill="none" stroke="${shade(col, 0.75)}" stroke-width="5"/>` : `<path d="M340 105 Q400 165 460 105" fill="none" stroke="${shade(col, 0.7)}" stroke-width="7"/>`}
<path d="M245 560 L555 560" stroke="${shade(col, 0.8)}" stroke-width="3" stroke-dasharray="6 5"/>
${back ? "" : `<text x="400" y="330" text-anchor="middle" font-family="Archivo,Arial" font-weight="900" font-size="38" fill="${c === "Negro" ? "#F4F1EC" : "#232323"}" opacity=".9">aura</text>`}`); };
const jeans = (back) => studio(`
<path d="M260 90 L540 90 L560 590 L430 590 L400 260 L370 590 L240 590 Z" fill="url(#denim)"/>
<path d="M260 90 L540 90 L560 590 L430 590 L400 260 L370 590 L240 590 Z" fill="url(#twill)"/>
<rect x="258" y="90" width="284" height="34" fill="#4A75A3" stroke="#36597F" stroke-width="2"/>
<g fill="none" stroke="#E7B66A" stroke-width="3" stroke-dasharray="7 5">
${back ? `<path d="M285 160 L360 160 L355 235 L320 250 L290 235 Z"/><path d="M440 160 L515 160 L510 235 L478 250 L445 235 Z"/>` : `<path d="M270 125 Q320 185 360 130"/><path d="M530 125 Q480 185 440 130"/><path d="M400 124 L400 255"/>`}
</g>${back ? "" : `<circle cx="400" cy="107" r="8" fill="#C9A44C"/>`}`);
const hoodie = (c, back) => { const col = COLORS[c] || c; return studio(`
<path d="M255 150 Q300 90 400 85 Q500 90 545 150 L655 250 L610 470 L560 450 L560 590 L240 590 L240 450 L190 470 L145 250 Z" fill="${col}" stroke="${shade(col, 0.85)}" stroke-width="3"/>
${back ? `<path d="M320 95 Q400 40 480 95 Q470 170 400 180 Q330 170 320 95 Z" fill="${shade(col, 0.9)}"/>` : `<path d="M330 110 Q400 200 470 110" fill="${shade(col, 0.8)}"/><path d="M385 175 L380 260 M415 175 L420 260" stroke="#fff" stroke-width="4"/>
<path d="M300 420 L500 420 L520 520 L280 520 Z" fill="${shade(col, 0.9)}" stroke="${shade(col, 0.8)}" stroke-width="2"/>`}
<rect x="240" y="560" width="320" height="30" fill="${shade(col, 0.88)}"/>`); };
const dress = (back) => studio(`
<path d="M330 90 L360 90 Q400 130 440 90 L470 90 L500 250 Q590 420 640 590 L160 590 Q210 420 300 250 Z" fill="${COLORS.Natural}" stroke="#CDBB9C" stroke-width="3"/>
<path d="M300 250 Q400 280 500 250" fill="none" stroke="#B9A47F" stroke-width="5"/>
${back ? `<path d="M400 100 L400 250" stroke="#B9A47F" stroke-width="3" stroke-dasharray="6 6"/>` : `<path d="M345 92 L330 40 M455 92 L470 40" stroke="#CDBB9C" stroke-width="8"/>`}
<path d="M220 520 Q400 560 580 520" fill="none" stroke="#CDBB9C" stroke-width="3" stroke-dasharray="8 6"/>`);

export const STORE_PHOTOS = {
  a1: { Negro: [tee("Negro"), tee("Negro", true)], Blanco: [tee("Blanco"), tee("Blanco", true)] },
  a2: { Azul: [jeans(false), jeans(true)] },
  a3: { Gris: [hoodie("Gris"), hoodie("Gris", true)], Rosa: [hoodie("Rosa"), hoodie("Rosa", true)] },
  a4: { Natural: [dress(false), dress(true)] },
};
export const COLOR_HEX = COLORS;

/* --- Marca de ejemplo de la tienda Aura: logo cuadrado y portada 3:1 --- */
const svgUri = (s) => "data:image/svg+xml;charset=utf-8," + encodeURIComponent(s);
export const AURA_BRAND = {
  logo: svgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><rect width="400" height="400" fill="#2B2420"/><circle cx="200" cy="200" r="150" fill="none" stroke="#E9C9A8" stroke-width="6"/><text x="200" y="225" text-anchor="middle" font-family="Archivo,Arial" font-weight="900" font-size="96" fill="#F4ECE3">aura</text><text x="200" y="275" text-anchor="middle" font-family="Inter,Arial" font-size="22" letter-spacing="6" fill="#E9C9A8">PALERMO</text></svg>`),
  banner: svgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#E9C9A8"/><stop offset="1" stop-color="#B5654A"/></linearGradient></defs><rect width="1200" height="400" fill="url(#g)"/><circle cx="980" cy="60" r="220" fill="#F4ECE3" opacity=".25"/><circle cx="160" cy="420" r="260" fill="#2B2420" opacity=".12"/><path d="M640 400 Q760 220 900 260 T1200 180 L1200 400 Z" fill="#2B2420" opacity=".18"/><g fill="none" stroke="#F4ECE3" stroke-width="3" opacity=".6" transform="translate(-560 20)"><path d="M720 120 l40 -20 q30 30 60 0 l40 20 l30 50 l-30 15 v110 h-140 v-110 l-30 -15 z"/><path d="M920 140 h90 l10 150 h-40 l-10 -100 l-10 100 h-40 z"/></g><text x="1140" y="170" text-anchor="end" font-family="Archivo,Arial" font-weight="900" font-size="64" fill="#2B2420">Nueva temporada</text><text x="1140" y="220" text-anchor="end" font-family="Inter,Arial" font-size="28" fill="#2B2420" opacity=".85">Lino, algodón y jeans de tiro alto</text></svg>`),
  color: "#B5654A",
};
