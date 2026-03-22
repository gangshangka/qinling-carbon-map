#!/usr/bin/env python3
"""
处理TIFF栅格数据与GeoJSON县区边界，生成3D地图所需数据
输入：data/nep20225.tif (碳汇栅格数据)
      data/shapefile/qinling.geojson (县区边界)
输出：data/carbon_stats.json (每个县区的碳汇统计)
"""

import json
import numpy as np
from osgeo import gdal, ogr
import sys
import os

def extract_carbon_stats(tiff_path, geojson_path, output_path):
    """
    提取每个县区的碳汇统计值
    """
    print(f"读取栅格数据: {tiff_path}")
    # 打开TIFF文件
    ds = gdal.Open(tiff_path)
    if ds is None:
        print(f"无法打开TIFF文件: {tiff_path}")
        return False
    
    # 获取栅格信息
    band = ds.GetRasterBand(1)
    nodata = band.GetNoDataValue()
    transform = ds.GetGeoTransform()
    
    # 打开GeoJSON文件
    print(f"读取矢量数据: {geojson_path}")
    vector_ds = ogr.Open(geojson_path)
    if vector_ds is None:
        print(f"无法打开GeoJSON文件: {geojson_path}")
        return False
    
    layer = vector_ds.GetLayer()
    
    # 准备结果列表
    county_stats = []
    
    # 遍历每个县区
    feature_count = layer.GetFeatureCount()
    print(f"处理 {feature_count} 个县区...")
    
    for i, feature in enumerate(layer):
        # 获取县区名称（尝试多个可能的字段）
        name_fields = ['NAME', 'name', '名称', 'COUNTY', 'county']
        county_name = None
        for field in name_fields:
            if feature.GetField(field):
                county_name = feature.GetField(field)
                break
        
        if county_name is None:
            county_name = f"县区_{i+1}"
        
        # 获取几何体
        geom = feature.GetGeometryRef()
        
        # 计算几何中心（用于3D地图坐标）
        centroid = geom.Centroid()
        center_lon = centroid.GetX()
        center_lat = centroid.GetY()
        
        # 准备掩膜栅格
        # 创建内存数据集用于掩膜
        mem_driver = gdal.GetDriverByName('MEM')
        mask_ds = mem_driver.Create('', ds.RasterXSize, ds.RasterYSize, 1, gdal.GDT_Byte)
        mask_ds.SetGeoTransform(transform)
        mask_ds.SetProjection(ds.GetProjection())
        mask_band = mask_ds.GetRasterBand(1)
        mask_band.Fill(0)
        
        # 栅格化多边形
        gdal.RasterizeLayer(mask_ds, [1], layer, burn_values=[1], options=["WHERE FID=" + str(feature.GetFID())])
        
        # 读取掩膜和数据
        mask_array = mask_band.ReadAsArray()
        data_array = band.ReadAsArray()
        
        # 提取多边形内的值
        valid_mask = (mask_array == 1) & (data_array != nodata) & (~np.isnan(data_array))
        valid_values = data_array[valid_mask]
        
        # 计算统计值
        if len(valid_values) > 0:
            mean_value = float(np.nanmean(valid_values))
            sum_value = float(np.nansum(valid_values))
            max_value = float(np.nanmax(valid_values))
            min_value = float(np.nanmin(valid_values))
            count = int(len(valid_values))
        else:
            mean_value = 0.0
            sum_value = 0.0
            max_value = 0.0
            min_value = 0.0
            count = 0
        
        county_stats.append({
            'name': county_name,
            'center': [float(center_lon), float(center_lat)],
            'carbon_mean': mean_value,
            'carbon_sum': sum_value,
            'carbon_max': max_value,
            'carbon_min': min_value,
            'pixel_count': count
        })
        
        if (i + 1) % 10 == 0:
            print(f"  已处理 {i+1}/{feature_count} 个县区")
    
    # 关闭数据集
    ds = None
    vector_ds = None
    
    # 计算总体统计
    all_means = [c['carbon_mean'] for c in county_stats if c['carbon_mean'] != 0]
    all_sums = [c['carbon_sum'] for c in county_stats if c['carbon_sum'] != 0]
    
    total_stats = {
        'total_counties': len(county_stats),
        'counties_with_data': len([c for c in county_stats if c['pixel_count'] > 0]),
        'overall_mean': float(np.mean(all_means)) if all_means else 0.0,
        'overall_sum': float(np.sum(all_sums)) if all_sums else 0.0,
        'max_mean': float(max(all_means)) if all_means else 0.0,
        'min_mean': float(min(all_means)) if all_means else 0.0
    }
    
    # 保存结果
    result = {
        'metadata': {
            'source_tiff': os.path.basename(tiff_path),
            'source_geojson': os.path.basename(geojson_path),
            'processing_date': '2025-03-22',
            'data_units': '碳通量单位 (可能为NEP或GPP)'
        },
        'total_stats': total_stats,
        'counties': county_stats
    }
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    
    print(f"数据处理完成！结果保存到: {output_path}")
    print(f"统计摘要:")
    print(f"  总县区数: {total_stats['total_counties']}")
    print(f"  有数据的县区: {total_stats['counties_with_data']}")
    print(f"  平均碳汇值: {total_stats['overall_mean']:.2f}")
    print(f"  总碳汇值: {total_stats['overall_sum']:.2f}")
    
    return True

