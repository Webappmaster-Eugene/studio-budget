import { json, readJson } from '@/lib/http'
import { parseImport } from '@/lib/import'
import { saveImport } from '@/lib/save-import'
import { workspaceRoute } from '@/lib/workspace-route'

export function POST(request: Request) {
  return workspaceRoute(request, async () => {
    const batch = parseImport(await readJson(request, 524_288))
    await saveImport(batch)
    return json({ ids: batch.contracts.map(({ id }) => id) }, 201)
  })
}
