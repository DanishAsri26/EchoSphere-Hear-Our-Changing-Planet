# Tesseract.js (vendored)

Used only by the picture tool's "Find legend automatically" button (`web/js/legendfind.js`), loaded on click.
Runs in the browser; pictures are not uploaded.

| File | Source | Licence |
|---|---|---|
| tesseract.min.js, worker.min.js | [tesseract.js](https://github.com/naptha/tesseract.js) 5.1.1 (npm) | Apache-2.0 (LICENSE.md) |
| tesseract-core-simd-lstm.wasm.js, tesseract-core-lstm.wasm.js | [tesseract.js-core](https://github.com/naptha/tesseract.js-core) 5.1.1 (Tesseract OCR compiled to WebAssembly) | Apache-2.0 |
| eng.traineddata.gz | [@tesseract.js-data/eng](https://www.npmjs.com/package/@tesseract.js-data/eng) 1.0.0, 4.0.0_best_int (from tesseract-ocr/tessdata) | Apache-2.0 |

A browser downloads one core (3.9 MB, SIMD or not) + English data (2.9 MB) + scripts (0.2 MB), about 7 MB, the first time.
