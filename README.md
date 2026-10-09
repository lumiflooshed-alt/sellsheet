# Sell Sheet Studio

Everything runs in the browser. Photos never leave the computer.

## Files
- `index.html` - the app
- `u2netp-model.wasm` - the background-removal model (keep it next to index.html)
- `ort-wasm-simd.wasm`, `ort-wasm.wasm` - the engine that runs the model

Keep all four files in the same folder.

## Run it on your own computer
The app has to be opened through a small local web server (double-clicking index.html will not load the photo cleaner).

1. Install Python from python.org if you don't have it (Mac and Linux already have it).
2. Open a terminal in this folder.
3. Run: `python3 -m http.server 8000`  (on Windows: `py -m http.server 8000`)
4. Open http://localhost:8000 in Chrome, Edge, Safari or Firefox.

An internet connection is still needed the first time for fonts and the PDF/Word tools.

## Sheets are saved per browser
Saved sheets live in that browser on that computer. Use the same browser each time.
