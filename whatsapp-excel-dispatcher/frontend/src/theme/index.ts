import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react';

const config = defineConfig({
  theme: {
    tokens: {
      colors: {
        brand: {
          50: { value: '#e8faf0' },
          100: { value: '#c5f2d8' },
          200: { value: '#9eeabd' },
          300: { value: '#6fdfa0' },
          400: { value: '#4ad688' },
          500: { value: '#25D366' }, // WhatsApp green
          600: { value: '#1fba59' },
          700: { value: '#189e4b' },
          800: { value: '#11823d' },
          900: { value: '#0a5e2c' },
        },
        surface: {
          dark: { value: '#0a0e17' },
          card: { value: '#111827' },
          cardHover: { value: '#1a2332' },
          border: { value: '#1f2937' },
          borderLight: { value: '#374151' },
        },
        accent: {
          purple: { value: '#a855f7' },
          blue: { value: '#3b82f6' },
          amber: { value: '#f59e0b' },
          rose: { value: '#f43f5e' },
          teal: { value: '#14b8a6' },
          cyan: { value: '#06b6d4' },
        },
      },
      fonts: {
        heading: { value: '"Inter", system-ui, sans-serif' },
        body: { value: '"Inter", system-ui, sans-serif' },
      },
    },
  },
});

export const system = createSystem(defaultConfig, config);
