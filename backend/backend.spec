# -*- mode: python ; coding: utf-8 -*-

import os
import sys
from PyInstaller.utils.hooks import collect_data_files, collect_submodules, copy_metadata
from PyInstaller.building.build_main import Analysis, PYZ, EXE, COLLECT

# =====================================================
# CONFIGURAZIONE AI (NUOVA)
# =====================================================
sys.setrecursionlimit(5000) # Necessario per Torch/SentenceTransformers

block_cipher = None

# =====================================================
# Determina la directory corrente (DAL TUO VECCHIO SPEC LINUX)
# =====================================================
try:
    this_dir = os.path.abspath(os.path.dirname(__file__))
except NameError:
    this_dir = os.getcwd()

# =====================================================
# Percorso del Virtual Environment (DAL TUO VECCHIO SPEC LINUX)
# =====================================================
venv_path = os.path.abspath(os.path.join(this_dir, '..', 'venv'))
# Nota: Assicurati che la versione python nel path sia corretta (es. 3.10)
venv_site_packages = os.path.join(venv_path, 'lib', 'python3.10', 'site-packages')

# =====================================================
# Percorsi di Python e librerie dinamiche (DAL TUO VECCHIO SPEC LINUX)
# =====================================================
python_main = '/usr/lib/python3.10'
if os.path.exists(os.path.join(python_main, 'lib-dynload')):
    python_dlls = os.path.join(python_main, 'lib-dynload')
elif os.path.exists('/usr/lib/x86_64-linux-gnu/lib-dynload'):
    python_dlls = '/usr/lib/x86_64-linux-gnu/lib-dynload'
else:
    python_dlls = os.path.join(python_main, 'lib-dynload')

# =====================================================
# Hidden Imports (FUSIONE VECCHIO + NUOVO AI)
# =====================================================
hidden_imports = [
    # --- I TUOI VECCHI IMPORT ---
    'ctypes.util', 'pyexpath', 'lib2to3.pgen2.driver', 'lib2to3.pygram', 'lib2to3.patcomp',
    'selenium', 'bs4', 'pandas', 'ctypes', 'Bio', 'Bio.Entrez', 'Bio.Medline',
    'selenium.webdriver.chrome.service', 'selenium.webdriver.common.by',
    'selenium.webdriver.support.ui', 'selenium.webdriver.support.expected_conditions',
    'selenium.common.exceptions',
    'flask', 'flask_cors', 'logging', 'queue', 'html5lib', 'scraper',
    'pkg_resources.py2_warn', 'json', 'urllib.parse',

    # --- NUOVI IMPORT PER AI (QDRANT / SENTENCE TRANSFORMERS) ---
    'sentence_transformers',
    'qdrant_client',
    'qdrant_client.http',
    'qdrant_client.grpc',
    'torch',
    'tqdm',
    'regex',
    'sklearn.utils._cython_blas',
    'sklearn.neighbors.typedefs',
    'sklearn.neighbors.quad_tree',
    'sklearn.tree._utils'
]

# =====================================================
# Datas (FUSIONE VECCHIO + NUOVO AI)
# =====================================================
datas = (
    # --- I TUOI VECCHI DATAS ---
    collect_data_files('flask') + 
    collect_data_files('Bio') + 
    collect_data_files('bs4') +
    collect_data_files('selenium') +
    collect_data_files('openpyxl') +
    collect_data_files('werkzeug') +
    collect_data_files('requests') +

    # --- NUOVI DATI AI ---
    collect_data_files('sentence_transformers') +
    collect_data_files('qdrant_client') +

    # --- METADATI ESSENZIALI (CRITICO PER LINUX AI) ---
    copy_metadata('regex') +
    copy_metadata('tqdm') +
    copy_metadata('requests') +
    copy_metadata('packaging') +
    copy_metadata('filelock') +
    copy_metadata('numpy') +
    copy_metadata('tokenizers') +
    copy_metadata('sentence_transformers') +
    copy_metadata('huggingface_hub') +
    copy_metadata('safetensors') +
    copy_metadata('torch')
)

# =====================================================
# Binaries (DAL TUO VECCHIO SPEC LINUX)
# =====================================================
additional_binaries = [
    (os.path.join(python_dlls, '_ssl.cpython-310-x86_64-linux-gnu.so'), '.'),
    (os.path.join(python_dlls, '_hashlib.cpython-310-x86_64-linux-gnu.so'), '.'),
    # Se servivano nel vecchio, meglio lasciarli. PyInstaller spesso li trova da solo, 
    # ma se avevi problemi di SSL, questo li risolve.
]

# =====================================================
# Analysis
# =====================================================
a = Analysis(
    ['app.py', 'scraper.py'],
    pathex=[
        this_dir,
        python_main,
        python_dlls,
        venv_site_packages
    ],
    binaries=additional_binaries,
    datas=datas,
    hiddenimports=hidden_imports,
    hookspath=[],
    runtime_hooks=[],
    # Escludiamo GUI inutili
    excludes=['tcl', 'tk', '_tkinter', 'tkinter', 'Tkinter', 'matplotlib', 'PyQt5'],
    cipher=block_cipher,
    noarchive=False
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

# =====================================================
# EXE (MODIFICATO PER APPIMAGE -> CARTELLA)
# =====================================================
exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True, # IMPORTANTE: True crea una cartella, non un file singolo
    name='backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None
)

# =====================================================
# COLLECTION (PER CREARE LA CARTELLA dist/backend)
# =====================================================
coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='backend'
)
