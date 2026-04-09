'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import {
  getOrganizationMembers,
  inviteMember,
  removeMember,
  updateMemberRole,
} from '@/lib/actions/organizations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreVertical, UserPlus } from 'lucide-react'

interface OrganizationMember {
  id: string
  role: string
  user_profiles?: {
    full_name?: string | null
    email?: string | null
  } | null
}

interface MembersManagementProps {
  organizationId: string
  userRole: string
}

export function MembersManagement({
  organizationId,
  userRole,
}: MembersManagementProps) {
  const t = useTranslations('settings.members')
  const [members, setMembers] = useState<OrganizationMember[]>([])
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'admin' | 'member' | 'viewer'>('member')
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)
  const [removeTarget, setRemoveTarget] = useState<string | null>(null)

  const canManage = ['owner', 'admin'].includes(userRole)

  const loadMembers = async () => {
    const { members: data } = await getOrganizationMembers(organizationId)
    setMembers(data)
  }

  useEffect(() => {
    loadMembers()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId])

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)
    setIsLoading(true)

    const result = await inviteMember(organizationId, email, role)

    if (result.error) {
      setMessage({ type: 'error', text: result.error })
    } else {
      setMessage({ type: 'success', text: t('memberAdded') })
      setEmail('')
      await loadMembers()
    }

    setIsLoading(false)
  }

  const handleRemove = (membershipId: string) => {
    setRemoveTarget(membershipId)
  }

  const confirmRemove = async () => {
    if (!removeTarget) return
    const result = await removeMember(removeTarget)
    setRemoveTarget(null)
    if (result.error) {
      setMessage({ type: 'error', text: result.error })
    } else {
      setMessage({ type: 'success', text: t('memberRemoved') })
      await loadMembers()
    }
  }

  const handleRoleChange = async (
    membershipId: string,
    newRole: 'admin' | 'member' | 'viewer'
  ) => {
    const result = await updateMemberRole(membershipId, newRole)

    if (result.error) {
      setMessage({ type: 'error', text: result.error })
    } else {
      setMessage({ type: 'success', text: t('roleUpdated') })
      await loadMembers()
    }
  }

  return (
    <div className="space-y-6">
      <Dialog open={!!removeTarget} onOpenChange={(open) => { if (!open) setRemoveTarget(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('removeMember')}</DialogTitle>
            <DialogDescription>{t('removeConfirm')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setRemoveTarget(null)}>
              {t('cancel')}
            </Button>
            <Button variant="destructive" size="sm" onClick={confirmRemove}>
              {t('remove')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {message && (
        <div
          className={`p-3 text-sm rounded-md border ${
            message.type === 'success'
              ? 'text-lime-700 bg-lime-50 dark:bg-lime-950/20 border-lime-200 dark:border-lime-900'
              : 'text-red-500 bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900'
          }`}
        >
          {message.text}
        </div>
      )}

      {canManage && (
        <form onSubmit={handleInvite} className="space-y-4 pb-6 border-b">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            {t('addTeamMember')}
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t('email')}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t('emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">{t('role')}</Label>
              <select
                id="role"
                value={role}
                onChange={(e) =>
                  setRole(e.target.value as 'admin' | 'member' | 'viewer')
                }
                disabled={isLoading}
                className="flex h-10 w-full rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-3 py-2 text-sm"
              >
                <option value="viewer">{t('roles.viewer')}</option>
                <option value="member">{t('roles.member')}</option>
                <option value="admin">{t('roles.admin')}</option>
              </select>
            </div>
          </div>

          <Button type="submit" disabled={isLoading}>
            {isLoading ? t('adding') : t('addMember')}
          </Button>
        </form>
      )}

      <div className="space-y-4">
        <h3 className="text-sm font-medium">{t('currentMembers')}</h3>
        <div className="space-y-3">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between p-3 rounded-lg border border-neutral-200 dark:border-neutral-800"
            >
              <div className="flex-1">
                <div className="font-medium">
                  {member.user_profiles?.full_name || t('unknown')}
                </div>
                <div className="text-sm text-neutral-500 dark:text-neutral-400">
                  {member.user_profiles?.email}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-sm capitalize px-2 py-1 rounded bg-neutral-100 dark:bg-neutral-800">
                  {t(`roles.${member.role}`)}
                </span>

                {canManage && member.role !== 'owner' && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => handleRoleChange(member.id, 'admin')}
                      >
                        {t('makeAdmin')}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleRoleChange(member.id, 'member')}
                      >
                        {t('makeMember')}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleRoleChange(member.id, 'viewer')}
                      >
                        {t('makeViewer')}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleRemove(member.id)}
                        className="text-red-600"
                      >
                        {t('removeMember')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
