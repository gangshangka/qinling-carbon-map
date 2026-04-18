import geopandas as gpd
import json
import numpy as np
from shapely.geometry import mapping
from pyproj import Transformer

# 读取GeoJSON
gdf = gpd.read_file(r'D:\秦岭碳汇分析\raw_data\秦岭_转换后.geojson')
# 投影转换：从WGS84经纬度到Web墨卡托（单位：米，适合Three.js的平面坐标）
# 或保持经纬度，但Three.js中需要映射到平面。这里用墨卡托得到米制坐标。
transformer = Transformer.from_crs("EPSG:4326", "EPSG:3857", always_xy=True)
def to_mercator(lon, lat):
    x, y = transformer.transform(lon, lat)
    return x, y

# 为每个县添加模拟统计值（例如碳汇量，单位：kgC/m^2·mon）
# 您可以替换为真实数据，例如从CSV读取，通过PAC字段匹配
np.random.seed(42)
gdf['carbon'] = np.random.randint(1000, 5000, len(gdf))

# 将几何体转换为Three.js可用的格式：提取多边形坐标并转为墨卡托
features = []
for idx, row in gdf.iterrows():
    geom = row.geometry
    # 处理多边形（可能是MultiPolygon，这里简化处理）
    coords = []
    if geom.geom_type == 'Polygon':
        polygons = [geom]
    else:
        polygons = list(geom.geoms)
    for poly in polygons:
        rings = []
        for ring in poly.exterior.coords:
            # 转换坐标
            ring_merc = [to_mercator(lon, lat) for lon, lat in ring]
            rings.append(ring_merc)
        # 内环暂忽略
        coords.append(rings)
    features.append({
        'name': row['NAME'],
        'carbon': row['carbon'],
        'geometry': coords,
        'center': to_mercator(row.geometry.centroid.x, row.geometry.centroid.y)
    })

# 保存为JSON文件
with open(r'D:\秦岭碳汇分析\raw_data\map3d_data.json', 'w') as f:
    json.dump(features, f, indent=2)

print("数据已保存到 map3d_data.json")