# 部署与回滚

## 维护原则

`main` 是网站源码的唯一维护入口。不要再从临时预览目录复制文件到生产。代码提交通过本仓库 `Website checks` 后，用部署工具上线对应提交；网站内容继续由现有内容工具维护。

旧 GitHub Pages 已停用，避免生成第二套站点。GitHub Actions 只检查和产出版本包，不持有服务器凭据，也不直接连接生产。实际部署由拥有现有 SSH 管理连接的终端执行。当前支持直连和经已有管理机中转两种方式。

## 私有配置

配置必须保存在仓库外，仅当前用户可读。以下是字段说明，请填写已有环境的实际值，不把实填文件提交到 Git。

```json
{
  "target": "existing-content-host-alias",
  "bridge": "existing-management-host-alias",
  "bridge_port": 22,
  "root": "/srv/existing-content-service",
  "container": "existing-web-container",
  "private_probes": [
    {"host": "existing-public-host", "path": "/existing-private-api", "status": 404},
    {"host": "existing-private-host", "path": "/existing-private-api", "status": 401}
  ]
}
```

直连时省略 `bridge`。SSH 使用已有 agent 或用户 SSH 配置，不把私钥、密码或会话 Token 放进配置。GitHub CI 状态使用当前终端已有 `gh` 登录读取。`private_probes` 只做不带凭据的 HTTP 检查。

## 已有宿主的接入要求

当前站已完成宿主接入，日常不需要改宿主入口。宿主必须已有 `app/main.py`、原 Markdown 博客渲染器、`content/blog/`、`content/site-catalog.json`、静态挂载、认证和端口映射。宿主需把公开页面接到以下适配器，调用放在旧路由注册之后：

```python
from pathlib import Path
from app.routes import blog
from app.site_content.production_adapter import install

_personal_site = install(
    app,
    root=Path("app/personal_site"),
    catalog_path=Path("content/site-catalog.json"),
    blog_dir=Path("content/blog"),
    native_renderer=blog._parse,
)
```

宿主保留自身认证和旧 RSS、分类、标签路由。额外依赖只有 `requirements-production.txt`，不能用开发 `requirements.txt` 替换宿主依赖。新增宿主首次接入要由其维护者按已有部署方式完成，不能复制整个服务器工程进此仓库。

## 正常上线

```sh
git pull --ff-only origin main
python3 scripts/deploy.py --config /private/path/site-deploy.json
python3 scripts/deploy.py --config /private/path/site-deploy.json --apply
```

默认选择 `origin/main`；也可用 `--ref <commit>` 指定主分支历史中的新版提交。部署要求工作区干净，提交存在于远端 `main` 历史中，且有成功的 push CI。发布包由 Git 对象生成并压缩传输，本地临时文件和忽略文件不会进入。

仅写入：

- `app/personal_site/index.html`
- `app/static/` 下本仓库列明的公开资源
- `app/site_content/` 的五个适配模块
- `bin/site_catalog.py` 的共享目录校验模块

部署不会替换宿主入口、私有路由、认证、nginx、环境配置或内容文件。第一次迁移有完整文件备份；之后如果发现受管文件被仓库外修改，会停止部署，要求先把变动合入仓库，防止覆盖。

执行时创建互斥锁，校验包内路径和摘要，保存文件快照，用生产 Python 只导入公开模块校验后重启原应用，检查公开页面与配置中的私有接口。成功后在宿主 `.site-deploy/` 保存对应提交、发布包、文件摘要和回退快照。失败恢复原文件并重新验活。生产内容只读核对，不从 `examples/` 或 Git 覆盖。

## 回滚

```sh
python3 scripts/deploy.py --config /private/path/site-deploy.json --rollback
```

恢复上次部署前的受管代码与文件，不改文章、目录、账号或数据库。回滚后会重启并检查。更早的新版提交可用 `--ref <commit> --apply` 重新部署。旧 Astro 标签保留源码历史，但旧架构不属于当前宿主的自动回滚包。

## 日常边界

上传源码不会自动批准任何文章。新增文章、补译文和作品变更走原内容工具；网站读取更新后刷新显示，不需要代码发布。审核、账号连接与平台分发凭据仍留在原私有运行环境。
