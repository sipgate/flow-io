'use client'

import { useState, useTransition } from 'react'
import { Unlink, Phone, CheckCircle2, AlertCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { disconnectTelephonyAccount } from '@/lib/actions/telephony'
import { signInWithSipgate } from '@/app/(auth)/actions'
import { toast } from 'sonner'

interface TelephonyAccount {
  id: string
  provider: string
  provider_account_id: string
  account_info: Record<string, unknown> | null
  is_active: boolean
}

interface TelephonySectionProps {
  organizationId: string
  account: TelephonyAccount | null
  canEdit: boolean
}

export function TelephonySection({ organizationId, account, canEdit }: TelephonySectionProps) {
  const t = useTranslations('connect.telephonySection')
  const [isPending, startTransition] = useTransition()
  const [showConfirm, setShowConfirm] = useState(false)

  const handleDisconnect = () => {
    setShowConfirm(false)
    startTransition(async () => {
      const result = await disconnectTelephonyAccount(organizationId)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(t('disconnected'))
      }
    })
  }

  if (!account) {
    return (
      <div className="flex items-center justify-between gap-4 p-4 rounded-lg border border-amber-500/20 bg-amber-500/5">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
          <div className="space-y-0.5">
            <p className="text-sm font-medium">{t('noAccount')}</p>
            <p className="text-sm text-muted-foreground">{t('noAccountDescription')}</p>
          </div>
        </div>
        {canEdit && (
          <form action={signInWithSipgate}>
            <Button type="submit" size="sm">
              {t('continueWithSipgate')}
            </Button>
          </form>
        )}
      </div>
    )
  }

  const accountName = (account.account_info?.name as string) || account.provider_account_id

  return (
    <>
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('disconnectTitle')}</DialogTitle>
            <DialogDescription>
              {t('disconnectDescription')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowConfirm(false)}>
              {t('cancel')}
            </Button>
            <Button variant="destructive" size="sm" onClick={handleDisconnect} disabled={isPending}>
              {t('disconnect')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 rounded-lg border">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-lime-500/10">
              <CheckCircle2 className="h-5 w-5 text-lime-600" />
            </div>
            <div>
              <p className="text-sm font-medium">{t('connectedProvider')} · {accountName}</p>
              <p className="text-xs text-muted-foreground">{t('connected')}</p>
            </div>
          </div>

          {canEdit && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowConfirm(true)}
              disabled={isPending}
              className="text-destructive hover:text-destructive"
            >
              <Unlink className="h-3.5 w-3.5 mr-1.5" />
              {t('disconnect')}
            </Button>
          )}
        </div>

        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Phone className="h-3.5 w-3.5" />
          {t('phoneNumbersHint')}
        </p>
      </div>
    </>
  )
}
