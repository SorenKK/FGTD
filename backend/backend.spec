# -*- mode: python ; coding: utf-8 -*-

import os
import sys
from PyInstaller.utils.hooks import collect_data_files, collect_submodules
from PyInstaller.building.build_main import Analysis, PYZ, EXE

block_cipher = None

# Percorsi Python (usando il Python principale invece del venv per le DLL)
python_main = r'C:\Users\UN2\AppData\Local\Programs\Python\Python312'  # Percorso Python principale
python_dlls = os.path.join(python_main, 'DLLs')

# Percorso del venv
venv_path = r'C:\Users\UN2\Desktop\progetto-app-backup\.venv'
venv_site_packages = os.path.join(venv_path, 'Lib', 'site-packages')

hidden_imports = [
    'ctypes.util',
    'ctypes.macholib.dyld',
    'pyexpath',
    'lib2to3.pgen2.driver',
    'lib2to3.pygram',
    'lib2to3.patcomp',
    'selenium',
    'bs4',
    'pandas',
    'ctypes',
    'Bio',
    'Bio.Entrez',
    'Bio.Medline',
    'selenium.webdriver.chrome.service',
    'selenium.webdriver.common.by',
    'selenium.webdriver.support.ui',
    'selenium.webdriver.support.expected_conditions',
    'selenium.common.exceptions',
    'webdriver_manager.chrome',
    'flask',
    'flask_cors',
    'logging',
    'queue',
    'html5lib',
    'scraper',
    'pkg_resources.py2_warn'
]

datas = (collect_data_files('flask') + 
    collect_data_files('Bio') + 
    collect_data_files('bs4') +
    collect_data_files('selenium') +
    collect_data_files('openpyxl') +
    collect_data_files('werkzeug') +
    collect_data_files('requests') +
    collect_data_files('webdriver_manager')
)

# Aggiungi le DLL dal Python principale
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
    excludes=['tcl', 'tk', '_tkinter', 'tkinter', 'Tkinter'],
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