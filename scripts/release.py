"""Build a Windows distribution from the locked, already fetched build inputs."""
import argparse
import hashlib
import json
import re
import struct
import subprocess
import tomllib
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXTRA = ROOT / 'scripts/licenses'
TARGET = 'x86_64-pc-windows-msvc'


def check(condition, message):
    if not condition:
        raise ValueError(message)


def read_json(path):
    return json.loads(path.read_bytes())


def validate_version(tag):
    number = r'(?:0|[1-9][0-9]*)'
    check(re.fullmatch(fr'{number}\.{number}\.{number}', tag), 'expected a plain MAJOR.MINOR.PATCH tag')
    versions = [read_json(ROOT / p)['version'] for p in ('package.json', 'src-tauri/tauri.conf.json')]
    versions.append(tomllib.loads((ROOT / 'src-tauri/Cargo.toml').read_text('utf8'))['package']['version'])
    check(all(v == tag for v in versions), f'tag {tag} disagrees with application versions {versions}')


def legal_files(directory):
    for path in sorted(directory.rglob('*')):
        if path.is_file() and (re.match(r'(?i)^(?:licen[cs]e|unlicense|notice|copying|copyright)(?:$|[^a-z])', path.name)
                               or 'licenses' in [p.lower() for p in path.relative_to(directory).parts[:-1]]):
            yield path


def collect():
    files = {}
    index = ['Third-party notices for Resume Studio (Windows x64)',
             'Keep these files with the executable. See licenses/ for original notices.',
             'Unmodified MPL-2.0 covered source is included in sources/ under that license.', '']
    lock = read_json(ROOT / 'package-lock.json')['packages']
    browser = {k for k, v in lock.items() if k and not v.get('dev') and not v.get('optional')}
    expected = {'react', 'react-dom', 'scheduler', '@tauri-apps/api', 'pdfjs-dist'}
    check(browser == {'node_modules/' + n for n in expected}, 'review changed browser dependency closure')
    for name in sorted(expected | {'vite', 'rollup'}):
        key = 'node_modules/' + name
        base = ROOT / key
        pkg = read_json(base / 'package.json')
        check(pkg['version'] == lock[key]['version'], f'run npm ci: {name}')
        prefix = f"licenses/npm/{name}-{pkg['version']}"
        index.append(f"{prefix}: {pkg['license']}")
        paths = [p for p in base.iterdir() if p.is_file() and p.name.lower().startswith(('license', 'notice'))]
        check(paths, f'no notices: {name}')
        if name == 'pdfjs-dist':
            check(pkg['version'] == '5.7.284', 'review PDF.js resource and supplemental licenses')
            for resource in ('cmaps', 'iccs', 'standard_fonts', 'wasm'):
                notices = list(legal_files(base / resource))
                check(notices, f'missing notices: {resource}')
                paths.extend(notices)
            index.append('PDF.js browser bundles: Copyright 2024 Mozilla Foundation. Supplemental WASM and JS terms in licenses/supplemental/.')
        for path in paths:
            files[f'{prefix}/{path.relative_to(base).as_posix()}'] = path.read_bytes()

    args = ['cargo', 'metadata', '--manifest-path', 'src-tauri/Cargo.toml', '--offline', '--locked',
            '--format-version', '1', '--features', 'custom-protocol', '--filter-platform', TARGET]
    metadata = json.loads(subprocess.check_output(args, cwd=ROOT))
    crates = {(p['name'], p['version']): p for p in metadata['packages'] if p['id'] != metadata['resolve']['root']}
    roots = {k: Path(p['manifest_path']).parent for k, p in crates.items()}
    for key, pkg in sorted(crates.items()):
        name, version = key
        base = roots[key]
        prefix = f'licenses/cargo/{name}-{version}'
        license_id = pkg['license'] or ''
        allowed = {'MIT', 'Apache-2.0', 'MPL-2.0', 'Zlib', 'Unicode-3.0', 'Unlicense', 'BSD-3-Clause', '0BSD', 'CC0-1.0', 'MIT-0'}
        terms = set(re.findall(r'[\w.-]+', license_id)) - {'AND', 'OR'}
        check(terms and terms <= allowed and pkg['source'] == 'registry+https://github.com/rust-lang/crates.io-index',
              f'review new source/license: {key}: {license_id}')
        paths = list(legal_files(base))
        index.append(f'{prefix}: {license_id}')
        for path in paths:
            files[f'{prefix}/{path.relative_to(base).as_posix()}'] = path.read_bytes()
        if not paths:
            if key == ('alloc-stdlib', '0.3.0'):
                fallback = roots['alloc-no-stdlib', '3.0.0'] / 'LICENSE'
            elif name == 'selectors' and license_id == 'MPL-2.0':
                fallback = roots['cssparser', '0.37.0'] / 'LICENSE'
            elif key in {('webview2-com', '0.39.1'), ('webview2-com-sys', '0.39.1'), ('webview2-com-macros', '0.8.1')}:
                fallback = EXTRA / 'webview2-rs-MIT.txt'
            else:
                raise ValueError(f'missing license text: {key}')
            files[f'{prefix}/LICENSE'] = fallback.read_bytes()
        if 'MPL-2.0' in terms:
            for path in base.rglob('*'):
                if path.is_file() and path.name not in {'.cargo-ok', '.cargo-checksum.json'}:
                    files[f'sources/{name}-{version}/{path.relative_to(base).as_posix()}'] = path.read_bytes()
    loader = roots['webview2-com-sys', '0.39.1'] / 'x64/WebView2LoaderStatic.lib'
    check(hashlib.sha256(loader.read_bytes()).hexdigest() == '89c6b872783b8f6c3cedbff618adb42082d455c615453ae10cfc753f1e8f25d8', 'review changed WebView2 SDK loader')
    for name in ('WebView2-SDK-LICENSE', 'WebView2-SDK-NOTICE', 'quickjs', 'quickjs-wrapper', 'pdfjs-brotli', 'webpack', 'emscripten', 'wasm-musl'):
        files[f'licenses/supplemental/{name}.txt'] = (EXTRA / (name + '.txt')).read_bytes()
    sysroot = Path(subprocess.check_output(['rustc', '--print', 'sysroot'], text=True).strip())
    rust = sysroot / 'share/doc/rust'
    files['licenses/rust/COPYRIGHT-library.html'] = (rust / 'COPYRIGHT-library.html').read_bytes()
    for path in sorted((rust / 'licenses').glob('*.txt')):
        files[f'licenses/rust/licenses/{path.name}'] = path.read_bytes()
    index.extend(['', 'Rust library: licenses/rust/COPYRIGHT-library.html',
                  'Microsoft WebView2 SDK 1.0.3800.47 loader: licenses/supplemental/WebView2-SDK-{LICENSE,NOTICE}.txt'])
    files['THIRD-PARTY-NOTICES.txt'] = ('\n'.join(index) + '\n').encode()
    return files


