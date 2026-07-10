export function ConfigErrorPage() {
  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <div className="max-w-md space-y-3 text-sm">
        <h1 className="text-lg font-semibold">Noto is not configured yet</h1>
        <p className="text-muted-foreground">
          The Supabase connection settings are missing from this build. Provide both environment
          variables and rebuild:
        </p>
        <pre className="rounded-md bg-muted p-3 text-xs">
          {'VITE_SUPABASE_URL\nVITE_SUPABASE_PUBLISHABLE_KEY'}
        </pre>
        <p className="text-muted-foreground">
          Copy <code>.env.example</code> to <code>.env</code> for local development, or set GitHub
          repository variables for the Pages deployment. See README → “Supabase project setup”.
        </p>
      </div>
    </div>
  )
}
