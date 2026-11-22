import { json, readJson } from '@/lib/http'
import { contractInput, validDate, validId, validVersion } from '@/lib/input'
import { deleteContract, readContract, updateContract } from '@/lib/repository'
import { createStatement } from '@/lib/statement'
import { dateToday } from '@/lib/values'
import { workspaceRoute } from '@/lib/workspace-route'

type Context = { params: Promise<{ id: string }> }

export function GET(request: Request, context: Context) {
  return workspaceRoute(request, async () => {
    const id = validId((await context.params).id)
    const query = new URL(request.url).searchParams.get('asOf') ?? dateToday()
    const asOf = validDate(query, 'Дата отчёта')
    const data = await readContract(id)
    return json({ ...data, statement: createStatement(data, asOf) })
  })
}

export function PATCH(request: Request, context: Context) {
  return workspaceRoute(request, async () => {
    const id = validId((await context.params).id)
    const input = await readJson(request)
    return json(await updateContract(id, validVersion(input.version), contractInput(input)))
  })
}

export function DELETE(request: Request, context: Context) {
  return workspaceRoute(request, async () => {
    const id = validId((await context.params).id)
    const input = await readJson(request)
    await deleteContract(id, validVersion(input.version))
    return json({ ok: true })
  })
}
