"""
Zpracuje dodané obrázky mazlíčků a doplňků do public/pets (WebP s průhledností).
Použití: python3 scripts/process-pets.py <složka s originály>
Originály: dragon.png, cat.png, mushroom.png (houba), butterfly.png, bat.png (řádky po 5 stupních), items.png (mřížka 5x5).
"""
import sys, json, os
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

SRC = sys.argv[1]
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "pets")
os.makedirs(os.path.join(OUT, "items"), exist_ok=True)

def runs(alpha, thr=30, gap=12):
    cols = (alpha > thr).sum(0) > 2
    out, start, last = [], None, None
    for x, v in enumerate(cols):
        if v:
            if start is None: start = x
            last = x
        elif start is not None and x - last > gap:
            out.append((start, last)); start = None
    if start is not None: out.append((start, last))
    return out

def valley_split(alpha, n=5, thr=40):
    """Když se sousední stupně dotýkají, rozděl list v nejprázdnějších sloupcích."""
    cols = (alpha > thr).sum(0).astype(float)
    cols = np.convolve(cols, np.ones(9) / 9, mode="same")
    xs = np.where(cols > 2)[0]
    x0, x1 = xs.min(), xs.max()
    cuts = []
    for k in range(1, n):
        guess = x0 + (x1 - x0) * k / n
        lo, hi = int(guess - (x1 - x0) / n * 0.4), int(guess + (x1 - x0) / n * 0.4)
        cuts.append(lo + int(np.argmin(cols[lo:hi])))
    edges = [x0 - 1] + cuts + [x1 + 1]
    return [(edges[i] + 1, edges[i + 1]) for i in range(n)]

# přibližné hranice mezi stupni, když se sousední postavy dotýkají (křídla); skutečný řez je v nejprázdnějším sloupci poblíž
MANUAL_CUTS = {"butterfly": [230, 528, 871, 1288]}

def manual_split(alpha, guesses, thr=40):
    cols = (alpha > thr).sum(0).astype(float)
    cols = np.convolve(cols, np.ones(5) / 5, mode="same")
    xs = np.where(cols > 2)[0]
    cuts = [g - 25 + int(np.argmin(cols[g - 25: g + 25])) for g in guesses]
    edges = [int(xs.min()) - 1] + cuts + [int(xs.max()) + 1]
    return [(edges[i] + 1, edges[i + 1]) for i in range(5)]

def hard_alpha(a, lo=90, hi=170):
    t = np.clip((a.astype(float) - lo) / (hi - lo), 0, 1)
    return t * t * (3 - 2 * t)

def remove_fake_bg(rgb, hole_max=12000, erode=1, aura_cut=False):
    """Šachovnice/bílé pozadí uvnitř obrázku -> alfa. Pozadí spojené s okrajem + malé světlé díry (např. v křídlech)."""
    a = rgb.astype(int)
    mx, mn = a.max(2), a.min(2)
    bg = (mn >= 218) & ((mx - mn) <= 16)
    lab, n = ndi.label(bg)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    sizes = ndi.sum(bg, lab, range(1, n + 1))
    kill = set(edge) | {i + 1 for i, s in enumerate(sizes) if s < hole_max}
    mask = np.isin(lab, list(kill))
    fg = ~mask
    fg = ndi.binary_opening(fg, iterations=1)
    lab2, n2 = ndi.label(fg)
    sz = ndi.sum(fg, lab2, range(1, n2 + 1))
    fg = np.isin(lab2, [i + 1 for i, s in enumerate(sz) if s > 400])
    if erode: fg = ndi.binary_erosion(fg, iterations=erode)
    if aura_cut:
        # kouřová aura nad šachovnicí nejde čistě oddělit: odeber velké modré plochy a znovu pozadí kolem nich
        r, g, b = a[..., 0], a[..., 1], a[..., 2]
        blue = fg & (b - r > 18) & (b > 160)
        bl, bn = ndi.label(ndi.binary_closing(blue, iterations=2))
        bs = ndi.sum(blue, bl, range(1, bn + 1))
        big = np.isin(bl, [i + 1 for i, v in enumerate(bs) if v > 2500])
        fg2 = fg & ~ndi.binary_dilation(big, iterations=3)
        light = (mn >= 175) & ((mx - mn) <= 40)
        lab3, n3 = ndi.label(light & fg2)
        # světlé zbytky šachovnice, které teď sousedí s odebranou aurou
        touch = ndi.binary_dilation(~fg2, iterations=2)
        kill2 = set(np.unique(lab3[touch & (lab3 > 0)]))
        sz3 = ndi.sum(light & fg2, lab3, range(1, n3 + 1))
        kill2 = {k for k in kill2 if sz3[k - 1] < 20000}
        fg2 &= ~np.isin(lab3, list(kill2))
        fg2 = ndi.binary_opening(fg2, iterations=2)
        l4, n4 = ndi.label(fg2); z4 = ndi.sum(fg2, l4, range(1, n4 + 1))
        fg = np.isin(l4, [i + 1 for i, v in enumerate(z4) if v > 2000])
    return ndi.gaussian_filter(fg.astype(float), 0.9)

