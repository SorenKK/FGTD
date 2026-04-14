# -*- mode: python ; coding: utf-8 -*-

import os
import sys
from PyInstaller.utils.hooks import collect_data_files, collect_submodules, copy_metadata
from PyInstaller.building.build_main import Analysis, PYZ, EXE

# --- CONFIGURAZIONE ---
# Aumentiamo il limite per gestire le librerie AI
sys.setrecursionlimit(5000)

block_cipher = None

# --- PERCORSI (Dal tuo vecchio spec funzionante) ---
python_main = r'C:\Users\UN2\AppData\Local\Programs\Python\Python312'
python_dlls = os.path.join(python_main, 'DLLs')

venv_path = r'C:\Users\UN2\Desktop\1.0.3_fgtd\venv'
venv_site_packages = os.path.join(venv_path, 'Lib', 'site-packages')

# --- HIDDEN IMPORTS ---
# Ho unito i tuoi vecchi import con quelli NECESSARI per l'AI
hidden_imports = [
    # --- I tuoi vecchi import funzionanti ---
    'ctypes.util', 'ctypes.macholib.dyld', 'pyexpath',
    'lib2to3.pgen2.driver', 'lib2to3.pygram', 'lib2to3.patcomp',
    'selenium', 'bs4', 'pandas', 'ctypes', 'numpy',
    'Bio', 'Bio.Entrez', 'Bio.Medline',
    'selenium.webdriver.chrome.service', 'selenium.webdriver.common.by',
    'selenium.webdriver.support.ui', 'selenium.webdriver.support.expected_conditions',
    'selenium.common.exceptions',
    'webdriver_manager.chrome',
    'flask', 'flask_cors', 'logging', 'queue', 'html5lib', 'scraper','json', 'urllib.parse'
    'pkg_resources.py2_warn',
    
    # --- NUOVI IMPORT PER QDRANT E SENTENCE TRANSFORMERS ---
    # (Senza questi l'app crasha appena provi a caricare il modello)
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

# --- DATAS ---
# Qui uniamo i tuoi vecchi datas con i metadati necessari per l'AI
datas = (
    # --- I TUOI VECCHI DATAS ---
    collect_data_files('flask') + 
    collect_data_files('Bio') + 
    collect_data_files('bs4') +
    collect_data_files('selenium') +
    collect_data_files('openpyxl') +
    collect_data_files('werkzeug') +
    collect_data_files('requests') +
    collect_data_files('webdriver_manager') +

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

# --- BINARIES (Dal tuo vecchio spec funzionante) ---
additional_binaries = [
    (os.path.join(python_dlls, 'pyexpat.pyd'), '.'),
    (os.path.join(python_dlls, '_socket.pyd'), '.'),
    (os.path.join(python_dlls, '_ssl.pyd'), '.'),
    (os.path.join(python_dlls, '_hashlib.pyd'), '.'),
    (os.path.join(python_dlls, 'unicodedata.pyd'), '.'),
    (os.path.join(python_dlls, 'select.pyd'), '.')
]

a = Analysis(
    ['app.py', 'scraper.py'],
    pathex=[
        os.path.abspath(os.path.dirname("app.py")),
        python_main,
        python_dlls,
        venv_site_packages
    ],
    binaries=additional_binaries,
    datas=datas,
    hiddenimports=hidden_imports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['tcl', 'tk', '_tkinter', 'tkinter', 'Tkinter'], # Exclude GUI stuff
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None
)