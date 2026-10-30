"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HATS = exports.COLORS = exports.SPECIES = void 0;
exports.isSpecies = isSpecies;
exports.petSvg = petSvg;
exports.SPECIES = {
    cat: { label: ["Kočka", "Mačka", "Cat"], base: "#f5a65b" },
    dog: { label: ["Pes", "Pes", "Dog"], base: "#c99a6b" },
    frog: { label: ["Žába", "Žaba", "Frog"], base: "#6fcf6f" },
    dragon: { label: ["Drak", "Drak", "Dragon"], base: "#9b6bff" },
    bunny: { label: ["Králík", "Králik", "Bunny"], base: "#e9e4f2" },
};
exports.COLORS = {
    base: { label: ["Původní", "Pôvodná", "Original"], hex: null },
    sunset: { label: ["Západ slunce", "Západ slnka", "Sunset"], hex: "#ff7a8a" },
    mint: { label: ["Máta", "Mäta", "Mint"], hex: "#6fe3c1" },
    midnight: { label: ["Půlnoc", "Polnoc", "Midnight"], hex: "#6a78e8" },
    gold: { label: ["Zlatá", "Zlatá", "Gold"], hex: "#f2c76b" },
};
exports.HATS = {
    party: { label: ["Párty čepice", "Párty čiapka", "Party hat"] },
    crown: { label: ["Koruna", "Koruna", "Crown"] },
    headphones: { label: ["Sluchátka", "Slúchadlá", "Headphones"] },
    shades: { label: ["Brýle", "Okuliare", "Shades"] },
};
function isSpecies(s) {
    return typeof s === "string" && s in exports.SPECIES;
}
function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const f = (c) => Math.max(0, Math.min(255, Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt)));
    const r = f((n >> 16) & 255), g = f((n >> 8) & 255), b = f(n & 255);
    return "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");
}
function petSvg(o) {
    var _a, _b, _c;
    const sp = o.species;
    const mood = (_a = o.mood) !== null && _a !== void 0 ? _a : "happy";
    const main = (o.color && ((_b = exports.COLORS[o.color]) === null || _b === void 0 ? void 0 : _b.hex)) || exports.SPECIES[sp].base;
    const dark = shade(main, -0.25);
    const light = shade(main, 0.4);
    const ink = "#2a1a33";
    const size = (_c = o.size) !== null && _c !== void 0 ? _c : 120;
    const anim = o.animate !== false && mood !== "sleeping";
    const back = sp === "cat"
        ? `<path d="M92 92 Q116 84 108 60" stroke="${main}" stroke-width="9" fill="none" stroke-linecap="round"/><polygon points="33,42 36,14 56,30" fill="${main}"/><polygon points="87,42 84,14 64,30" fill="${main}"/><polygon points="38,34 39,22 49,30" fill="#ffb3c7"/><polygon points="82,34 81,22 71,30" fill="#ffb3c7"/>`
        : sp === "dog"
            ? `<ellipse cx="32" cy="50" rx="10" ry="20" fill="${dark}" transform="rotate(12 32 50)"/><ellipse cx="88" cy="50" rx="10" ry="20" fill="${dark}" transform="rotate(-12 88 50)"/><path d="M92 92 Q110 84 106 70" stroke="${dark}" stroke-width="8" fill="none" stroke-linecap="round"/>`
            : sp === "bunny"
                ? `<ellipse cx="46" cy="16" rx="8" ry="22" fill="${main}"/><ellipse cx="74" cy="16" rx="8" ry="22" fill="${main}"/><ellipse cx="46" cy="18" rx="4" ry="15" fill="#ffb3c7"/><ellipse cx="74" cy="18" rx="4" ry="15" fill="#ffb3c7"/><circle cx="96" cy="94" r="8" fill="#fff"/>`
                : sp === "dragon"
                    ? `<path d="M30 74 Q4 56 12 90 Q24 84 34 90Z" fill="${dark}"/><path d="M90 74 Q116 56 108 90 Q96 84 86 90Z" fill="${dark}"/><path d="M92 96 Q116 100 112 78 L104 86Z" fill="${main}"/><polygon points="106,76 116,70 112,84" fill="${dark}"/><polygon points="42,34 38,14 52,28" fill="${light}"/><polygon points="78,34 82,14 68,28" fill="${light}"/>`
                    : `<ellipse cx="60" cy="86" rx="40" ry="12" fill="${dark}"/>`;
    const body = sp === "frog"
        ? `<ellipse cx="60" cy="80" rx="34" ry="28" fill="${main}"/><ellipse cx="60" cy="86" rx="22" ry="18" fill="${light}"/><ellipse cx="60" cy="56" rx="36" ry="26" fill="${main}"/>`
        : `<ellipse cx="60" cy="82" rx="32" ry="28" fill="${main}"/><ellipse cx="60" cy="88" rx="19" ry="17" fill="${light}"/><circle cx="60" cy="54" r="29" fill="${main}"/>`;
    const eyeY = sp === "frog" ? 38 : 52;
    const eyeX = sp === "frog" ? [42, 78] : [48, 72];
    let eyes = "";
    if (sp === "frog")
        eyes += `<circle cx="42" cy="36" r="12" fill="${main}"/><circle cx="78" cy="36" r="12" fill="${main}"/><circle cx="42" cy="36" r="9" fill="#fff"/><circle cx="78" cy="36" r="9" fill="#fff"/>`;
    for (const x of eyeX) {
        if (mood === "sleeping")
            eyes += `<path d="M${x - 5} ${eyeY} Q${x} ${eyeY + 4} ${x + 5} ${eyeY}" stroke="${ink}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
        else
            eyes += `<g class="${anim ? "ph-blink" : ""}"><ellipse cx="${x}" cy="${eyeY}" rx="${sp === "frog" ? 5 : 4.6}" ry="${sp === "frog" ? 5 : 5.4}" fill="${ink}"/><circle cx="${x + 1.6}" cy="${eyeY - 1.8}" r="1.6" fill="#fff"/></g>`;
    }
    if (mood === "hungry")
        eyes += `<path d="M42 ${eyeY - 9} L54 ${eyeY - 6}M78 ${eyeY - 9} L66 ${eyeY - 6}" stroke="${ink}" stroke-width="2.2" stroke-linecap="round"/><path d="M${eyeX[0] - 4} ${eyeY + 8} q-2 6 0 8 q3 -3 0 -8Z" fill="#7cc8ff"/>`;
    const my = sp === "frog" ? 56 : 63;
    const mouth = mood === "happy"
        ? sp === "frog"
            ? `<path d="M40 ${my} Q60 ${my + 14} 80 ${my}" stroke="${ink}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`
            : `<path d="M53 ${my} Q60 ${my + 7} 67 ${my}" stroke="${ink}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`
        : mood === "hungry"
            ? `<path d="M54 ${my + 5} Q60 ${my - 2} 66 ${my + 5}" stroke="${ink}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`
            : `<path d="M56 ${my + 1} L64 ${my + 1}" stroke="${ink}" stroke-width="2.2" stroke-linecap="round"/>`;
    const face = sp === "cat"
        ? `<polygon points="57,58 63,58 60,62" fill="#ff8fa8"/><path d="M40 58 L26 55M40 62 L26 64M80 58 L94 55M80 62 L94 64" stroke="${dark}" stroke-width="1.4" stroke-linecap="round"/>`
        : sp === "dog"
            ? `<ellipse cx="60" cy="62" rx="14" ry="10" fill="${light}"/><ellipse cx="60" cy="58" rx="5" ry="3.6" fill="${ink}"/>${mood === "happy" ? `<path d="M56 ${my + 4} Q60 ${my + 13} 64 ${my + 4}Z" fill="#ff8fa8"/>` : ""}`
            : sp === "bunny"
                ? `<ellipse cx="60" cy="58" rx="3.4" ry="2.6" fill="#ff8fa8"/><circle cx="55" cy="66" r="2" fill="#fff"/><circle cx="65" cy="66" r="2" fill="#fff"/>`
                : sp === "dragon"
                    ? `<ellipse cx="60" cy="62" rx="13" ry="9" fill="${light}"/><circle cx="55" cy="60" r="1.6" fill="${dark}"/><circle cx="65" cy="60" r="1.6" fill="${dark}"/><path d="M52 98 h16M54 104 h12" stroke="${light}" stroke-width="3" stroke-linecap="round"/>`
                    : "";
    const cheeks = sp === "frog" ? "" : `<circle cx="42" cy="62" r="4.4" fill="#ff8fa8" opacity=".45"/><circle cx="78" cy="62" r="4.4" fill="#ff8fa8" opacity=".45"/>`;
    const hat = o.hat === "party"
        ? `<polygon points="47,30 60,2 73,30" fill="#ff5fa2"/><path d="M50 24 L70 24M53 16 L67 16" stroke="#ffe27a" stroke-width="3"/><circle cx="60" cy="3" r="4" fill="#ffe27a"/>`
        : o.hat === "crown"
            ? `<polygon points="44,32 44,14 53,22 60,8 67,22 76,14 76,32" fill="#f2c76b" stroke="#b8893a" stroke-width="2" stroke-linejoin="round"/><circle cx="60" cy="14" r="2.5" fill="#ff5fa2"/>`
            : o.hat === "headphones"
                ? `<path d="M31 54 Q31 20 60 20 Q89 20 89 54" stroke="#2a2a3a" stroke-width="5" fill="none"/><rect x="26" y="46" width="10" height="18" rx="4" fill="#4a4a66"/><rect x="84" y="46" width="10" height="18" rx="4" fill="#4a4a66"/>`
                : o.hat === "shades"
                    ? `<rect x="38" y="${eyeY - 7}" width="20" height="13" rx="5" fill="#111"/><rect x="62" y="${eyeY - 7}" width="20" height="13" rx="5" fill="#111"/><path d="M58 ${eyeY - 2} h4" stroke="#111" stroke-width="3"/>`
                    : "";
    const zz = mood === "sleeping" ? `<text x="86" y="30" font-size="14" font-weight="800" fill="#bfa8ff" class="${anim ? "" : "ph-zz"}">z</text><text x="96" y="18" font-size="10" font-weight="800" fill="#bfa8ff">z</text>` : "";
    const css = `<style>.ph-bob{transform-origin:60px 108px;animation:phbob 1.7s ease-in-out infinite}.ph-blink{transform-box:fill-box;transform-origin:center;animation:phblink 4.2s infinite}@keyframes phbob{0%,100%{transform:scaleY(1)}50%{transform:scaleY(.95) translateY(1px)}}@keyframes phblink{0%,92%,100%{transform:scaleY(1)}95%{transform:scaleY(.1)}}</style>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="${size}" height="${size}" role="img" aria-label="${sp}">${anim ? css : ""}<ellipse cx="60" cy="110" rx="30" ry="5" fill="#000" opacity=".25"/><g class="${anim ? "ph-bob" : ""}">${back}${body}${cheeks}${eyes}${face}${mouth}${hat}${zz}</g></svg>`;
}