def generate_3d_data_json(county_stats_path, output_3d_path):
    """
    生成3D地图所需的简化数据格式
    """
    with open(county_stats_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    counties = data['counties']
    
    # 准备3D数据：格式为 [经度, 纬度, 碳汇值]
    # 碳汇值归一化到0-100范围用于高度
    carbon_values = [c['carbon_mean'] for c in counties if c['carbon_mean'] != 0]
    if carbon_values:
        min_val = min(carbon_values)
        max_val = max(carbon_values)
        # 如果所有值都相同，避免除以零
        if max_val - min_val > 0:
            normalize = lambda x: (x - min_val) / (max_val - min_val) * 100
        else:
            normalize = lambda x: 50.0  # 中间值
    else:
        normalize = lambda x: 0.0
    
    features_3d = []
    for county in counties:
        # 使用归一化的碳汇值作为高度
        if county['carbon_mean'] != 0:
            height = normalize(county['carbon_mean'])
        else:
            height = 0.0
        
        features_3d.append({
            'name': county['name'],
            'center': county['center'],
            'carbon_mean': county['carbon_mean'],
            'carbon_sum': county['carbon_sum'],
            'height': height,
            'value_3d': [county['center'][0], county['center'][1], height]
        })
    
    result_3d = {
        'type': 'FeatureCollection3D',
        'features': features_3d,
        'normalization': {
            'min': min(carbon_values) if carbon_values else 0,
            'max': max(carbon_values) if carbon_values else 0,
            'range': (max(carbon_values) - min(carbon_values)) if carbon_values else 0
        }
    }
    
    with open(output_3d_path, 'w', encoding='utf-8') as f:
        json.dump(result_3d, f, ensure_ascii=False, indent=2)
    
    print(f"3D数据已生成: {output_3d_path}")
    return True

if __name__ == '__main__':
    # 路径配置
    base_dir = os.path.dirname(os.path.abspath(__file__))
    tiff_path = os.path.join(base_dir, 'data', 'nep20225.tif')
    geojson_path = os.path.join(base_dir, 'data', 'shapefile', 'qinling.geojson')
    stats_path = os.path.join(base_dir, 'data', 'carbon_stats.json')
    map3d_path = os.path.join(base_dir, 'data', 'map3d_data.json')
    
    # 检查文件是否存在
    if not os.path.exists(tiff_path):
        print(f"错误: TIFF文件不存在: {tiff_path}")
        sys.exit(1)
    
    if not os.path.exists(geojson_path):
        print(f"错误: GeoJSON文件不存在: {geojson_path}")
        sys.exit(1)
    
    print("=" * 60)
    print("秦岭碳汇3D数据处理工具")
    print("=" * 60)
    
    try:
        # 步骤1: 提取碳汇统计
        if extract_carbon_stats(tiff_path, geojson_path, stats_path):
            # 步骤2: 生成3D数据
            generate_3d_data_json(stats_path, map3d_path)
            print("\n处理成功完成！")
            print(f"生成的文件:")
            print(f"  1. {stats_path} - 详细统计")
            print(f"  2. {map3d_path} - 3D地图数据")
        else:
            print("\n处理失败！")
            sys.exit(1)
            
    except Exception as e:
        print(f"\n处理过程中发生错误: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)