/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{ts,js,html}',
    './stitch_vacatina_master_ui_foundation/**/*.html'
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#1B1464',
          canvas: '#FAFAFA',
          surface: '#FFFFFF',
          subtle: '#F5F5F5',
          border: '#E5E5E5',
          muted: '#525252',
          black: '#000000',
          success: '#15803D',
          warning: '#B45309',
          error: '#B91C1C',
          info: '#1D4ED8'
        }
      },
      fontFamily: {
        heading: ['"Plus Jakarta Sans"', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'sans-serif'],
        sans: ['"Inter"', 'sans-serif']
      },
      keyframes: {
        'fade-in': { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        'slide-up': { '0%': { transform: 'translateY(8px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        'scale-in': { '0%': { transform: 'scale(0.95)', opacity: '0' }, '100%': { transform: 'scale(1)', opacity: '1' } }
      },
      animation: {
        'fade-in': 'fade-in 200ms ease-out',
        'slide-up': 'slide-up 250ms ease-out',
        'scale-in': 'scale-in 200ms ease-out'
      }
    }
  },
  plugins: []
};
