/**
 * ConfirmDialog - A reusable confirmation dialog component
 *
 * Usage:
 * <ConfirmDialog
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   title="Delete Image?"
 *   description="This action cannot be undone."
 *   confirmText="Delete"
 *   variant="destructive"
 *   onConfirm={() => handleDelete()}
 * />
 */

import { AlertTriangle, Info, Trash2 } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'

export interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'destructive' | 'warning'
  onConfirm: () => void
  onCancel?: () => void
  isLoading?: boolean
}

const variantConfig = {
  default: {
    icon: Info,
    iconClassName: 'text-primary',
    mediaClassName: 'bg-primary/10',
    actionVariant: 'default' as const,
  },
  destructive: {
    icon: Trash2,
    iconClassName: 'text-destructive',
    mediaClassName: 'bg-destructive/10',
    actionVariant: 'destructive' as const,
  },
  warning: {
    icon: AlertTriangle,
    iconClassName: 'text-amber-500',
    mediaClassName: 'bg-amber-500/10',
    actionVariant: 'default' as const,
  },
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default',
  onConfirm,
  onCancel,
  isLoading = false,
}: ConfirmDialogProps) {
  const config = variantConfig[variant]
  const Icon = config.icon

  const handleConfirm = () => {
    onConfirm()
    onOpenChange(false)
  }

  const handleCancel = () => {
    onCancel?.()
    onOpenChange(false)
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="rounded-2xl border-border/50">
        <AlertDialogHeader>
          <AlertDialogMedia className={cn('rounded-xl', config.mediaClassName)}>
            <Icon className={cn('h-8 w-8', config.iconClassName)} />
          </AlertDialogMedia>
          <AlertDialogTitle className="text-xl">{title}</AlertDialogTitle>
          {description && (
            <AlertDialogDescription className="text-muted-foreground">
              {description}
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-3 sm:gap-3">
          <AlertDialogCancel
            onClick={handleCancel}
            disabled={isLoading}
            className="rounded-xl"
          >
            {cancelText}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isLoading}
            variant={config.actionVariant}
            className="rounded-xl"
          >
            {isLoading ? 'Processing...' : confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
