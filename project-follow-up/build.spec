# -*- mode: python ; coding: utf-8 -*-

block_cipher = None

a = Analysis(
    ['app/Proje_Takibi.py'],
    pathex=[],
    binaries=[],
    datas=[
        ('app/static/*', 'static'),
        ('app/data', 'data')
    ],
    hiddenimports=[],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)
pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='ProjectTracker',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,  # Konsol penceresini gizle
    icon=None,      # İkon dosyası eklemek isterseniz yolu belirtin
)