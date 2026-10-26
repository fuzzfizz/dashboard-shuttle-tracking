import { execSync } from 'child_process';

const env = { ...process.env };

// Auto-alias: if SUPABASE_URL is provided, automatically forward it to VITE_SUPABASE_URL
if (env.SUPABASE_URL && !env.VITE_SUPABASE_URL) {
  env.VITE_SUPABASE_URL = env.SUPABASE_URL;
  console.log('[Build] Auto-aliased VITE_SUPABASE_URL from SUPABASE_URL.');
}

console.log('[Build] 1/2 Building frontend...');
execSync('npm install --prefix frontend && npm run build --prefix frontend', {
  stdio: 'inherit',
  env,
});

console.log('[Build] 2/2 Installing tools dependencies...');
execSync('npm install --prefix tools', {
  stdio: 'inherit',
  env,
});

console.log('[Build] All-in-One build completed successfully!');
