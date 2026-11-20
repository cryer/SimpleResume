# Desktop PDF renderer

`invoke('render_pdf', { doc })` accepts the editor document only and returns PDF bytes. Install **TeX Live** with `xelatex`, `xdvipdfmx`, `ctex`, `geometry` and Fandol fonts; make both executables available via absolute directories on `PATH`. No TeX engine or TeX typesetting fonts are bundled. PDF.js preview resources have separate third-party licenses. Run `npm run desktop` from the project root for development.

The local `main` window alone is granted `allow-render-pdf` and `allow-download-pdf`. The latter accepts a raw PDF payload and a percent-encoded filename stem (`x-resume-name`), never a destination path. It sanitizes the name, creates a non-overwriting file in the OS Downloads directory and asks the file manager to select that file. The receipt includes the actual path even if selection fails. No generic shell, opener, or filesystem permission is granted.

The local `main` window is the only window granted the render permission. The backend rejects concurrent calls rather than building an unbounded queue. It checks field lengths, controls, unique IDs, 64 sections, 8–20 pt and a combined 512 KiB text limit before generating a fixed, escaped TeX template. Two directly supervised subprocesses share a 20 s deadline and an isolated temporary working directory. Output is limited to an 8 MiB PDF and workspace size is polled against 24 MiB.

Trust boundary: the installed TeX programs, configuration, system fonts and local account are trusted. Shell escape is disabled, inherited TeX settings are cleared, and Kpathsea uses paranoid file-open policies. These restrictions are **not an OS sandbox or a hard disk/memory quota**. Do not expose the command as an untrusted network compilation service or add raw TeX, user templates or file paths to the document schema without stronger isolation.

Rust verification: `cargo fmt --check`, `cargo test --locked`, `cargo check --locked` from this directory. Unit tests exercise subprocess failure and timeout without depending on a TeX installation. Actual typesetting additionally requires the TeX tools above.
