import { Alert, Button, Card, Field, Input, Select, tokens } from "@partnera/ui";
import { type DemoWorld } from "../demo";

/**
 * Login screen (auth preparation). No real provider is connected — this dev
 * screen signs in as a seeded user with no credential check, purely so the apps
 * are explorable. The form shape (email + scope) is what a real provider fills.
 */
export function loginPage(world: DemoWorld, error?: string): JSX.Element {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: tokens.space.xl,
      }}
    >
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ display: "flex", alignItems: "center", gap: tokens.space.sm, marginBottom: tokens.space.lg }}>
          <span aria-hidden style={{ width: 30, height: 30, borderRadius: 8, background: tokens.color.primary, display: "inline-block" }} />
          <h1 style={{ margin: 0, fontSize: tokens.font.size.xl }}>Partnera</h1>
        </div>
        <Card title="Sign in">
          {error ? (
            <div style={{ marginBottom: tokens.space.md }}>
              <Alert intent="danger">{error}</Alert>
            </div>
          ) : null}
          <form method="post" action="/login">
            <Field label="Email" htmlFor="email" required>
              <Input id="email" name="email" type="email" defaultValue={world.users.owner} required />
            </Field>
            <Field label="Open" htmlFor="scope">
              <Select
                id="scope"
                name="scope"
                options={[
                  { value: "business", label: "Business Dashboard" },
                  { value: "affiliate", label: "Affiliate Portal" },
                  { value: "creator", label: "Creator Portal" },
                  { value: "admin", label: "Admin Console" },
                ]}
              />
            </Field>
            <Button type="submit" fullWidth style={{ marginTop: tokens.space.md }}>
              Continue
            </Button>
          </form>

          <div style={{ marginTop: tokens.space.lg, fontSize: tokens.font.size.sm, color: tokens.color.textMuted }}>
            <strong style={{ color: tokens.color.text }}>Demo users</strong>
            <ul style={{ margin: `${tokens.space.sm} 0 0`, paddingLeft: tokens.space.lg }}>
              <li>{world.users.owner} — business owner</li>
              <li>{world.users.finance} — finance</li>
              <li>{world.users.affiliate} — affiliate (Brian)</li>
              <li>{world.users.creator} — creator (Cora)</li>
              <li>{world.users.admin} — platform admin</li>
            </ul>
          </div>
        </Card>
        <p style={{ color: tokens.color.textMuted, fontSize: tokens.font.size.xs, marginTop: tokens.space.md, textAlign: "center" }}>
          Auth provider not connected · OAuth / SSO / MFA seams prepared (docs/24)
        </p>
      </div>
    </div>
  );
}
