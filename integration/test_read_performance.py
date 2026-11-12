import asyncio
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import threading
import time
import types
import unittest

from content_service import ContentService
from fastapi import FastAPI


class MetadataReads(unittest.TestCase):
    def test_identity_matches_public_and_file_changes_invalidate_cache(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            blog = root / 'blog'
            blog.mkdir()
            catalog = root / 'catalog.json'
            catalog.write_text(json.dumps({'projects': [], 'topics': {}, 'projectKinds': {}}))
            post = blog / 'sample-zh.md'
            post.write_text('---\nstatus: published\ntitle: Original\ndate: 2026-11-12\nlang: zh\n---\n# Body\nText')
            (blog / 'draft.md').write_text('---\nstatus: draft\ntitle: Hidden\n---\nNot public')
            calls = []

            def render(path):
                calls.append(path)
                return {'html': '<h1>Body</h1><p>Text</p>'}

            service = ContentService(catalog, blog, render=render)
            metadata = service.metadata()
            self.assertEqual([], calls)
            self.assertEqual(1, len(metadata['articles']))
            public = service.bundle()
            self.assertEqual(1, len(calls))
            for summary, article in zip(metadata['articles'], public['articles']):
                self.assertEqual(summary, {k: v for k, v in article.items() if k not in ('body', 'summary')})
            post.write_text(post.read_text().replace('Original', 'Updated'))
            self.assertEqual('Updated', service.metadata()['articles'][0]['title'])
            self.assertEqual(1, len(calls))
            post.unlink()
            self.assertEqual([], service.metadata()['articles'])


class PublicReads(unittest.IsolatedAsyncioTestCase):
    async def test_slow_render_yields_to_other_requests_and_keeps_etag_contract(self):
        package = types.ModuleType('_public_read_test')
        package.__path__ = []
        gate = threading.Event()

        class SlowService:
            def __init__(self, *args, **kwargs):
                pass

            def bundle(self):
                gate.wait(2)
                return {'articles': [], 'projects': []}

            def response(self):
                return self.bundle(), '"same"'

        replacements = {
            '_public_read_test': package,
            '_public_read_test.content_service': types.SimpleNamespace(ContentService=SlowService),
            '_public_read_test.ssr': types.SimpleNamespace(render=lambda *args: ('body', 200)),
        }
        try:
            sys.modules.update(replacements)
            root = Path(__file__).parent
            spec = importlib.util.spec_from_file_location('_public_read_test.production_adapter', root / 'production_adapter.py')
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            app = FastAPI()
            module.install(app, root=root, catalog_path=root / 'catalog.json', blog_dir=root)
            request = types.SimpleNamespace(headers={}, path_params={}, query_params={})
            for path in ('/static/content.json', '/'):
                route = next(r for r in app.routes if getattr(r, 'path', None) == path)
                gate.clear()
                timer = threading.Timer(.5, gate.set)
                timer.start()
                try:
                    start = time.monotonic()
                    task = asyncio.create_task(route.endpoint(request))
                    await asyncio.sleep(.05)
                    self.assertLess(time.monotonic() - start, .3)
                    self.assertEqual(200, (await task).status_code)
                finally:
                    gate.set()
                    timer.join()
            request.headers = {'if-none-match': '"same"'}
            route = next(r for r in app.routes if getattr(r, 'path', None) == '/static/content.json')
            self.assertEqual(304, (await route.endpoint(request)).status_code)
        finally:
            for name in replacements:
                sys.modules.pop(name, None)
