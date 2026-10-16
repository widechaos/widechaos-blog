"""Run the development preview using the production public article feed."""
import os,sys
from pathlib import Path
root=Path(__file__).resolve().parent
os.execv(sys.executable,[sys.executable,str(root/'integration/preview_server.py'),'--public-web','--port',os.environ.get('PORT','9567')])
