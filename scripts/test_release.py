import hashlib
import os
import tempfile
import unittest
from pathlib import Path
from zipfile import ZipFile

from release import ROOT, TARGET, package, read_json, validate_version

VERSION = read_json(ROOT / 'package.json')['version']


class ReleaseTest(unittest.TestCase):
    def test_version(self):
        validate_version(VERSION)
        for bad in ('v0.1.0', '00.1.0', '0.1.0-rc.1', '0.1.0+build', '0.1', '../0.1.0', VERSION + '0'):
            with self.subTest(bad=bad), self.assertRaises(ValueError):
                validate_version(bad)

    def test_distribution(self):
        exe = Path(os.environ.get('RELEASE_TEST_EXE', ROOT / f'src-tauri/target/{TARGET}/release/resume-studio.exe'))
        with tempfile.TemporaryDirectory(dir=ROOT / 'scripts') as tmp:
            archive = package(VERSION, exe, Path(tmp))
            digest = hashlib.sha256(archive.read_bytes()).hexdigest()
            self.assertEqual(archive.with_suffix('.zip.sha256').read_bytes(), f'{digest}  {archive.name}\n'.encode())
            with ZipFile(archive) as z:
                self.assertIsNone(z.testzip())
                self.assertEqual(z.read('resume-studio.exe'), exe.read_bytes())
                names = z.namelist()
                self.assertEqual(names, sorted(set(names)))
                for required in ('cmaps/LICENSE', 'iccs/LICENSE', 'standard_fonts/LICENSE_FOXIT',
                                 'standard_fonts/LICENSE_LIBERATION', 'wasm/LICENSE_QCMS', 'wasm/LICENSE_JBIG2',
                                 'wasm/LICENSE_OPENJPEG', 'WebView2-SDK-NOTICE.txt', 'quickjs.txt'):
                    self.assertTrue(any(n.endswith('/' + required) for n in names), required)
                self.assertTrue(any(n.startswith('sources/selectors-') and n.endswith('/lib.rs') for n in names))
                self.assertIn('MPL-2.0', z.read('THIRD-PARTY-NOTICES.txt').decode())
            self.assertEqual(hashlib.sha256(package(VERSION, exe, Path(tmp)).read_bytes()).hexdigest(), digest)
            with self.assertRaisesRegex(ValueError, 'Windows executable'):
                package(VERSION, ROOT / 'package.json', Path(tmp))


if __name__ == '__main__':
    unittest.main()
