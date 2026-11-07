import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  plugins: process.env.SINGLE ? [react(), viteSingleFile()] : [react()],
});
