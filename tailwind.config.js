/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: 'var(--text-ink, #15191C)',
          soft: 'var(--text-ink-soft, #4A5359)',
        },
        paper: {
          DEFAULT: 'var(--bg-paper, #F6F7F5)',
          raised: 'var(--bg-paper-raised, #FFFFFF)',
        },
        line: 'var(--border-line, #D7DBD8)',
        blueprint: 'var(--color-blueprint, #1E5C8C)',
        signal: 'var(--color-signal, #D45B33)',
      },
      fontFamily: {
        sans: ['"Space Grotesk"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      borderRadius: {
        none: '0px',
      },
    },
  },
  plugins: [],
}
