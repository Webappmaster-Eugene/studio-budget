import { json, readJson } from '@/lib/http'
import { contractInput } from '@/lib/input'
import { insertContract, listContracts } from '@/lib/repository'
import { workspaceRoute } from '@/lib/workspace-route'

export function GET(request: Request) {
  return workspaceRoute(request, async () => json(await listContracts()))
}

export function POST(request: Request) {
  return workspaceRoute(request, async () => json(await insertContract(contractInput(await readJson(request))), 201))
}
