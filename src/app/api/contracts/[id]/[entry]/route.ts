import { json, readJson, RequestError } from '@/lib/http'
import { paymentInput, validId, workInput } from '@/lib/input'
import { savePayment, saveWork } from '@/lib/repository'
import { workspaceRoute } from '@/lib/workspace-route'

type Context = { params: Promise<{ id: string; entry: string }> }

export function POST(request: Request, context: Context) {
  return workspaceRoute(request, async () => {
    const { id, entry } = await context.params
    const contractId = validId(id)
    const input = await readJson(request)
    if (entry === 'works') return json(await saveWork(contractId, workInput(input)), 201)
    if (entry === 'payments') return json(await savePayment(contractId, paymentInput(input)), 201)
    throw new RequestError(404, 'Раздел не найден.')
  })
}
