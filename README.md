# Rakaposhica Dashboard

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

## Assistant (fills in the sell sheet for you)
Open the **Assistant** tab on the sell sheet page, paste anything about the product (a supplier email, a packing list, your notes, or text from a PDF/Word file), and click **Fill the sheet**. It fills in the name, item code, price, sizes, packing, colours and details, and tidies the wording.

- It is a small open-source language model (Qwen 2.5, run with WebLLM) that runs **inside the browser**. Nothing you paste is sent anywhere, and no server or API key is needed.
- The first time, it downloads the model (about 2 GB, or about 1 GB for the Light option) and keeps it in that browser. After that it starts in seconds and works offline.
- It needs a recent Chrome, Edge or Safari on a computer with a graphics chip (WebGPU). Phones and very old computers may not manage it.
- Always check what it wrote: it can make mistakes. **Undo** appears right after it fills the sheet.

## Sheets are saved per browser
Saved sheets live in that browser on that computer. Use the same browser each time.
