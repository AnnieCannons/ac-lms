import Link from 'next/link'

export default function SignupPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <h1 className="text-3xl font-extrabold text-dark-text mb-2">AC<span className="text-teal-primary">*</span></h1>
        <p className="text-lg font-semibold text-dark-text mb-3">Account creation is invite-only</p>
        <p className="text-sm text-muted-text mb-6">
          To join a course, ask your instructor to send you an invitation.
        </p>
        <Link href="/login" className="text-sm text-teal-primary font-medium hover:underline">
          Already have an account? Log in
        </Link>
      </div>
    </div>
  )
}
