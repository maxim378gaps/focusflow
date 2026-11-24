import { useMemo, useState } from 'react'
import {
  Activity, ArrowUpRight, Bell, CalendarDays, Check, ChevronDown, ChevronLeft,
  ChevronRight, Circle, Clock3, Flame, LayoutDashboard, ListTodo, MoreHorizontal,
  Plus, Search, Settings2, Sparkles, Target, TrendingUp, X, Zap
} from 'lucide-react'

type Task = { id: number; title: string; time: string; done: boolean; tag: string }
type Habit = { id: number; title: string; detail: string; icon: string; done: boolean }

const initialTasks: Task[] = [
  { id: 1, title: 'Утренняя прогулка', time: '09:00', done: true, tag: 'Здоровье' },
  { id: 2, title: 'Сделать ключевую задачу проекта', time: '11:00', done: false, tag: 'Работа' },
  { id: 3, title: 'Изучить 1 урок TypeScript', time: '14:30', done: false, tag: 'Обучение' },
  { id: 4, title: 'Подвести итоги дня', time: '20:00', done: false, tag: 'Личное' },
]
const initialHabits: Habit[] = [
  { id: 1, title: 'Выпить стакан воды', detail: 'Каждое утро', icon: '💧', done: true },
  { id: 2, title: 'Прогулка 30 минут', detail: 'Движение каждый день', icon: '🚶', done: false },
  { id: 3, title: 'Чтение', detail: '15 минут в день', icon: '📖', done: false },
]

const nav = [
  { id: 'home', label: 'Обзор', icon: LayoutDashboard },
  { id: 'plans', label: 'Мои планы', icon: CalendarDays },
  { id: 'habits', label: 'Привычки', icon: Activity },
  { id: 'goals', label: 'Цели', icon: Target },
]

function readStorage<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key)
    return value ? JSON.parse(value) as T : fallback
  } catch { return fallback }
}

