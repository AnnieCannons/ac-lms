import RatingSubmissionsView from '@/components/ui/RatingSubmissionsView'
import { listAllRatings } from '@/lib/partner-ratings-actions'
import BackLink from '@/components/ui/BackLink'

export default async function RatingSubmissionsPage() {
  const { ratings, error } = await listAllRatings()

  return (
    <main className="max-w-5xl mx-auto px-6 py-10">
      <div className="mb-8">
        <BackLink href="/instructor/partnerships/referrals">Student Referrals</BackLink>
        <h1 className="text-2xl font-bold text-dark-text mt-3">Rating Submissions</h1>
        <p className="text-sm text-muted-text mt-1">
          All partner ratings submitted by students and staff.
        </p>
      </div>

      {error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : (
        <RatingSubmissionsView initialRatings={ratings} />
      )}
    </main>
  )
}
