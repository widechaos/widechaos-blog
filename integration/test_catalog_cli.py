import json,os,subprocess,sys,tempfile,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
class CatalogCli(unittest.TestCase):
 def test_read_dry_run_apply_and_conflict(self):
  with tempfile.TemporaryDirectory() as directory:
   path=Path(directory)/'site-catalog.json';path.write_bytes((ROOT/'examples/site-catalog.json').read_bytes())
   from integration.site_catalog import dispatch
   before=path.read_bytes();initial=dispatch({'op':'site_catalog_get'},path)
   patch={'projects':[{'id':'router','status':'published','tag':'Reviewed'}]}
   payload={'op':'site_catalog_update','patch':patch,'expected_revision':initial['revision'],'authorization':'Fixture approval','source_reference':'https://example.org/work'}
   self.assertTrue(dispatch(payload,path)['dryRun']);self.assertEqual(before,path.read_bytes())
   dispatch({**payload,'dry_run':False},path)
   self.assertEqual(next(p for p in dispatch({'op':'site_catalog_get'},path)['catalog']['projects'] if p['id']=='router')['tag'],'Reviewed')
   with self.assertRaisesRegex(ValueError,'Catalog changed'):dispatch(payload,path)
if __name__=='__main__':unittest.main()
