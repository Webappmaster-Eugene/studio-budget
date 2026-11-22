import { initialDate, projects } from '@/lib/fixtures'
import { createReport } from '@/lib/report'
import { Dashboard } from './dashboard'

export default function Home() {
  return (
    <>
      <header className="masthead">
        <div className="frame masthead-inner">
          <p className="demo-label">Демонстрационные данные</p>
          <h1>Бюджет студии</h1>
          <p className="intro">План и оплаченные расходы по проектам на выбранную дату.</p>
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
