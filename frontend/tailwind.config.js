import colors from 'tailwindcss/colors';
import defaultTheme from 'tailwindcss/defaultTheme';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      // Semantic alias for the app's one brand/primary hue (buttons, active
      // nav, wordmark) — aliases Tailwind's own indigo scale rather than
      // hand-picked hex values, so contrast/accessibility is inherited from
      // an already-vetted palette. The existing slate/green/amber/red/blue/
      // purple/orange usage stays untouched — those carry approval-gate/
      // confidence/health/severity meaning and are not part of this alias.
      colors: {
        brand: colors.indigo,
      },
      fontFamily: {
        sans: ['Inter', ...defaultTheme.fontFamily.sans],
      },
    },
  },
  plugins: [],
};
