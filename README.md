# 次元猫的 GitHub Star 收藏页

静态展示页，展示 `moeacgx` 账号当前 Star 的项目卡片。

## 展示内容
- repo 名
- 一句话内容
- topics 标签
- Star 分类
- GitHub Star 数
- 收藏时间

## 本地更新
```bash
python3 build_page.py
```

## 自动更新
由 workspace 内的 `skills/github-star-auto/scripts/run.sh` 驱动：
- 检查新增 Star
- 自动分类写入 GitHub Star Lists
- 重建本页面数据
- 如配置了 GitHub 仓库，则同步推送到 GitHub Pages
