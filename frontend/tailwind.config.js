import colors from 'tailwindcss/colors';
import defaultTheme from 'tailwindcss/defaultTheme';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      // ProjectIQ brand palette (from ProjectIQ_Brand_Assets_Manifest.json).
      // `brand` = the primary ACTION hue (Bright Cyan #00B6D1) used for
      // buttons, links, active nav, focus rings — a full 50..950 ramp so every
      // existing `brand-<shade>` utility keeps resolving. The semantic
      // slate/green/amber/red/blue/purple/orange usage stays untouched — those
      // encode approval-gate / confidence / health / severity meaning.
      // Additive named tokens (navy/cyan/mint/coral/neutral) let components
      // use brand colours directly without clobbering any Tailwind default
      // scale. `white` needs no token — Tailwind's built-in `white` already
      // resolves to #FFFFFF.
      colors: {
        brand: {
          50: '#ECFDFF',
          100: '#CFF7FD',
          200: '#A5EEF8',
          300: '#67E0F0',
          400: '#22C9E4',
          500: '#00B6D1',
          600: '#0093AD',
          700: '#0A7488',
          800: '#155E6E',
          900: '#164E5C',
          950: '#083240',
        },
        navy: '#0D1B3D',
        cyan: '#00B6D1',
        mint: '#C6F3E6',
        coral: '#FF7A59',
        neutral: '#F2F4F7',
      },
      fontFamily: {
        sans: ['Manrope', 'Arial', ...defaultTheme.fontFamily.sans],
      },
    },
  },
  plugins: [],
};