export default function App() {
  const [active, setActive] = useState('home')
  const [tasks, setTasks] = useState<Task[]>(() => readStorage('ff-tasks', initialTasks))
  const [habits, setHabits] = useState<Habit[]>(() => readStorage('ff-habits', initialHabits))
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [newTask, setNewTask] = useState('')
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState('')
  const completed = tasks.filter(t => t.done).length
  const progress = Math.round(completed / tasks.length * 100) || 0
  const dateLabel = useMemo(() => new Intl.DateTimeFormat('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date()), [])

  function saveTasks(next: Task[]) { setTasks(next); localStorage.setItem('ff-tasks', JSON.stringify(next)) }
  function saveHabits(next: Habit[]) { setHabits(next); localStorage.setItem('ff-habits', JSON.stringify(next)) }
  function toggleTask(id: number) { saveTasks(tasks.map(t => t.id === id ? { ...t, done: !t.done } : t)) }
  function toggleHabit(id: number) { saveHabits(habits.map(h => h.id === id ? { ...h, done: !h.done } : h)) }
  function addTask(e: React.FormEvent) {
    e.preventDefault()
    if (!newTask.trim()) return
    saveTasks([...tasks, { id: Date.now(), title: newTask.trim(), time: 'Без времени', done: false, tag: 'Личное' }])
    setNewTask(''); setShowTaskForm(false)
  }
  const filteredTasks = tasks.filter(t => t.title.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark"><Sparkles size={19} /></div><span>focus<span className="brand-light">flow</span></span></div>
        <div className="workspace"><div className="workspace-avatar">M</div><div><strong>Моё пространство</strong><small>Личный аккаунт</small></div><ChevronDown size={15} /></div>
        <div className="nav-caption">РАБОЧЕЕ ПРОСТРАНСТВО</div>
        <nav>{nav.map(item => { const Icon = item.icon; return <button key={item.id} className={active === item.id ? 'nav-item active' : 'nav-item'} onClick={() => setActive(item.id)}><Icon size={18} /><span>{item.label}</span>{item.id === 'plans' && <span className="nav-count">3</span>}</button> })}</nav>
        <div className="sidebar-bottom">
          <div className="upgrade-card"><div className="upgrade-icon"><Zap size={17} /></div><strong>Твой ритм — твои правила</strong><p>Маленькие шаги складываются в большие изменения.</p><div className="upgrade-line"><span /></div><small>Продолжай в своём темпе</small></div>
          <button className="nav-item"><Settings2 size={18} /><span>Настройки</span></button>
          <div className="profile"><div className="profile-avatar">M</div><div><strong>Мой профиль</strong><small>Бесплатный план</small></div><MoreHorizontal size={19} /></div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar"><div className="breadcrumb">Моё пространство <ChevronRight size={14} /> <span>{nav.find(n => n.id === active)?.label ?? 'Обзор'}</span></div><div className="top-actions"><div className="searchbox"><Search size={16} /><input placeholder="Поиск задач..." value={search} onChange={e => setSearch(e.target.value)} /></div><button className="icon-button" aria-label="Уведомления"><Bell size={18} /><i /></button><div className="top-avatar">M</div></div></header>
        <div className="page-content">
          <section className="welcome-row"><div><div className="eyebrow"><span className="eyebrow-dot" /> ТВОЁ ПРОСТРАНСТВО ДЛЯ РОСТА</div><h1>{active === 'home' ? 'Хороший день для движения вперёд.' : nav.find(n => n.id === active)?.label}</h1><p className="subheading">{dateLabel} · Не нужно делать всё. Достаточно сделать следующий шаг.</p></div><button className="primary-button" onClick={() => setShowTaskForm(true)}><Plus size={17} /> Новая задача</button></section>

          {active === 'home' && <>
            <section className="stats-grid">
              <div className="stat-card progress-stat"><div className="stat-top"><span>Прогресс дня</span><span className="stat-icon purple"><TrendingUp size={17} /></span></div><div className="stat-number">{progress}<small>%</small></div><div className="progress-track"><span style={{ width: progress + '%' }} /></div><div className="stat-foot"><span>{completed} из {tasks.length} задач выполнено</span><span className="positive">Так держать</span></div></div>
              <div className="stat-card"><div className="stat-top"><span>Активные цели</span><span className="stat-icon blue"><Target size={17} /></span></div><div className="stat-number">3</div><div className="stat-foot"><span>В работе сейчас</span><span className="muted">На этой неделе</span></div></div>
              <div className="stat-card"><div className="stat-top"><span>Серия привычек</span><span className="stat-icon orange"><Flame size={17} /></span></div><div className="stat-number">4 <small>дня</small></div><div className="stat-foot"><span>Ты формируешь ритм</span><span className="positive">+1 день</span></div></div>
            </section>

            <section className="content-grid">
              <div className="panel tasks-panel"><div className="panel-heading"><div><h2>План на сегодня</h2><p>Твой фокус на этот день</p></div><button className="text-button" onClick={() => setActive('plans')}>Все задачи <ArrowUpRight size={15} /></button></div>
                <div className="task-list">{filteredTasks.map(task => <div className={task.done ? 'task-row task-done' : 'task-row'} key={task.id}><button className={task.done ? 'check-circle checked' : 'check-circle'} onClick={() => toggleTask(task.id)} aria-label="Отметить задачу">{task.done && <Check size={14} />}</button><div className="task-copy"><strong>{task.title}</strong><div className="task-meta"><Clock3 size={12} /> {task.time}<span className="tag">{task.tag}</span></div></div><button className="more-button" aria-label="Дополнительно"><MoreHorizontal size={18} /></button></div>)}
                {filteredTasks.length === 0 && <div className="empty-state">Ничего не найдено. Попробуй другой запрос.</div>}</div>
                <button className="add-inline" onClick={() => setShowTaskForm(true)}><Plus size={16} /> Добавить задачу</button>
              </div>
              <div className="panel habits-panel"><div className="panel-heading"><div><h2>Ежедневные привычки</h2><p>Регулярность важнее идеала</p></div><button className="more-button"><MoreHorizontal size={19} /></button></div>
                <div className="habit-progress"><div className="habit-progress-copy"><strong>{habits.filter(h => h.done).length} из {habits.length}</strong><span>выполнено сегодня</span></div><div className="mini-progress"><span style={{ width: (habits.filter(h => h.done).length / habits.length * 100 || 0) + '%' }} /></div></div>
                <div className="habit-list">{habits.map(h => <button className={h.done ? 'habit-row habit-complete' : 'habit-row'} key={h.id} onClick={() => toggleHabit(h.id)}><span className="habit-emoji">{h.icon}</span><span className="habit-copy"><strong>{h.title}</strong><small>{h.detail}</small></span><span className={h.done ? 'habit-check done' : 'habit-check'}>{h.done && <Check size={13} />}</span></button>)}</div>
                <button className="add-inline" onClick={() => setActive('habits')}><Plus size={16} /> Управлять привычками</button>
              </div>
            </section>

            <section className="bottom-grid"><div className="panel focus-panel"><div className="focus-symbol"><Sparkles size={19} /></div><div><span className="focus-label">МЫСЛЬ ДНЯ</span><h3>Не стремись к идеальному дню. Создай день, который можешь повторить.</h3><p>Устойчивый прогресс начинается с реалистичных обещаний себе.</p></div></div><div className="panel week-panel"><div className="panel-heading"><div><h2>Эта неделя</h2><p>Твой небольшой обзор</p></div><button className="more-button"><MoreHorizontal size={19} /></button></div><div className="week-days">{['ПН','ВТ','СР','ЧТ','ПТ','СБ','ВС'].map((d,i)=><div className="day-column" key={d}><span>{d}</span><div className={i < 3 ? 'day-dot filled' : i === 3 ? 'day-dot today' : 'day-dot'}>{i < 3 && <Check size={12} />}{i === 3 && <Circle size={7} fill="currentColor" />}</div></div>)}</div><div className="week-caption"><span className="legend-dot" /> 3 активных дня <span className="week-percent">Хороший темп</span></div></div></section>
          </>}

          {active === 'plans' && <section className="panel standalone-panel"><div className="panel-heading"><div><h2>Все задачи</h2><p>Список твоих ближайших действий</p></div><button className="primary-button small" onClick={() => setShowTaskForm(true)}><Plus size={16} /> Добавить</button></div>{tasks.map(t=><div className="task-row" key={t.id}><button className={t.done?'check-circle checked':'check-circle'} onClick={()=>toggleTask(t.id)}>{t.done&&<Check size={14}/>}</button><div className="task-copy"><strong>{t.title}</strong><div className="task-meta">{t.time}<span className="tag">{t.tag}</span></div></div></div>)}</section>}
          {active === 'habits' && <section className="panel standalone-panel"><div className="panel-heading"><div><h2>Твои привычки</h2><p>Отмечай маленькие победы каждый день</p></div></div>{habits.map(h=><button className="habit-row expanded" key={h.id} onClick={()=>toggleHabit(h.id)}><span className="habit-emoji">{h.icon}</span><span className="habit-copy"><strong>{h.title}</strong><small>{h.detail}</small></span><span className={h.done?'habit-check done':'habit-check'}>{h.done&&<Check size={13}/>}</span></button>)}</section>}
          {active === 'goals' && <section className="goal-grid"><div className="panel goal-card"><span className="goal-icon purple"><Target size={20}/></span><span className="goal-status">В ПРОЦЕССЕ</span><h2>Запустить свой продукт</h2><p>Превратить идею в работающий проект</p><div className="progress-track"><span style={{width:'35%'}}/></div><div className="goal-foot"><span>2 из 6 этапов</span><span>35%</span></div></div><div className="panel goal-card"><span className="goal-icon blue"><Activity size={20}/></span><span className="goal-status">В ПРОЦЕССЕ</span><h2>Укрепить здоровье</h2><p>Выстроить устойчивый режим и активность</p><div className="progress-track"><span style={{width:'20%'}}/></div><div className="goal-foot"><span>1 из 5 этапов</span><span>20%</span></div></div><button className="create-goal" onClick={()=>{setToast('Создание целей скоро появится');setTimeout(()=>setToast(''),2500)}}><Plus size={20}/><strong>Создать новую цель</strong><span>Большие изменения начинаются с идеи</span></button></section>}
          <footer className="footer-note"><span>focusflow</span><span>Двигайся в своём ритме <span className="footer-heart">✦</span></span></footer>
        </div>
      </main>

      {showTaskForm && <div className="modal-backdrop" onClick={()=>setShowTaskForm(false)}><form className="task-modal" onSubmit={addTask} onClick={e=>e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">НОВОЕ ДЕЙСТВИЕ</span><h2>Добавить задачу</h2></div><button type="button" className="icon-button" onClick={()=>setShowTaskForm(false)}><X size={18}/></button></div><label htmlFor="task-title">Что нужно сделать?</label><input id="task-title" autoFocus placeholder="Например, пройтись 20 минут" value={newTask} onChange={e=>setNewTask(e.target.value)}/><div className="modal-actions"><button type="button" className="secondary-button" onClick={()=>setShowTaskForm(false)}>Отмена</button><button type="submit" className="primary-button" disabled={!newTask.trim()}><Plus size={16}/> Создать задачу</button></div></form></div>}
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}