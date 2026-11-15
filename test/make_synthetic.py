import numpy as np, matplotlib
from PIL import Image
cmap = matplotlib.colormaps["YlOrRd"]
vmin, vmax = 380.0, 410.0
# colorbar 600x40 horizontal
bar = (np.array([cmap(x)[:3] for x in np.linspace(0,1,600)])*255).astype(np.uint8)
Image.fromarray(np.repeat(bar[None,:,:], 40, axis=0)).save("test/cbar.png")
# global map 720x360: value rises with longitude; land block over Borneo-ish area grey
h, w = 360, 720
lon = np.linspace(-180,180,w); lat = np.linspace(90,-90,h)
LON, LAT = np.meshgrid(lon, lat)
truth = 385 + 20*(LON+180)/360          # 385..405
truth[(LAT>0)&(LAT<4)&(LON>110)&(LON<115)] = 420   # beyond legend -> clipped
rgb = (cmap((np.clip(truth,vmin,vmax)-vmin)/(vmax-vmin))[...,:3]*255).astype(np.uint8)
rgb[(LAT>-2)&(LAT<0)&(LON>108)&(LON<112)] = [128,128,128]  # land/no data
Image.fromarray(rgb).save("test/frame.png")
win = (LAT>=-5)&(LAT<=8)&(LON>=105)&(LON<=120)
nd = (LAT>-2)&(LAT<0)&(LON>108)&(LON<112)
t = np.clip(truth[win & ~nd], vmin, vmax)
print("TRUE clipped mean in window:", round(t.mean(),3))
