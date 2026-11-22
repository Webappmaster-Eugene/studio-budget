import { initialDate, projects } from '@/lib/fixtures'
import { createReport } from '@/lib/report'
import { Dashboard } from './dashboard'

export default function Home() {
  return (
    <>
      <header className="masthead">
        <div className="frame brand">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
          <span>Бюджет проекта</span>
        </div>
      </header>

      <main className="frame">
        <Dashboard
          projects={projects.map(({ id, name }) => ({ id, name }))}
          initialReport={createReport(projects[0], initialDate)}
        />
      </main>

      <footer className="frame footer">
        <a href="https://github.com/Webappmaster-Eugene/studio-budget">Исходный код на GitHub</a>
      </footer>
    </>
  )
}
