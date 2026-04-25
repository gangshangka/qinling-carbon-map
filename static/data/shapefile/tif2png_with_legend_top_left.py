#!/usr/bin/env python3
"""
TIF转PNG处理脚本（支持命令行参数）
用于处理管理员页面上传的TIF文件，生成带图例的PNG图片

使用方式：
1. 批量处理模式：python tif2png_with_legend_top_left.py --batch
2. 单文件处理模式：python tif2png_with_legend_top_left.py --input input.tif --year 2020 --month 1 --output output.png

参数说明：
  --batch: 批量处理模式，处理当前目录下所有nep*.tif文件
  --input: 输入TIF文件路径（单文件模式）
  --output: 输出PNG文件路径（单文件模式）
  --year: 年份（用于命名）
  --month: 月份（用于命名）
  --config: 配置文件路径（可选）

默认配置：
  - 输出目录：./png_output_green
  - 颜色映射：绿色主题
  - 数据范围：vmin=-1100, vmax=900
  - 缩放比例：0.5
"""

import os
import sys
import glob
import argparse
import numpy as np
import rasterio
from PIL import Image, ImageDraw, ImageFont

# ========== 默认配置 ==========
DEFAULT_VMIN = -1100
DEFAULT_VMAX = 900
DEFAULT_SCALE_FACTOR = 0.5
DEFAULT_OUTPUT_DIR = "./png_output_green"

# ========== 绿色主题颜色映射 ==========
COLOR_STOPS = [
    (0.0, (20, 80, 20)),     # -1100：墨绿
    (0.2, (30, 120, 30)),    # -700：森林绿
    (0.4, (80, 160, 40)),    # -300：深草绿
    (0.6, (120, 200, 60)),   # 100：鲜绿
    (0.8, (200, 230, 100)),  # 500：黄绿
    (1.0, (255, 255, 220))   # 900：亮黄白
]

def array_to_rgb(data, vmin, vmax, stops):
    """将二维数据数组转换为RGB图像数组（白色背景）"""
    h, w = data.shape
    rgb = np.zeros((h, w, 3), dtype=np.uint8)
    rgb[:] = [255, 255, 255]  # 默认白色背景

    valid = ~np.isnan(data)
    if not np.any(valid):
        return rgb

    # 归一化有效数据
    norm = (data[valid] - vmin) / (vmax - vmin)
    norm = np.clip(norm, 0, 1)

    positions = np.array([s[0] for s in stops])
    colors = np.array([s[1] for s in stops], dtype=np.uint8)

    # 找出每个norm所属的区间索引
    idx = np.searchsorted(positions, norm, side='right') - 1
    idx = np.clip(idx, 0, len(positions)-2)

    # 计算区间比例
    pos1 = positions[idx]
    pos2 = positions[idx+1]
    frac = (norm - pos1) / (pos2 - pos1)

    # 取出对应颜色
    c1 = colors[idx]
    c2 = colors[idx+1]

    # 插值
    r = (c1[:,0] + (c2[:,0] - c1[:,0]) * frac).astype(np.uint8)
    g = (c1[:,1] + (c2[:,1] - c1[:,1]) * frac).astype(np.uint8)
    b = (c1[:,2] + (c2[:,2] - c1[:,2]) * frac).astype(np.uint8)

    rgb[valid, 0] = r
    rgb[valid, 1] = g
    rgb[valid, 2] = b
    return rgb

