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
} from '@react-email/components'
import * as React from 'react'

interface DigestItem {
  message: string
  assignmentId: string | null
  courseId: string | null
}

interface DigestEmailProps {
  studentName: string
  grades: DigestItem[]
  comments: DigestItem[]
  appUrl: string
}

export default function DigestEmail({ studentName, grades, comments, appUrl }: DigestEmailProps) {
  const totalCount = grades.length + comments.length
  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <Html>
      <Head />
      <Preview>
        {`${totalCount} new update${totalCount !== 1 ? 's' : ''} from AnnieCannons`}
      </Preview>
      <Body style={body}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Heading style={logo}>AnnieCannons</Heading>
          </Section>

          {/* Greeting */}
          <Section style={content}>
            <Text style={greeting}>Hi {studentName},</Text>
            <Text style={intro}>
              Here&apos;s your daily summary for <strong>{dateStr}</strong>. You have{' '}
              <strong>{totalCount} update{totalCount !== 1 ? 's' : ''}</strong> from your instructors.
            </Text>

            {/* Grades */}
            {grades.length > 0 && (
              <Section style={card}>
                <Heading as="h2" style={cardHeading}>
                  Grades Posted ({grades.length})
                </Heading>
                {grades.map((g, i) => (
                  <Section key={i} style={itemRow}>
                    <Text style={itemText}>
                      <span style={bullet}>✓</span> {g.message}
                    </Text>
                    {g.courseId && g.assignmentId && (
                      <Button
                        href={`${appUrl}/student/courses/${g.courseId}/assignments/${g.assignmentId}`}
                        style={linkButton}
                      >
                        View submission →
                      </Button>
                    )}
                  </Section>
                ))}
              </Section>
            )}

            {/* Comments */}
            {comments.length > 0 && (
              <Section style={card}>
                <Heading as="h2" style={cardHeading}>
                  Instructor Comments ({comments.length})
                </Heading>
                {comments.map((c, i) => (
                  <Section key={i} style={itemRow}>
                    <Text style={itemText}>
                      <span style={bullet}>💬</span> {c.message}
                    </Text>
                    {c.courseId && c.assignmentId && (
                      <Button
                        href={`${appUrl}/student/courses/${c.courseId}/assignments/${c.assignmentId}`}
                        style={linkButton}
                      >
                        View comments →
                      </Button>
                    )}
                  </Section>
                ))}
              </Section>
            )}

            <Button href={appUrl} style={ctaButton}>
              Go to my courses
            </Button>
          </Section>

          <Hr style={divider} />
          <Text style={footer}>
            AnnieCannons Learning Management System &mdash; you&apos;re receiving this because
            you&apos;re enrolled in a course. This digest is sent once daily.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

const BRAND = '#6D2B5E'
const BRAND_LIGHT = '#F5E6F3'

const body: React.CSSProperties = {
  backgroundColor: '#f4f4f5',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
}

const container: React.CSSProperties = {
  maxWidth: '600px',
  margin: '0 auto',
  backgroundColor: '#ffffff',
  borderRadius: '12px',
  overflow: 'hidden',
}

const header: React.CSSProperties = {
  backgroundColor: BRAND,
  padding: '24px 32px',
}

const logo: React.CSSProperties = {
  color: '#ffffff',
  fontSize: '22px',
  fontWeight: '700',
  margin: '0',
  letterSpacing: '-0.3px',
}

const content: React.CSSProperties = {
  padding: '32px 32px 16px',
}

const greeting: React.CSSProperties = {
  fontSize: '18px',
  fontWeight: '600',
  color: '#111',
  margin: '0 0 8px',
}

const intro: React.CSSProperties = {
  fontSize: '15px',
  color: '#555',
  margin: '0 0 24px',
  lineHeight: '1.5',
}

const card: React.CSSProperties = {
  backgroundColor: '#fafafa',
  border: '1px solid #e5e5e5',
  borderRadius: '8px',
  padding: '16px 20px',
  marginBottom: '16px',
}

const cardHeading: React.CSSProperties = {
  fontSize: '14px',
  fontWeight: '600',
  color: BRAND,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  margin: '0 0 12px',
}

const itemRow: React.CSSProperties = {
  borderTop: '1px solid #e5e5e5',
  paddingTop: '10px',
  marginTop: '10px',
}

const itemText: React.CSSProperties = {
  fontSize: '14px',
  color: '#222',
  margin: '0 0 6px',
  lineHeight: '1.5',
}

const bullet: React.CSSProperties = {
  marginRight: '6px',
}

const linkButton: React.CSSProperties = {
  fontSize: '13px',
  color: BRAND,
  backgroundColor: BRAND_LIGHT,
  padding: '4px 12px',
  borderRadius: '20px',
  textDecoration: 'none',
  display: 'inline-block',
}

const ctaButton: React.CSSProperties = {
  backgroundColor: BRAND,
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: '600',
  padding: '12px 24px',
  borderRadius: '8px',
  textDecoration: 'none',
  display: 'inline-block',
  margin: '8px 0 16px',
}

const divider: React.CSSProperties = {
  borderColor: '#e5e5e5',
  margin: '0 32px',
}

const footer: React.CSSProperties = {
  fontSize: '12px',
  color: '#999',
  padding: '16px 32px 24px',
  margin: '0',
  lineHeight: '1.5',
}
