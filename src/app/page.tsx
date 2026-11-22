import { hasSession } from '@/lib/auth'
import { listContracts } from '@/lib/repository'
import { dateToday } from '@/lib/values'
import { Login } from './login'
import { Workspace } from './workspace'

export const dynamic = 'force-dynamic'

export default async function Home() {
  if (!(await hasSession())) return <Login />
  return <Workspace initialContracts={await listContracts()} initialDate={dateToday()} />
}
