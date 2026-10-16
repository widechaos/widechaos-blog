# 十方空烬 · WideChaos

[widechaos.cn](https://widechaos.cn/) 的公开网站源码：首页、作品、十方志、工具、关于和现在。连续滚动的城市画面、作品演示、双语阅读与正文服务端渲染共用一套内容模型。

主分支现在维护这版站点。旧 Astro 实现及原提交历史完整保留在 [`legacy-astro-2026-10-16`](https://github.com/widechaos/widechaos-blog/tree/legacy-astro-2026-10-16)，旧 GitHub Pages 工作流不再执行。

## 本地运行

需要 Python 3.11+ 和 Node.js 22。浏览器依赖已经放在 `static/vendor/`，没有 npm 安装步骤。

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python serve.py
```

打开 `http://127.0.0.1:9567/`。预览仅监听本机，文章从正式站公开 JSON 读取；开发作品使用 `examples/site-catalog.json`。示例数据仅供开发和测试，代码部署不会传入生产内容目录。

```sh
npm run check
npm run validate
npm test
.venv/bin/python -m unittest discover -s integration -p 'test_*.py'
.venv/bin/python -m unittest discover -s tests -p 'test_*.py'
python3 scripts/check_source.py
```

## 更新与上线

1. 修改源码，运行检查并提交到 `main`。
2. GitHub Actions 检查源码、凭据、内容协议和发布包。
3. 在已有管理终端使用私有部署配置，对通过 CI 的同一提交先查看计划，再部署。

```sh
python3 scripts/deploy.py --config /private/path/site-deploy.json
python3 scripts/deploy.py --config /private/path/site-deploy.json --apply
```

这条路径使用现有 SSH 管理连接，不需要向 GitHub 保存服务器或发布平台密码。部署从 Git 提交构建文件白名单，保存可回退快照，验证公开页面和私有接口边界，失败自动恢复。代码更新与日常内容发布分别维护，详见 [部署与回滚](docs/deployment.md)、[文章与作品更新](docs/content.md)。

## 源码范围

| 目录 | 用途 |
| --- | --- |
| `static/`、`index.html` | 公开页面、样式、动效和素材 |
| `integration/` | 公开文章读取、净化、翻译配对、SSR及作品目录校验 |
| `scripts/` | 检查、可复现打包、部署和回滚 |
| `examples/` | 已公开内容的开发测试样例，不部署 |
| `tests/` | 内容模型、导入保护和部署边界测试 |
| `docs/` | 维护与部署说明 |

仓库不包含生产凭据、发布账号配置、私有业务代码、数据库、运行日志或审稿台账。生产继续使用已有内容引擎与认证。[隐私边界](docs/privacy.md)说明了检查与保护范围。
