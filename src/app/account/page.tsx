import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server'
import { loadMyEquipment } from '@/lib/hardware-server'
import MyEquipmentCard from '@/components/hardware/MyEquipmentCard'
import { redirect } from 'next/navigation'
import StudentTopNav from '@/components/ui/StudentTopNav'
import InstructorTopNav from '@/components/ui/InstructorTopNav'
import AccountForm from '@/components/ui/AccountForm'
import AccessibilitySettings from '@/components/ui/AccessibilitySettings'
import BackButton from '@/components/ui/BackButton'

export default async function AccountPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('name, role, avatar_url')
    .eq('id', user.id)
    .single()

  const isInstructor = profile?.role === 'instructor' || profile?.role === 'admin'
  // Only the signed-in user's own equipment (their id comes from auth, not the request).
  const equipment = profile?.role === 'student' ? await loadMyEquipment(createServiceSupabaseClient(), user.id) : null

  return (
    <div className="min-h-screen bg-background">
      {isInstructor
        ? <InstructorTopNav name={profile?.name} role={profile?.role} />
        : <StudentTopNav name={profile?.name} role={profile?.role} />
      }

      <main id="main-content" tabIndex={-1} className="max-w-xl mx-auto px-8 py-12 focus:outline-none">
        <div className="flex items-center gap-3 mb-8">
          <BackButton />
          <span className="text-border">/</span>
          <h1 className="text-2xl font-bold text-dark-text">Profile</h1>
        </div>

        <AccountForm
          userId={user.id}
          initialName={profile?.name ?? ''}
          initialEmail={user.email ?? ''}
          initialAvatarUrl={profile?.avatar_url ?? null}
        />
        {equipment && equipment.devices.length > 0 && (
          <div className="mt-6">
            <MyEquipmentCard equipment={equipment} email={user.email ?? null} />
          </div>
        )}
        <div className="mt-6">
          <AccessibilitySettings />
        </div>
      </main>
    </div>
  )
}