def draw_legend_top_left(img, vmin, vmax, stops):
    """
    在图像左上角绘制水平分级图例（缩小版）
    """
    # 图例参数
    legend_height = 25          # 图例条高度
    label_font_size = 10        # 字体大小
    legend_width_ratio = 0.2    # 图例宽度占图片宽度的比例
    legend_margin = 15          # 距离左上角的边距

    # 计算图例宽度（最大200像素，避免过宽）
    legend_width = int(img.width * legend_width_ratio)
    legend_width = min(legend_width, 200)  # 限制最大宽度

    # 创建新画布（原图大小不变，直接在原图上绘制）
    # 注意：为避免覆盖原图，我们在原图上绘制（会覆盖左上角区域）
    # 如果希望图例在图片外部，可扩展画布，但用户要求左上角，我们直接绘制
    draw = ImageDraw.Draw(img)

    # 加载字体
    try:
        font = ImageFont.truetype("arial.ttf", label_font_size)
    except:
        font = ImageFont.load_default()

    # 图例左上角坐标
    legend_x = legend_margin
    legend_y = legend_margin

    # 根据 color_stops 的段数确定色块数量
    n_classes = len(stops) - 1
    patch_width = legend_width // n_classes

    # 先绘制白色背景矩形，避免透明（可选）
    draw.rectangle([legend_x-2, legend_y-2, legend_x+legend_width+2, legend_y+legend_height+20],
                   fill=(255,255,255), outline=None)

    # 绘制每个色块
    for i in range(n_classes):
        # 计算该色块的左右边界数值
        pos_low = stops[i][0]
        pos_high = stops[i+1][0]
        value_low = vmin + pos_low * (vmax - vmin)
        value_high = vmin + pos_high * (vmax - vmin)

        # 绘制色块
        x0 = legend_x + i * patch_width
        x1 = x0 + patch_width
        draw.rectangle([x0, legend_y, x1, legend_y + legend_height], fill=stops[i][1], outline="black")

        # 标注下界值（在色块下方居中）
        label = f"{value_low:.1f}"
        bbox = draw.textbbox((0, 0), label, font=font)
        text_width = bbox[2] - bbox[0]
        draw.text((x0 + patch_width//2 - text_width//2, legend_y + legend_height + 2), label, fill="black", font=font)

    # 标注最大值（最后一个色块的上界，放在图例最右侧下方）
    max_label = f"{vmax:.1f}"
    bbox = draw.textbbox((0, 0), max_label, font=font)
    max_width = bbox[2] - bbox[0]
    draw.text((legend_x + legend_width - max_width, legend_y + legend_height + 2), max_label, fill="black", font=font)

    return img  # 返回修改后的原图（直接绘制了图例）

def process_tif_file(tif_path, output_path, vmin, vmax, scale_factor, stops):
    """处理单个TIF文件"""
    print(f"处理: {tif_path}")
    
    with rasterio.open(tif_path) as src:
        data = src.read(1).astype(np.float32)

        # 处理NoData（设为NaN）
        nodata = src.nodata
        if nodata is not None:
            data[data == nodata] = np.nan

        # 转换为RGB图像（白色背景）
        rgb = array_to_rgb(data, vmin, vmax, stops)
        img = Image.fromarray(rgb, mode='RGB')

        # 缩放图片（如果设置 scale_factor < 1）
        if scale_factor < 1:
            new_size = (int(img.width * scale_factor), int(img.height * scale_factor))
            img = img.resize(new_size, Image.Resampling.LANCZOS)
            print(f"    缩放至: {new_size}")

        # 添加图例（左上角，缩小版）
        img_with_legend = draw_legend_top_left(img, vmin, vmax, stops)

        # 保存PNG
        img_with_legend.save(output_path, compress_level=6)
        print(f"  已保存: {output_path}")

def batch_process(tif_folder, output_folder, vmin, vmax, scale_factor, stops):
    """批量处理TIF文件"""
    # 创建输出文件夹
    os.makedirs(output_folder, exist_ok=True)

    # 获取所有TIF文件
    tif_files = glob.glob(os.path.join(tif_folder, "nep*.tif"))
    print(f"找到 {len(tif_files)} 个TIF文件")

    for tif_path in tif_files:
        basename = os.path.basename(tif_path)
        out_name = basename.replace('.tif', '.png')
        out_path = os.path.join(output_folder, out_name)
        process_tif_file(tif_path, out_path, vmin, vmax, scale_factor, stops)

def single_process(tif_path, output_path, vmin, vmax, scale_factor, stops):
    """处理单个TIF文件"""
    # 确保输出目录存在
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    process_tif_file(tif_path, output_path, vmin, vmax, scale_factor, stops)

def main():
    parser = argparse.ArgumentParser(description='TIF转PNG处理脚本（带图例）')
    parser.add_argument('--batch', action='store_true', help='批量处理模式')
    parser.add_argument('--input', type=str, help='输入TIF文件路径（单文件模式）')
    parser.add_argument('--output', type=str, help='输出PNG文件路径（单文件模式）')
    parser.add_argument('--year', type=int, help='年份（用于命名）')
    parser.add_argument('--month', type=int, help='月份（用于命名）')
    parser.add_argument('--output-dir', type=str, default=DEFAULT_OUTPUT_DIR, help='输出目录（批量模式）')
    parser.add_argument('--vmin', type=float, default=DEFAULT_VMIN, help='数据最小值')
    parser.add_argument('--vmax', type=float, default=DEFAULT_VMAX, help='数据最大值')
    parser.add_argument('--scale', type=float, default=DEFAULT_SCALE_FACTOR, help='缩放比例')
    
    args = parser.parse_args()
    
    # 检查参数
    if args.batch:
        # 批量处理模式
        batch_process("./", args.output_dir, args.vmin, args.vmax, args.scale, COLOR_STOPS)
    elif args.input and args.output:
        # 单文件处理模式
        single_process(args.input, args.output, args.vmin, args.vmax, args.scale, COLOR_STOPS)
    elif args.input and args.year and args.month:
        # 使用年份月份自动生成输出路径
        month_str = str(args.month).zfill(2)
        output_filename = f"nep{args.year}{month_str}.png"
        output_path = os.path.join(DEFAULT_OUTPUT_DIR, output_filename)
        single_process(args.input, output_path, args.vmin, args.vmax, args.scale, COLOR_STOPS)
    else:
        print("错误：请提供正确的参数组合")
        print("批量模式：--batch")
        print("单文件模式：--input <input.tif> --output <output.png>")
        print("或：--input <input.tif> --year <year> --month <month>")
        sys.exit(1)
    
    print("处理完成！")

if __name__ == "__main__":
    main()