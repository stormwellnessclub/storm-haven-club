import * as React from 'npm:react@18.3.1';
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22';
import type { TemplateEntry } from './registry.ts';

interface Props {
  firstName?: string;
  fridayUrl?: string;
  saturdayUrl?: string;
}

const Email = ({ firstName, fridayUrl, saturdayUrl }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Help us pick the date — Sound Bath & Nervous System Reset</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Text style={eyebrow}>MEMBER VOTE</Text>
          <Heading style={h1}>Sound Bath, Nervous System Reset &amp; Guided Meditation</Heading>
          <Text style={sub}>
            We're planning a 90-minute experience and would love for our members to help
            select the date.
          </Text>
        </Section>

        <Text style={paragraph}>{firstName ? `Hi ${firstName},` : 'Hello,'}</Text>

        <Text style={paragraph}>
          Which evening do you prefer? Tap a button below to cast your vote — you can
          change it any time before voting closes.
        </Text>

        <Section style={{ textAlign: 'center' as const, margin: '28px 0' }}>
          <Button style={ctaPrimary} href={fridayUrl || 'https://stormwellnessclub.com/member?vote=sound-bath-jul-2026&choice=friday_jul_24'}>
            Friday, July 24 · 7:00 PM
          </Button>
          <div style={{ height: 12 }} />
          <Button style={ctaSecondary} href={saturdayUrl || 'https://stormwellnessclub.com/member?vote=sound-bath-jul-2026&choice=saturday_jul_25'}>
            Saturday, July 25 · 7:00 PM
          </Button>
        </Section>

        <Hr style={hr} />

        <Heading as="h2" style={h2}>Tickets</Heading>
        <Text style={paragraph}>
          Members: <strong>$30</strong> per person<br />
          Non-Members: <strong>$40</strong> per person
        </Text>

        <Hr style={hr} />

        <Heading as="h2" style={h2}>About the experience</Heading>
        <Text style={paragraph}>
          Join us for a 90-minute nervous system reset led by <strong>Crystal Bell</strong>,
          a classically trained musician and yoga instructor. This restorative experience
          combines the healing frequencies of sound with the deep relaxation of guided
          meditation.
        </Text>
        <Text style={paragraph}>
          The session will begin with breathwork and gentle stretching to prepare the mind
          and body to relax, release, and settle into stillness. Once grounded, attendees
          will be guided through a meditation designed to create a deeper state of
          relaxation and receptivity.
        </Text>
        <Text style={paragraph}>
          The meditation will transition into an extended sound bath, where natural sound
          waves and healing vibrational frequencies will be used to release stress,
          encourage creativity, and restore energy throughout the body.
        </Text>
        <Text style={paragraph}>
          Attendees are encouraged to bring a yoga mat, pillow, light blanket, eye mask, or
          anything else that will allow them to feel fully comfortable during the
          experience.
        </Text>

        <Hr style={hr} />

        <Text style={footer}>
          With gratitude,<br />
          The Storm Wellness Club Team
        </Text>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: 'Member Vote: Sound Bath & Nervous System Reset',
  displayName: 'Sound Bath Member Vote',
  previewData: {
    firstName: 'Jane',
    fridayUrl: 'https://stormwellnessclub.com/member?vote=sound-bath-jul-2026&choice=friday_jul_24',
    saturdayUrl: 'https://stormwellnessclub.com/member?vote=sound-bath-jul-2026&choice=saturday_jul_25',
  },
} satisfies TemplateEntry;

const main = { backgroundColor: '#ffffff', fontFamily: 'Georgia, "Times New Roman", serif', color: '#1a1a1a' };
const container = { maxWidth: '560px', margin: '0 auto', padding: '32px 24px' };
const header = { textAlign: 'center' as const, marginBottom: 24 };
const eyebrow = { fontSize: 11, letterSpacing: '2px', color: '#a17e3a', margin: 0, fontFamily: 'Arial, sans-serif' };
const h1 = { fontSize: 26, lineHeight: '1.25', margin: '10px 0 8px', color: '#1a1a1a' };
const h2 = { fontSize: 17, margin: '24px 0 8px', color: '#1a1a1a' };
const sub = { fontSize: 15, color: '#555', margin: 0 };
const paragraph = { fontSize: 15, lineHeight: '1.6', color: '#333', margin: '10px 0' };
const ctaPrimary = {
  backgroundColor: '#2d2418',
  color: '#e8d5a8',
  padding: '14px 28px',
  borderRadius: 4,
  fontSize: 15,
  fontFamily: 'Arial, sans-serif',
  textDecoration: 'none',
  display: 'inline-block',
  minWidth: 260,
  textAlign: 'center' as const,
};
const ctaSecondary = {
  backgroundColor: '#a17e3a',
  color: '#ffffff',
  padding: '14px 28px',
  borderRadius: 4,
  fontSize: 15,
  fontFamily: 'Arial, sans-serif',
  textDecoration: 'none',
  display: 'inline-block',
  minWidth: 260,
  textAlign: 'center' as const,
};
const hr = { borderTop: '1px solid #e5e5e5', margin: '28px 0' };
const footer = { fontSize: 14, color: '#666', fontStyle: 'italic' as const, marginTop: 20 };
