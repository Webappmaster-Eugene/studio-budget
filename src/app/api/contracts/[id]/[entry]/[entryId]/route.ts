import { json, readJson, RequestError } from '@/lib/http'
import { paymentInput, validId, validVersion, workInput } from '@/lib/input'
import { deleteEntry, savePayment, saveWork } from '@/lib/repository'
import { workspaceRoute } from '@/lib/workspace-route'

type Context = { params: Promise<{ id: string; entry: string; entryId: string }> }

export function PATCH(request: Request, context: Context) {
  return workspaceRoute(request, async () => {
    const { id, entry, entryId } = await context.params
    const contractId = validId(id)
    const input = await readJson(request)
    const existing = { id: validId(entryId), version: validVersion(input.version) }
    if (entry === 'works') return json(await saveWork(contractId, workInput(input), existing))
    if (entry === 'payments') return json(await savePayment(contractId, paymentInput(input), existing))
    throw new RequestError(404, 'Раздел не найден.')
  })
}

export function DELETE(request: Request, context: Context) {
  return workspaceRoute(request, async () => {
    const { id, entry, entryId } = await context.params
    if (entry !== 'works' && entry !== 'payments') throw new RequestError(404, 'Раздел не найден.')
    const input = await readJson(request)
    await deleteEntry(validId(id), entry, validId(entryId), validVersion(input.version))
    return json({ ok: true })
  })
}
