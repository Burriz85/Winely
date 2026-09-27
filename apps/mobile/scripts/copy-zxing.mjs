// Legger strekkode-dekoderen (WASM) i public/, så webappen ikke er avhengig av jsDelivr-CDN.
// Brukes av nettlesere uten innebygd BarcodeDetector, blant annet Safari på iPhone.
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
// Samme zxing-wasm som barcode-detector (og dermed expo-camera) bruker.
const src = require.resolve('zxing-wasm/reader/zxing_reader.wasm', { paths: [dirname(require.resolve('barcode-detector'))] });
const out = join(import.meta.dirname, '..', 'public');
mkdirSync(out, { recursive: true });
copyFileSync(src, join(out, 'zxing_reader.wasm'));
console.log('zxing_reader.wasm → public/');