def save(arr, path, maxdim=900):
    im = Image.fromarray(arr, "RGBA")
    bbox = im.getbbox()
    im = im.crop(bbox)
    if max(im.size) > maxdim:
        s = maxdim / max(im.size); im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    im.save(path, "WEBP", quality=88, method=6)
    return im.size

meta = {}
for name in ["dragon", "cat", "mushroom", "butterfly", "bat"]:
    im = Image.open(os.path.join(SRC, name + ".png")).convert("RGBA")
    rgba = np.array(im)
    if name == "dragon":
        alpha = hard_alpha(rgba[..., 3])
    else:
        alpha = remove_fake_bg(rgba[..., :3], hole_max=12000 if name == "bat" else 0, aura_cut=(name == "cat"))
    rgba[..., 3] = (alpha * 255).astype(np.uint8)
    rs = runs(rgba[..., 3], 40)
    if len(rs) != 5: rs = manual_split(rgba[..., 3], MANUAL_CUTS[name])
    assert len(rs) == 5, (name, rs)
    sizes = []
    for i, (x0, x1) in enumerate(rs):
        part = rgba[:, max(0, x0 - 4): x1 + 5].copy()
        sizes.append(save(part, os.path.join(OUT, f"{name}-{i + 1}.webp")))
    meta[name] = sizes
    print(name, sizes)

# doplňky: mřížka 5x5
it = np.array(Image.open(os.path.join(SRC, "items.png")).convert("RGBA"))
H, W = it.shape[:2]
AURA = {(2, 0), (2, 1), (2, 2)}  # ledová, ohnivá, temná aura: průsvitnost zůstává
alpha = it[..., 3].astype(float)
hard = hard_alpha(it[..., 3], 70, 150)
soft = np.clip((alpha - 14) / 60, 0, 1)
lab, n = ndi.label(hard > 0.2)
sz = ndi.sum(hard > 0.2, lab, range(1, n + 1))
cells = {}
for i, s in enumerate(sz):
    if s < 300: continue
    cy, cx = ndi.center_of_mass(lab == i + 1)
    cells.setdefault((int(cy // (H / 5)), int(cx // (W / 5))), []).append(i + 1)
KEYS = [
 ["royalcrown","wizardhat","demonhorns","flowerwreath","batwings"],
 ["dragoncollar","royalcape","magicscarf","adventurepack","crystalorb"],
 ["iceaura","fireaura","darkaura","halo","monocle"],
 ["piratecollar","crystalamulet","belledbow","travelpack","spikedcollar"],
 ["crystalcrown","flowerhorns","mosswreath","butterflyornament","hellcrown"],
]
for (r, c), ids in sorted(cells.items()):
    key = KEYS[r][c]
    comp = np.isin(lab, ids)
    if (r, c) in AURA:
        # aura: ponech průsvitnost v okolí těla aury
        grow = ndi.binary_dilation(comp, iterations=40)
        a = np.where(grow, soft, 0)
    else:
        grow = ndi.binary_dilation(comp, iterations=3)
        a = np.where(grow, hard, 0)
    out = it.copy(); out[..., 3] = (a * 255).astype(np.uint8)
    # ořez na buňku s rezervou
    y0, y1 = int(max(0, r * H / 5 - 30)), int(min(H, (r + 1) * H / 5 + 30))
    x0, x1 = int(max(0, c * W / 5 - 30)), int(min(W, (c + 1) * W / 5 + 30))
    sub = np.zeros_like(out); m = np.zeros(out.shape[:2], bool); m[y0:y1, x0:x1] = True
    sub[m] = out[m]
    meta[key] = save(sub, os.path.join(OUT, "items", key + ".webp"), 600)
json.dump(meta, open(os.path.join(OUT, "meta.json"), "w"))
print(len([k for k in meta if k not in ("dragon","cat","mushroom","butterfly","bat")]), "items")
