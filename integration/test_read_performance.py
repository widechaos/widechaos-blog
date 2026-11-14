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

class BoundedPublicReads(unittest.IsolatedAsyncioTestCase):
    async def test_mixed_reads_share_limit_until_encoding_and_release_after_failure(self):
        from unittest.mock import patch
        from fastapi.responses import HTMLResponse, JSONResponse
        package = types.ModuleType('_bounded_public_test')
        package.__path__ = []
        release = threading.Event()
        lock = threading.Lock()
        entered = []
        active = 0
        peak = 0
        event_thread = threading.get_ident()

        class Source:
            def __init__(self, *args, **kwargs):
                pass

            def bundle(self):
                return {'articles': [], 'projects': []}

            def response(self):
                return self.bundle(), '"same"'

        class TrackedHTML(HTMLResponse):
            def render(self, content):
                nonlocal active, peak
                self_test.assertNotEqual(event_thread, threading.get_ident())
                with lock:
                    active += 1
                    peak = max(peak, active)
                    entered.append('html')
                try:
                    release.wait(3)
                    return super().render(content)
                finally:
                    with lock:
                        active -= 1

        class TrackedJSON(JSONResponse):
            def render(self, content):
                nonlocal active, peak
                self_test.assertNotEqual(event_thread, threading.get_ident())
                with lock:
                    active += 1
                    peak = max(peak, active)
                    entered.append('json')
                try:
                    release.wait(3)
                    return super().render(content)
                finally:
                    with lock:
                        active -= 1

        self_test = self
        replacements = {
            '_bounded_public_test': package,
            '_bounded_public_test.content_service': types.SimpleNamespace(ContentService=Source),
            '_bounded_public_test.ssr': types.SimpleNamespace(render=lambda *args: ('<p>Original</p>', 200)),
        }
        with patch.dict(sys.modules, replacements):
            root = Path(__file__).parent
            spec = importlib.util.spec_from_file_location('_bounded_public_test.production_adapter', root / 'production_adapter.py')
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            module.HTMLResponse, module.JSONResponse = TrackedHTML, TrackedJSON
            app = FastAPI()
            module.install(app, root=root, catalog_path=root / 'catalog.json', blog_dir=root)
            page = next(r.endpoint for r in app.routes if getattr(r, 'path', None) == '/')
            content = next(r.endpoint for r in app.routes if getattr(r, 'path', None) == '/static/content.json')
            request = types.SimpleNamespace(headers={}, path_params={}, query_params={})
            jobs = [asyncio.create_task((page if i % 2 else content)(request)) for i in range(12)]
            try:
                for _ in range(100):
                    if len(entered) == 2:
                        break
                    await asyncio.sleep(.01)
                self.assertEqual(2, len(entered))
                self.assertEqual(2, peak)
                self.assertTrue(all(not task.done() for task in jobs))
            finally:
                release.set()
            responses = await asyncio.wait_for(asyncio.gather(*jobs), 4)
            self.assertTrue(all(r.status_code == 200 for r in responses))
            self.assertEqual(2, peak)
            self.assertEqual(12, len(entered))
            self.assertIn(b'<p>Original</p>', [r.body for r in responses])
            request.headers = {'if-none-match': '"same"'}
            unchanged = await content(request)
            self.assertEqual((304, b'', '"same"'), (unchanged.status_code, unchanged.body, unchanged.headers['etag']))

            def failed_render(*args):
                raise RuntimeError('read failed')

            module.render = failed_render
            self.assertEqual(503, (await page(request)).status_code)
            module.render = lambda *args: ('Recovered', 200)
            self.assertEqual(b'Recovered', (await page(request)).body)
