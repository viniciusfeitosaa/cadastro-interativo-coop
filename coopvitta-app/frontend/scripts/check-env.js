/**
 * No Netlify: falha o build se VITE_API_URL não estiver definida ou for localhost.
 * Loga o valor no build para conferir no log do Netlify.
 */
const url = process.env.VITE_API_URL || '';
const isNetlify = process.env.NETLIFY === 'true';

console.log('[check-env] VITE_API_URL no build:', url ? url.replace(/:[^:@]+@/, ':****@') : '(não definida)');

if (isNetlify && (!url || url.includes('localhost'))) {
  console.error('');
  console.error('❌ No Netlify, defina VITE_API_URL (ex.: https://appvs.onrender.com/api).');
  console.error('   Site configuration → Environment variables → VITE_API_URL');
  console.error('   Base directory do site deve ser: frontend');
  console.error('');
  process.exit(1);
}
