# Assemble GIF frames captured by scripts/capture.mjs into docs/screenshots/liminal.gif
import glob
from PIL import Image
files = sorted(glob.glob('scripts/.out/gif/f*.png'))
frames = [Image.open(f).convert('RGB').resize((480, 270), Image.LANCZOS) for f in files]
pal = frames[len(frames) // 2].quantize(colors=128, method=Image.Quantize.MEDIANCUT)
q = [f.quantize(palette=pal, dither=Image.Dither.NONE) for f in frames]
q[0].save('docs/screenshots/liminal.gif', save_all=True, append_images=q[1:], duration=110, loop=0, optimize=True)
print(len(q), 'frames')
