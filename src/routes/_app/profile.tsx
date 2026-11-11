import { createFileRoute, redirect } from '@tanstack/react-router'

/** Profile became Settings; old links and bookmarks land there. */
export const Route = createFileRoute('/_app/profile')({
  beforeLoad: () => {
    throw redirect({ to: '/settings/general', replace: true })
  },
})
