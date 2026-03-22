#!/usr/bin/env python3
"""
将shapefile转换为GeoJSON
需要安装：pip install geopandas shapely
"""

import geopandas as gpd
import json
import os

def convert_shapefile_to_geojson(shapefile_path, output_path):
    """
    将shapefile转换为GeoJSON
    
    参数:
        shapefile_path: shapefile文件路径（不含扩展名）
        output_path: 输出GeoJSON文件路径
    """
    try:
        # 读取shapefile
        print(f"正在读取shapefile: {shapefile_path}")
        gdf = gpd.read_file(shapefile_path)
        
        # 检查坐标系，如果是地理坐标系（经纬度），确保范围正确
        print(f"数据坐标系: {gdf.crs}")
        
        # 简化几何体以减少文件大小（可选）
        # gdf['geometry'] = gdf['geometry'].simplify(tolerance=0.001)
        
        # 转换为GeoJSON
        print(f"正在转换为GeoJSON: {output_path}")
        gdf.to_file(output_path, driver='GeoJSON')
        
        print(f"转换完成！输出文件: {output_path}")
        print(f"要素数量: {len(gdf)}")
        
        # 显示属性字段
        print("\n属性字段:")
        for col in gdf.columns:
            if col != 'geometry':
                print(f"  - {col}")
        
        # 显示前几个要素的名称（如果有名称字段）
        name_columns = ['NAME', 'name', 'County', 'county', '区县', '县名']
        for col in name_columns:
            if col in gdf.columns:
                print(f"\n前5个区县名称 ({col}):")
                for name in gdf[col].head():
                    print(f"  - {name}")
                break
        
        return True
        
    except Exception as e:
        print(f"转换失败: {e}")
        return False

def create_simplified_geojson(geojson_path, output_path, simplify_tolerance=0.01):
    """
    创建简化版的GeoJSON，减少文件大小
    
    参数:
        geojson_path: 原始GeoJSON文件路径
        output_path: 简化后输出路径
        simplify_tolerance: 简化容差（值越大越简化）
    """
    try:
        print(f"正在简化GeoJSON: {geojson_path}")
        gdf = gpd.read_file(geojson_path)
        
        # 简化几何体
        if simplify_tolerance > 0:
            gdf['geometry'] = gdf['geometry'].simplify(simplify_tolerance)
        
        # 保存简化版本
        gdf.to_file(output_path, driver='GeoJSON')
        print(f"简化完成！输出文件: {output_path}")
        print(f"原始文件大小: {os.path.getsize(geojson_path) / 1024:.1f} KB")
        print(f"简化文件大小: {os.path.getsize(output_path) / 1024:.1f} KB")
        
        return True
        
    except Exception as e:
        print(f"简化失败: {e}")
        return False

def extract_county_coordinates(geojson_path, output_path):
    """
    从GeoJSON中提取区县中心点坐标
    
    参数:
        geojson_path: GeoJSON文件路径
        output_path: 输出JSON文件路径（区县名称到中心点的映射）
    """
    try:
        import json
        
        print(f"正在提取区县中心点坐标: {geojson_path}")
        gdf = gpd.read_file(geojson_path)
        
        # 查找名称字段
        name_columns = ['NAME', 'name', 'County', 'county', '区县', '县名', 'XZQMC']
        name_field = None
        for col in name_columns:
            if col in gdf.columns:
                name_field = col
                break
        
        if name_field is None:
            print("警告: 未找到名称字段，使用索引作为名称")
            name_field = None
        
        # 计算每个多边形的中心点
        county_coords = {}
        for idx, row in gdf.iterrows():
            if name_field:
                name = row[name_field]
            else:
                name = f"区域_{idx}"
            
            # 计算几何体的质心
            centroid = row['geometry'].centroid
            county_coords[name] = {
                'lng': float(centroid.x),
                'lat': float(centroid.y)
            }
        
        # 保存为JSON
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(county_coords, f, ensure_ascii=False, indent=2)
        
        print(f"中心点坐标提取完成！输出文件: {output_path}")
        print(f"提取了 {len(county_coords)} 个区县的坐标")
        
        # 显示前几个坐标
        print("\n前5个区县坐标:")
        for i, (name, coords) in enumerate(list(county_coords.items())[:5]):
            print(f"  {name}: 经度={coords['lng']:.4f}, 纬度={coords['lat']:.4f}")
        
        return True
        
    except Exception as e:
        print(f"提取坐标失败: {e}")
        return False

if __name__ == "__main__":
    # 配置路径
    project_dir = os.path.dirname(os.path.abspath(__file__))
    shapefile_dir = os.path.join(project_dir, "data", "shapefile")
    shapefile_path = os.path.join(shapefile_dir, "秦岭")
    
    output_dir = os.path.join(project_dir, "data")
    geojson_path = os.path.join(output_dir, "qinling.geojson")
    simplified_geojson_path = os.path.join(output_dir, "qinling_simplified.geojson")
    coords_path = os.path.join(output_dir, "county_coordinates.json")
    
    print("=" * 60)
    print("秦岭碳汇系统 - Shapefile转换工具")
    print("=" * 60)
    
    # 检查shapefile是否存在
    if not os.path.exists(shapefile_path + ".shp"):
        print(f"错误: 找不到shapefile文件: {shapefile_path}.shp")
        print("请确保shapefile文件位于: data/shapefile/秦岭.*")
        exit(1)
    
    # 步骤1: 转换为GeoJSON
    print("\n步骤1: 转换shapefile为GeoJSON")
    if convert_shapefile_to_geojson(shapefile_path, geojson_path):
        print("✓ 转换成功")
    else:
        print("✗ 转换失败")
        exit(1)
    
    # 步骤2: 创建简化版（可选）
    print("\n步骤2: 创建简化版GeoJSON（用于小程序）")
    create_simplified_geojson(geojson_path, simplified_geojson_path, simplify_tolerance=0.001)
    
    # 步骤3: 提取中心点坐标
    print("\n步骤3: 提取区县中心点坐标")
    extract_county_coordinates(geojson_path, coords_path)
    
    print("\n" + "=" * 60)
    print("转换完成！")
    print("=" * 60)
    print("\n生成的文件:")
    print(f"  1. 完整GeoJSON: {geojson_path}")
    print(f"  2. 简化GeoJSON: {simplified_geojson_path}")
    print(f"  3. 区县坐标: {coords_path}")
    print("\n使用方法:")
    print("  1. 将简化GeoJSON文件放入小程序中（如 data/qinling.geojson）")
    print("  2. 在小程序中加载GeoJSON并注册为echarts地图")
    print("  3. 使用区县坐标将柱状图放置在正确位置")
    print("\n小程序中加载GeoJSON的示例代码:")
    print('''
    // 加载GeoJSON
    wx.request({
      url: '../../data/qinling_simplified.geojson',
      success: (res) => {
        echarts.registerMap('qinling', res.data);
        // 然后在地图系列中使用 map: 'qinling'
      }
    });
    ''')