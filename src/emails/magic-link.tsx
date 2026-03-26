import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import { oklchToHex } from "~/lib/utils";

const t = {
  bg: oklchToHex(0.98, 0, 0),
  card: oklchToHex(1, 0, 0),
  fg: oklchToHex(0.14, 0.01, 280),
  muted: oklchToHex(0.52, 0.02, 280),
  primary: oklchToHex(0.52, 0.22, 280),
  border: oklchToHex(0.88, 0.005, 280),
};

export function MagicLinkEmail({ url }: { url: string }) {
  return (
    <Html lang="en">
      <Head />
      <Preview>Your sign-in link for AI News Aggregator</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          {/* Brand */}
          <Section style={styles.header}>
            <Heading as="h1" style={styles.brand}>
              AI News
            </Heading>
          </Section>

          <Hr style={styles.divider} />

          {/* Lede */}
          <Section style={styles.content}>
            <Heading as="h2" style={styles.heading}>
              Sign in to your account
            </Heading>
            <Text style={styles.lede}>
              Click the button below to sign in. This link is single-use and
              expires in <strong>15 minutes</strong>. If you did not request
              this, you can safely ignore this email.
            </Text>

            {/* CTA */}
            <Button href={url} style={styles.button}>
              Sign in
            </Button>

            {/* Fallback */}
            <Text style={styles.fallbackLabel}>
              Or copy and paste this URL into your browser:
            </Text>
            <Link href={url} style={styles.fallbackLink}>
              {url}
            </Link>
          </Section>

          <Hr style={styles.divider} />

          {/* Footer */}
          <Section>
            <Text style={styles.footer}>
              You received this email because a sign-in was requested for your
              account. If this wasn&apos;t you, no action is needed.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const styles = {
  body: {
    backgroundColor: t.bg,
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    margin: "0",
    padding: "40px 0",
  },
  container: {
    backgroundColor: t.card,
    border: `1px solid ${t.border}`,
    borderRadius: "10px",
    margin: "0 auto",
    maxWidth: "480px",
    padding: "40px",
  },
  header: {
    marginBottom: "8px",
  },
  brand: {
    color: t.primary,
    fontSize: "20px",
    fontWeight: "700",
    letterSpacing: "-0.3px",
    margin: "0",
  },
  divider: {
    borderColor: t.border,
    margin: "24px 0",
  },
  content: {
    marginBottom: "8px",
  },
  heading: {
    color: t.fg,
    fontSize: "22px",
    fontWeight: "600",
    letterSpacing: "-0.3px",
    margin: "0 0 12px",
  },
  lede: {
    color: t.fg,
    fontSize: "15px",
    lineHeight: "1.6",
    margin: "0 0 28px",
  },
  button: {
    backgroundColor: t.primary,
    borderRadius: "8px",
    color: "#ffffff",
    display: "block",
    fontSize: "15px",
    fontWeight: "600",
    padding: "13px 0",
    textAlign: "center" as const,
    textDecoration: "none",
    width: "100%",
  },
  fallbackLabel: {
    color: t.muted,
    fontSize: "12px",
    margin: "24px 0 4px",
  },
  fallbackLink: {
    color: t.primary,
    fontSize: "12px",
    wordBreak: "break-all" as const,
  },
  footer: {
    color: t.muted,
    fontSize: "12px",
    lineHeight: "1.6",
    margin: "0",
  },
} satisfies Record<string, React.CSSProperties>;
