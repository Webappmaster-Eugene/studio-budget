import { projects } from '../../../lib/fixtures'
import { createReport, isCalendarDate } from '../../../lib/report'

const headers = { 'Cache-Control': 'no-store' }

export function GET(request: Request): Response {
  const query = new URL(request.url).searchParams
  const dates = query.getAll('asOf')
  const projectIds = query.getAll('project')
  const [asOf = null] = dates
  const [projectId] = projectIds

  if (dates.length !== 1 || !isCalendarDate(asOf)) {
    return Response.json({ error: 'Укажите одну календарную дату в формате ГГГГ-ММ-ДД.' }, { status: 400, headers })
  }

  if (projectIds.length !== 1 || !projectId) {
    return Response.json({ error: 'Выберите один проект.' }, { status: 400, headers })
  }

  const project = projects.find((entry) => entry.id === projectId)
  if (!project) {
    return Response.json({ error: 'Проект не найден.' }, { status: 404, headers })
  }

  return Response.json(createReport(project, asOf), { headers })
}
