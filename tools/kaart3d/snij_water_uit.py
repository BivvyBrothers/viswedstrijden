"""Snijdt het water uit de 3D-kaart langs de lijn die Patrick op 19 nov 2026 in een schermafbeelding tekende.

Gebruik (vanuit app/):
  python3 tools/kaart3d/snij_water_uit.py <werkmap> <bron.jpg> <uit.jpg>
In <werkmap>/kaart/ moet `lijn.png` staan (kopie van tools/kaart3d/lijn-patrick-2026-11-19.png:
de getekende lijn, 2000 x 1077, wit op zwart). De bron is de ONGESNEDEN plaat van 1465 x 782
(`git show 7ce5077:docs/schermen/kaart3d-stekken.jpg`). Daarna zelf rondom marge zetten en
`python3 tools/naar_webp.py` draaien; zie CLAUDE.md, "Vormgeving van de startpagina".
De schaal en verschuiving (S, DX, DY) horen bij die ene schermafbeelding."""
import sys
from collections import deque
import numpy as np
from PIL import Image, ImageFilter, ImageDraw

sp, bron_pad, uit_pad = sys.argv[1], sys.argv[2], sys.argv[3]
S, DX, DY = 1.424, 88, 28                       # schermafbeelding = bron x S, verschoven
bron = Image.open(bron_pad).convert('RGB'); BW, BH = bron.size
lijn_u = Image.open(sp + '/kaart/lijn.png').convert('L'); UW, UH = lijn_u.size

# 1. de lijn naar de maat van de bron
doek = Image.new('L', (int(BW * S) + 2, int(BH * S) + 2), 0); doek.paste(lijn_u, (DX, DY))
lijn = np.asarray(doek.resize((BW, BH), Image.BILINEAR)) > 40

def delen(m):
    H, W = m.shape; lab = np.zeros((H, W), int); uit = []
    for y in range(H):
        for x in range(W):
            if m[y, x] and not lab[y, x]:
                n = len(uit) + 1; q = deque([(y, x)]); lab[y, x] = n; px = []
                while q:
                    cy, cx = q.popleft(); px.append((cx, cy))
                    for dy in (-1, 0, 1):
                        for dx in (-1, 0, 1):
                            ny, nx = cy + dy, cx + dx
                            if 0 <= ny < H and 0 <= nx < W and m[ny, nx] and not lab[ny, nx]:
                                lab[ny, nx] = n; q.append((ny, nx))
                uit.append(px)
    return sorted(uit, key=len, reverse=True)

d = delen(lijn); hoofd, haak = d[0], d[1]
links = lambda px: min(px); rechts = lambda px: max(px)
print('hoofdlijn', links(hoofd), rechts(hoofd), '| haak', links(haak), rechts(haak))

# 2. achtergrond van de plaat (donkergroen)
a = np.asarray(bron).astype(int); bg = np.array(bron.getpixel((3, 3)))
achtergrond = (np.abs(a - bg).sum(axis=2) < 26)

# 3. de lijn doortrekken tot de linker- en rechterrand van het beeld: dan verdeelt hij het
#    beeld in een waterkant (boven) en een landkant (onder)
dicht = Image.fromarray((lijn * 255).astype('uint8')); t = ImageDraw.Draw(dicht)
t.line([rechts(haak), links(hoofd)], fill=255, width=3)                         # haak naar hoofdlijn
hx, hy = links(haak); t.line([(hx, hy), (0, hy + 6)], fill=255, width=3)          # haak naar links
rx, ry = rechts(hoofd); t.line([(rx, ry), (BW - 1, ry - 14)], fill=255, width=3)   # rechts door tot de rand
muur = np.asarray(dicht.filter(ImageFilter.MaxFilter(3))) > 0

# 4. alles aan de waterkant van de lijn (ook de losse steknummers die buiten de plaat zweven)
zx, zy = int((900 + DX) / S), int((450 + DY) / S)
assert not muur[zy, zx], 'startpunt ligt op de lijn'
boven = np.zeros((BH, BW), bool); q = deque([(zy, zx)]); boven[zy, zx] = True
while q:
    cy, cx = q.popleft()
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        ny, nx = cy + dy, cx + dx
        if 0 <= ny < BH and 0 <= nx < BW and not boven[ny, nx] and not muur[ny, nx]:
            boven[ny, nx] = True; q.append((ny, nx))
boven |= muur & np.roll(boven, 2, axis=0)      # de lijn zelf hoort bij de waterkant

# 5. langs de weg onder de vaart een rechte snede (de handlijn slingert daar om de weg heen):
#    net onder de paarse weglijn, tot waar de handlijn omhoog gaat
WEG_TOT = 640
xs_ = np.arange(BW); weg = (585.0 - 0.0165 * xs_ + 3).astype(int)
for x in range(0, WEG_TOT):
    boven[weg[x] + 1:, x] = False
    boven[500:weg[x] + 1, x] = True
print('waterkant: %.1f%% van het beeld' % (100 * boven.mean()))
masker = Image.fromarray((boven * 255).astype('uint8'))
glad = masker.filter(ImageFilter.GaussianBlur(6)).point(lambda v: 255 if v > 128 else 0).filter(ImageFilter.GaussianBlur(0.8))
masker.save(sp + '/kaart/masker.png')

# 6. samenstellen op de achtergrondkleur en bijsnijden met marge
vlak = Image.new('RGB', (BW, BH), tuple(int(v) for v in bg))
uit = Image.composite(bron, vlak, glad)
inhoud = (np.asarray(glad) > 128) & ~achtergrond
# losse spikkels van de jpeg-compressie tellen niet mee voor de uitsnede
inhoud = np.asarray(Image.fromarray((inhoud * 255).astype('uint8')).filter(ImageFilter.MinFilter(3))) > 0
ys, xs = np.nonzero(inhoud)
marge = 28
box = (max(0, xs.min() - marge), max(0, ys.min() - marge), min(BW, xs.max() + marge), min(BH, ys.max() + marge))
uit = uit.crop(box); print('uitsnede', box, 'maat', uit.size)
uit.save(uit_pad, quality=90, optimize=True, progressive=True)
