type PublicEnv = {
  supabaseUrl: string;
  supabasePublishableKey: string;
};

function requirePublicEnv(name: string, value: string | undefined): string {
  if (!value || value.startsWith('replace-with-')) {
    throw new Error(`Missing ${name}. Copy .env.example to .env.local and set a public client value.`);
  }
  return value;
}

export function getPublicEnv(): PublicEnv {
  return {
    supabaseUrl: requirePublicEnv('EXPO_PUBLIC_SUPABASE_URL', process.env.EXPO_PUBLIC_SUPABASE_URL),
    supabasePublishableKey: requirePublicEnv(
      'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
      process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    ),
  };
}