def package(version, exe, output):
    validate_version(version)
    data = exe.read_bytes()
    check(data.startswith(b'MZ') and len(data) >= 64, 'expected a Windows executable')
    offset, = struct.unpack_from('<I', data, 60)
    check(data[offset:offset+6] == b'PE\0\0\x64\x86', 'expected an AMD64 executable')
    files = collect()
    files.update({'resume-studio.exe': data, 'LICENSE': (ROOT / 'LICENSE').read_bytes(),
                  'README.md': (ROOT / 'README.md').read_bytes()})
    output.mkdir(exist_ok=True, parents=True)
    archive = output / f'resume-studio-{version}-windows-x64.zip'
    with zipfile.ZipFile(archive, 'w') as z:
        for name, content in sorted(files.items()):
            info = zipfile.ZipInfo(name)  # fixed timestamp; no host filesystem metadata
            info.create_system = 3
            info.external_attr = 0o100644 << 16
            z.writestr(info, content, compress_type=zipfile.ZIP_DEFLATED)
    digest = hashlib.sha256(archive.read_bytes()).hexdigest()
    archive.with_suffix('.zip.sha256').write_bytes(f'{digest}  {archive.name}\n'.encode())
    return archive


if __name__ == '__main__':
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument('version')
    cli.add_argument('--check-tag', action='store_true')
    cli.add_argument('--exe', type=Path, default=ROOT / f'src-tauri/target/{TARGET}/release/resume-studio.exe')
    cli.add_argument('--out', type=Path, default=ROOT / 'release-assets')
    args = cli.parse_args()
    if args.check_tag:
        validate_version(args.version)
    else:
        print(package(args.version, args.exe, args.out))
