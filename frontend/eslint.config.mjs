// ESLint 9 flat config. `next lint` was removed in Next 16, so `npm run lint`
// runs ESLint directly with the presets from eslint-config-next.
import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    '.next/**',
    'out/**',
    'android-web/**', // Android web bundle (scripts/android/build-web.mjs)
    'android/**', // Gradle project, including the copied web assets
    'build/**',
    'next-env.d.ts',
  ]),
]);
