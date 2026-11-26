import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { ArrowDownLeft, ArrowUpRight, Check, ChevronDown, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { addDays, calculateForecast, eventProgress, localDate, money, occurrences, shiftDate, toMinor, type FinanceData, type FinanceEvent, type FinanceOperation, type FinanceSettings } from './calculator'
import './finance.css'

const KEY='focusflow:finance-v3'
const OLD_KEY='focusflow:finance-v2'
const LEGACY_TRANSACTIONS='focusflow:personal-transactions'
const LEGACY_BALANCE='focusflow:personal-opening-balance'
const uid=()=>crypto.randomUUID?.()??String(Date.now()+Math.random())
const categories=[{id:'mandatory',label:'Обязательное'},{id:'desired',label:'Желаемое'},{id:'emergency',label:'Форс-мажор'}] as const
const emptySettings=():FinanceSettings=>({currency:'RUB',moneyNow:0,moneyNowDate:localDate(),moneyNowUpdatedAt:new Date().toISOString(),moneyNowMode:'manual',manualNextIncomeDate:'',manualNextIncomeAmount:0,avgDailyWindowDays:14,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC'})
const emptyData=():FinanceData=>({version:3,settings:emptySettings(),events:[],operations:[]})
function migrate():FinanceData{
 const today=localDate()
 try{
  const saved=localStorage.getItem(KEY)
  if(saved){const parsed=JSON.parse(saved) as FinanceData;if(parsed.version===3)return {...parsed,settings:{...emptySettings(),...parsed.settings,moneyNowUpdatedAt:parsed.settings.moneyNowUpdatedAt||new Date().toISOString()}}}
  const old=JSON.parse(localStorage.getItem(OLD_KEY)||'null')
  if(old?.version===2){
   const oldBalance=(old.accounts||[]).reduce((sum:number,a:any)=>sum+(a.openingMinor||0)+(old.transactions||[]).filter((t:any)=>t.date>=(a.openingDate||'0000-01-01')).reduce((n:number,t:any)=>n+(t.type==='income'&&t.accountId===a.id?t.amountMinor:0)-(t.type==='expense'&&t.accountId===a.id?t.amountMinor:0)-(t.type==='transfer'&&t.accountId===a.id?t.amountMinor:0)+(t.type==='transfer'&&t.toAccountId===a.id?t.amountMinor:0)+(t.type==='adjustment'&&t.accountId===a.id?t.amountMinor:0),0),0)
   const events:FinanceEvent[]=[
    ...(old.recurring||[]).map((r:any)=>({id:r.id,type:'regular' as const,title:r.title,amount:r.amountMinor,currentAmount:0,direction:r.type,category:'mandatory' as const,isMandatory:r.type==='expense',nextDate:r.nextDate,recurrence:r.cadence,status:r.active?'active' as const:'archived' as const,createdAt:r.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()})),
    ...(old.goals||[]).map((g:any)=>({id:g.id,type:(g.kind==='debt'?'debt_i_owe':g.kind==='receivable'?'debt_owed_to_me':'goal') as FinanceEvent['type'],title:g.name,amount:g.targetMinor,currentAmount:g.savedMinor||0,isMandatory:false,nextDate:g.dueDate||null,recurrence:'none' as const,status:'active' as const,createdAt:g.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()})),
    ...(old.liabilities||[]).map((d:any)=>({id:d.id,type:(d.kind==='i_owe'?'debt_i_owe':'debt_owed_to_me') as FinanceEvent['type'],title:d.name,amount:d.totalMinor,currentAmount:d.totalMinor-d.remainingMinor,isMandatory:false,nextDate:d.dueDate||null,recurrence:'none' as const,status:'active' as const,createdAt:d.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()}))
   ]
   const operations:FinanceOperation[]=(old.transactions||[]).filter((t:any)=>t.type==='income'||t.type==='expense').map((t:any)=>({id:t.id,eventId:null,amount:t.amountMinor,direction:t.type,category:mapCategory(t.category),title:t.title,comment:t.note||'',date:t.date,createdAt:t.createdAt||new Date().toISOString(),updatedAt:t.updatedAt||new Date().toISOString()}))
   return {version:3,settings:{...emptySettings(),moneyNow:oldBalance,moneyNowDate:today,moneyNowUpdatedAt:new Date().toISOString(),moneyNowMode:'manual'},events,operations}
  }
  const legacy=JSON.parse(localStorage.getItem(LEGACY_TRANSACTIONS)||'[]') as any[]
  const opening=Math.round(Number(localStorage.getItem(LEGACY_BALANCE)||0)*100)
  if(legacy.length||opening)return {version:3,settings:{...emptySettings(),moneyNow:opening,moneyNowDate:today,moneyNowUpdatedAt:new Date().toISOString(),moneyNowMode:'manual'},events:[],operations:legacy.map(t=>({id:t.id||uid(),eventId:null,amount:Math.round(t.amount*100),direction:t.type,category:mapCategory(t.category),title:t.title,comment:'',date:t.date,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()}))}
 }catch{/* Corrupt legacy storage must not block opening the finance screen. */}
 return emptyData()
}
function mapCategory(value:string):FinanceOperation['category']{
 const v=(value||'').toLowerCase()
 if(/аренд|жиль|продукт|транспорт|кредит|связ|коммун|обязат/.test(v))return 'mandatory'
 if(/лечен|ремонт|авари|форс/.test(v))return 'emergency'
 return 'desired'
}
function labelCategory(value:FinanceOperation['category']){return categories.find(c=>c.id===value)?.label||'Желаемое'}
function dateLabel(value:string|null){return value?new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long'}).format(new Date(value+'T12:00:00')):'Без срока'}
function statusCopy(status:ReturnType<typeof calculateForecast>['status']){
 return ({
  green:{title:'Можно тратить сегодня',subtitle:'Прогноз показывает запас до следующего дохода.',action:'Продолжай учитывать реальные расходы.'},
  yellow:{title:'Хватит, но без большого запаса',subtitle:'Лучше оставить часть денег на непредвиденные ситуации.',action:'Проверь желаемые расходы и ближайшие события.'},
  orange:{title:'Есть риск не дотянуть до дохода',subtitle:'Часть дефицита можно покрыть сокращением желаемых трат.',action:'Посмотри необязательные расходы за последние две недели.'},
  red:{title:'Прогноз показывает дефицит',subtitle:'Даже сокращения желаемых расходов может быть недостаточно.',action:'Пересмотри даты или суммы будущих обязательств.'},
  gray:{title:'Пока недостаточно данных',subtitle:'Добавь ближайший доход и операции за несколько разных дней.',action:'Прогноз станет доступен после настройки.'}
 })[status]
}
type Tab='now'|'movement'|'plans'
type Modal='operation'|'event'|'settings'|null
export default function FinancePage(){
 const [data,setData]=useState<FinanceData>(migrate)
 const [tab,setTab]=useState<Tab>('now')
 const [modal,setModal]=useState<Modal>(null)
 const [editingOperation,setEditingOperation]=useState<string|null>(null)
 const [editingEvent,setEditingEvent]=useState<string|null>(null)
 const [query,setQuery]=useState('')
 const [directionFilter,setDirectionFilter]=useState('all')
 const [categoryFilter,setCategoryFilter]=useState('all')
 const [period,setPeriod]=useState<'week'|'month'|'year'|'all'>('month')
 const [visible,setVisible]=useState(20)
 const [notice,setNotice]=useState('')
 const [opDraft,setOpDraft]=useState({direction:'expense' as 'income'|'expense',amount:'',category:'mandatory' as FinanceOperation['category'],title:'',comment:'',date:localDate(),eventId:''})
 const [eventDraft,setEventDraft]=useState({type:'regular' as FinanceEvent['type'],title:'',amount:'',currentAmount:'0',direction:'expense' as 'income'|'expense',category:'mandatory' as FinanceOperation['category'],isMandatory:true,nextDate:addDays(localDate(),1),recurrence:'monthly' as FinanceEvent['recurrence']})
 const [settingsDraft,setSettingsDraft]=useState({moneyNow:'',moneyNowMode:'manual' as 'manual'|'auto',moneyNowDate:localDate(),manualNextIncomeDate:'',manualNextIncomeAmount:'',avgDailyWindowDays:'14'})
 useEffect(()=>{try{localStorage.setItem(KEY,JSON.stringify(data))}catch{setNotice('Не удалось сохранить данные: проверь свободное место браузера.')}},[data])
 const today=localDate()
 const forecast=useMemo(()=>calculateForecast(data,today),[data,today])
 const status=statusCopy(forecast.status)
 const activeEvents=data.events.filter(e=>e.status==='active')
 const upcoming=activeEvents.filter(e=>['regular','one_time'].includes(e.type)&&e.nextDate).flatMap(e=>occurrences(e,today,addDays(today,45)).map(date=>({event:e,date}))).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,4)
 const goals=activeEvents.filter(e=>['goal','debt_i_owe','debt_owed_to_me'].includes(e.type))
 const from=period==='week'?addDays(today,-6):period==='month'?today.slice(0,7)+'-01':period==='year'?today.slice(0,4)+'-01-01':'0000-01-01'
 const periodOps=data.operations.filter(o=>o.date>=from&&o.date<=today)
 const income=periodOps.filter(o=>o.direction==='income').reduce((s,o)=>s+o.amount,0)
 const expense=periodOps.filter(o=>o.direction==='expense').reduce((s,o)=>s+o.amount,0)
 const movement=useMemo(()=>data.operations.filter(o=>(directionFilter==='all'||o.direction===directionFilter)&&(categoryFilter==='all'||o.category===categoryFilter)&&(!query||[o.title,o.comment].join(' ').toLowerCase().includes(query.toLowerCase()))).filter(o=>o.date>=from&&o.date<=today).sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt)),[data.operations,directionFilter,categoryFilter,query,from,today])
 const shown=movement.slice(0,visible)
 const spendByCategory=categories.map(c=>({id:c.id,label:c.label,amount:periodOps.filter(o=>o.direction==='expense'&&o.category===c.id).reduce((s,o)=>s+o.amount,0)}))
 const notify=(message:string)=>{setNotice(message);window.setTimeout(()=>setNotice(''),2600)}
 function openOperation(operation?:FinanceOperation){
  setEditingOperation(operation?.id||null)
  setOpDraft(operation?{direction:operation.direction,amount:(operation.amount/100).toFixed(2),category:operation.category,title:operation.title,comment:operation.comment,date:operation.date,eventId:operation.eventId||''}:{direction:'expense',amount:'',category:'mandatory',title:'',comment:'',date:today,eventId:''})
  setModal('operation')
 }
 function saveOperation(e:FormEvent){
  e.preventDefault();const amount=toMinor(opDraft.amount)
  if(!Number.isSafeInteger(amount)||amount<=0||!opDraft.title.trim()){notify('Укажи название и корректную сумму.');return}
  const timestamp=new Date().toISOString()
  const previous=data.operations.find(o=>o.id===editingOperation)
  const operation:FinanceOperation={id:editingOperation||uid(),eventId:opDraft.eventId||null,amount,direction:opDraft.direction,category:opDraft.category,title:opDraft.title.trim(),comment:opDraft.comment.trim(),date:opDraft.date,createdAt:previous?.createdAt||timestamp,updatedAt:timestamp}
  setData(current=>{
   let events=current.events.map(event=>{
    let progress=event.currentAmount
    if(previous?.eventId===event.id)progress+=previous.direction==='income'?-previous.amount:previous.amount
    if(operation.eventId===event.id)progress+=operation.direction==='income'?operation.amount:-operation.amount
    return {...event,currentAmount:Math.max(0,Math.min(event.amount,progress)),updatedAt:timestamp}
   })
   return {...current,events,operations:editingOperation?current.operations.map(o=>o.id===editingOperation?operation:o):[operation,...current.operations]}
  })
  setModal(null);setEditingOperation(null);notify(editingOperation?'Операция обновлена':'Операция добавлена')
 }
 function deleteOperation(operation:FinanceOperation){
  setData(current=>({...current,events:current.events.map(e=>e.id===operation.eventId?{...e,currentAmount:Math.max(0,Math.min(e.amount,e.currentAmount+(operation.direction==='income'?operation.amount:-operation.amount))),status:e.type==='one_time'?'active':e.status,nextDate:e.type==='regular'&&!current.operations.some(o=>o.eventId===e.id&&o.date>operation.date)?operation.date:e.nextDate,updatedAt:new Date().toISOString()}:e),operations:current.operations.filter(o=>o.id!==operation.id)}))
 }
 function openEvent(event?:FinanceEvent,initialType:FinanceEvent['type']='regular'){
  setEditingEvent(event?.id||null)
  setEventDraft(event?{type:event.type,title:event.title,amount:(event.amount/100).toFixed(2),currentAmount:(event.currentAmount/100).toFixed(2),direction:event.direction||'expense',category:event.category||'mandatory',isMandatory:event.isMandatory,nextDate:event.nextDate||'',recurrence:event.recurrence}:{type:initialType,title:'',amount:'',currentAmount:'0',direction:'expense',category:'mandatory',isMandatory:true,nextDate:addDays(today,1),recurrence:'monthly'})
  setModal('event')
 }
 function saveEvent(e:FormEvent){
  e.preventDefault();const amount=toMinor(eventDraft.amount),currentAmount=toMinor(eventDraft.currentAmount)
  if(!eventDraft.title.trim()||!Number.isSafeInteger(amount)||amount<=0){notify('Проверь название и сумму.');return}
  if(['goal','debt_i_owe','debt_owed_to_me'].includes(eventDraft.type)&&(!Number.isSafeInteger(currentAmount)||currentAmount<0||currentAmount>amount)){notify('Прогресс должен быть от нуля до общей суммы.');return}
  if(['regular','one_time'].includes(eventDraft.type)&&!eventDraft.nextDate){notify('Укажи дату события.');return}
  const timestamp=new Date().toISOString(),old=data.events.find(x=>x.id===editingEvent)
  const item:FinanceEvent={id:editingEvent||uid(),type:eventDraft.type,title:eventDraft.title.trim(),amount,currentAmount:old?old.currentAmount:['goal','debt_i_owe','debt_owed_to_me'].includes(eventDraft.type)?currentAmount:0,direction:['regular','one_time'].includes(eventDraft.type)?eventDraft.direction:undefined,category:['regular','one_time'].includes(eventDraft.type)?eventDraft.category:undefined,isMandatory:['regular','one_time'].includes(eventDraft.type)&&eventDraft.direction==='expense'&&eventDraft.isMandatory,nextDate:eventDraft.nextDate||null,recurrence:eventDraft.type==='regular'?eventDraft.recurrence:'none',status:old?.status||'active',createdAt:old?.createdAt||timestamp,updatedAt:timestamp}
  setData(v=>({...v,events:editingEvent?v.events.map(x=>x.id===editingEvent?item:x):[item,...v.events]}));setModal(null);setEditingEvent(null);notify(editingEvent?'План обновлён':'План добавлен')
 }
 function executeEvent(event:FinanceEvent,date=event.nextDate||today){
  if(!event.direction||!event.category)return
  if(data.operations.some(o=>o.eventId===event.id&&o.date===date)){notify('Это событие уже отмечено.');return}
  const timestamp=new Date().toISOString()
  const operation:FinanceOperation={id:uid(),eventId:event.id,amount:event.amount,direction:event.direction,category:event.category,title:event.title,comment:'Исполнение запланированного события',date,createdAt:timestamp,updatedAt:timestamp}
  setData(v=>({...v,operations:[operation,...v.operations],events:v.events.map(e=>e.id===event.id?{...e,nextDate:e.type==='regular'?shiftDate(date,e.recurrence):e.nextDate,status:e.type==='one_time'?'done':e.status,updatedAt:timestamp}:e)}))
  notify('Событие отмечено. Прогноз обновлён.')
 }
 function executeProgress(event:FinanceEvent){
  const raw=window.prompt(event.type==='goal'?'Сколько добавить к накоплению?':event.type==='debt_i_owe'?'Сколько выплатил?':'Сколько получил?')
  if(raw===null)return
  const amount=toMinor(raw);if(!Number.isSafeInteger(amount)||amount<=0||amount>event.amount-event.currentAmount){notify('Сумма превышает оставшуюся часть.');return}
  const timestamp=new Date().toISOString()
  const operation:FinanceOperation={id:uid(),eventId:event.id,amount,direction:event.type==='debt_owed_to_me'?'income':'expense',category:event.type==='goal'?'desired':'mandatory',title:event.title,comment:'Частичное изменение финансовой цели',date:today,createdAt:timestamp,updatedAt:timestamp}
  setData(v=>({...v,operations:[operation,...v.operations],events:v.events.map(e=>e.id===event.id?{...e,currentAmount:e.currentAmount+amount,updatedAt:timestamp}:e)}))
  notify('Прогресс обновлён через операцию.')
 }
 function saveSettings(e:FormEvent){
  e.preventDefault();const moneyNow=toMinor(settingsDraft.moneyNow),incomeAmount=toMinor(settingsDraft.manualNextIncomeAmount)
  if(!Number.isSafeInteger(moneyNow)||!Number.isSafeInteger(incomeAmount)||incomeAmount<0){notify('Проверь суммы.');return}
  setData(v=>({...v,settings:{...v.settings,moneyNow,moneyNowDate:settingsDraft.moneyNowDate,moneyNowMode:settingsDraft.moneyNowMode,manualNextIncomeDate:settingsDraft.manualNextIncomeDate,manualNextIncomeAmount:incomeAmount,avgDailyWindowDays:Math.max(3,Math.min(90,Number(settingsDraft.avgDailyWindowDays)||14))}}))
  setModal(null);notify('Настройки прогноза сохранены.')
 }
 function openSettings(){
  setSettingsDraft({moneyNow:(data.settings.moneyNow/100).toFixed(2),moneyNowMode:data.settings.moneyNowMode,moneyNowDate:data.settings.moneyNowDate,manualNextIncomeDate:data.settings.manualNextIncomeDate,manualNextIncomeAmount:(data.settings.manualNextIncomeAmount/100).toFixed(2),avgDailyWindowDays:String(data.settings.avgDailyWindowDays)})
  setModal('settings')
 }
 return <section className="ff-finance">
  <header className="ff-fin-head"><div><span className="ff-kicker">FOCUSFLOW · ДЕНЕЖНЫЙ ПОТОК</span><h1>Финансы</h1><p>Понимай, сколько можешь потратить до следующего дохода.</p></div><button className="ff-primary" onClick={()=>openOperation()}><Plus size={16}/> Операция</button></header>
  <nav className="ff-fin-nav">{([{id:'now',label:'Сейчас'},{id:'movement',label:'Движение'},{id:'plans',label:'Планы'}] as const).map(item=><button key={item.id} className={tab===item.id?'active':''} onClick={()=>setTab(item.id)}>{item.label}</button>)}</nav>
  {tab==='now'&&<div className="ff-fin-stack">
   <article className={'ff-fin-forecast '+forecast.status}><div className="ff-fin-forecast-top"><div><span className="ff-fin-eyebrow">ВАША СИТУАЦИЯ</span><h2>{status.title}</h2></div><span className="ff-fin-status-dot"/></div>
    {forecast.status==='gray'?<p>{status.subtitle}</p>:<><strong className="ff-fin-daily">{money(forecast.dailyLimit)} <small>/ день</small></strong><p>{status.subtitle}</p><div className="ff-fin-forecast-grid"><div><span>До следующего дохода</span><b>{dateLabel(forecast.nextIncomeDate)} · {forecast.daysLeft} дн.</b></div><div><span>Прогнозный остаток</span><b className={forecast.forecastLeft<0?'negative':'positive'}>{money(forecast.forecastLeft)}</b></div></div></>}
    <div className="ff-fin-forecast-footer"><span>{status.action}</span><button onClick={openSettings}>Настроить прогноз <ChevronDown size={14}/></button></div>
   </article>
   <div className="ff-fin-metrics"><article><span>Сейчас по расчёту</span><strong>{money(forecast.currentBalance)}</strong></article><article><span>Обязательства до дохода</span><strong>{money(forecast.mandatoryEvents)}</strong></article><article><span>Ожидаемый доход</span><strong className="positive">+{money(forecast.nextIncomeAmount)}</strong></article></div>
   <div className="ff-fin-grid"><article className="ff-fin-card"><div className="ff-fin-card-head"><h2>Ближайшие события</h2><button onClick={()=>setTab('plans')}>Все планы →</button></div>{upcoming.map(({event,date})=><div className="ff-fin-event-row" key={event.id+date}><div><b>{event.title}</b><small>{dateLabel(date)} · {event.direction==='income'?'Поступление':'Расход'}{event.isMandatory?' · обязательное':' · желаемое'}</small></div><strong>{money(event.amount)}</strong>{date===event.nextDate&&<button className="ff-fin-icon" onClick={()=>executeEvent(event,date)} title="Отметить исполненным"><Check size={15}/></button>}</div>)}{!upcoming.length&&<p className="ff-fin-empty">Добавь будущий доход или обязательный платёж — появится прогноз.</p>}</article>
    <article className="ff-fin-card"><div className="ff-fin-card-head"><h2>Мои цели и долги</h2><button onClick={()=>openEvent()}>Добавить +</button></div>{goals.slice(0,4).map(event=><div className="ff-fin-goal-row" key={event.id}><div className="ff-fin-goal-top"><b>{event.title}</b><small>{event.type==='goal'?'Накопление':event.type==='debt_i_owe'?'Я должен':'Мне должны'} · {money(event.currentAmount)} / {money(event.amount)}</small></div><div className="ff-fin-progress"><span style={{width:eventProgress(event)+'%'}}/></div></div>)}{!goals.length&&<p className="ff-fin-empty">Добавь цель накопления или долг, чтобы видеть остаток и прогресс.</p>}</article></div>
   <article className="ff-fin-card"><div className="ff-fin-card-head"><h2>Последние операции</h2><button onClick={()=>setTab('movement')}>Вся история →</button></div>{data.operations.slice().sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt)).slice(0,5).map(o=><OperationRow key={o.id} operation={o} onEdit={()=>openOperation(o)} onDelete={()=>deleteOperation(o)}/>)}{!data.operations.length&&<p className="ff-fin-empty">Операций пока нет. Добавь первую фактическую трату или доход.</p>}</article>
  </div>}
  {tab==='movement'&&<div className="ff-fin-stack">
   <div className="ff-fin-period"><span>Период</span>{(['week','month','year','all'] as const).map(p=><button key={p} className={period===p?'active':''} onClick={()=>{setPeriod(p);setVisible(20)}}>{p==='week'?'Неделя':p==='month'?'Месяц':p==='year'?'Год':'Всё время'}</button>)}</div>
   <div className="ff-fin-metrics"><article><span>Пришло</span><strong className="positive">+{money(income)}</strong></article><article><span>Ушло</span><strong className="negative">−{money(expense)}</strong></article><article><span>Разница</span><strong>{money(income-expense)}</strong></article></div>
   <article className="ff-fin-card"><div className="ff-fin-card-head"><h2>Расходы по смыслу</h2><span className="ff-fin-muted">За период</span></div>{spendByCategory.map(c=><div className="ff-fin-category" key={c.id}><span>{c.label}</span><strong>{money(c.amount)}</strong></div>)}</article>
   <div className="ff-fin-toolbar"><div><h2>История операций</h2><p>{movement.length} записей · показано {Math.min(visible,movement.length)}</p></div><button className="ff-primary" onClick={()=>openOperation()}><Plus size={15}/> Добавить</button></div>
   <div className="ff-fin-filters"><label><Search size={15}/><input value={query} onChange={e=>{setQuery(e.target.value);setVisible(20)}} placeholder="Поиск по названию и комментарию"/></label><select value={directionFilter} onChange={e=>{setDirectionFilter(e.target.value);setVisible(20)}}><option value="all">Все направления</option><option value="income">Доходы</option><option value="expense">Расходы</option></select><select value={categoryFilter} onChange={e=>{setCategoryFilter(e.target.value);setVisible(20)}}><option value="all">Все категории</option>{categories.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></div>
   <div className="ff-fin-list">{shown.map(o=><OperationRow key={o.id} operation={o} onEdit={()=>openOperation(o)} onDelete={()=>deleteOperation(o)}/>)}{!shown.length&&<p className="ff-fin-empty">За этот период операций нет.</p>}{visible<movement.length&&<button className="ff-fin-load" onClick={()=>setVisible(v=>v+20)}>Показать ещё 20</button>}</div>
  </div>}
  {tab==='plans'&&<div className="ff-fin-stack">
   <div className="ff-fin-toolbar"><div><h2>Будущие события</h2><p>Платежи, поступления, накопления и долги в одном месте.</p></div><button className="ff-primary" onClick={()=>openEvent()}><Plus size={15}/> Новый план</button></div>
   {(['regular','one_time','goal','debt_i_owe','debt_owed_to_me'] as const).map(type=><article className="ff-fin-card" key={type}><div className="ff-fin-card-head"><h2>{({regular:'Регулярные события',one_time:'Разовые события',goal:'Накопления',debt_i_owe:'Я должен',debt_owed_to_me:'Мне должны'})[type]}</h2><button onClick={()=>openEvent(undefined,type)}>Добавить +</button></div>{activeEvents.filter(e=>e.type===type).map(event=><div className="ff-fin-plan-row" key={event.id}><div className="ff-fin-plan-main"><b>{event.title}</b><small>{money(event.amount)}{event.type==='regular'?' · '+({weekly:'еженедельно',monthly:'ежемесячно',yearly:'ежегодно',none:''}[event.recurrence]):''} · {dateLabel(event.nextDate)}</small>{['goal','debt_i_owe','debt_owed_to_me'].includes(event.type)&&<div className="ff-fin-progress"><span style={{width:eventProgress(event)+'%'}}/></div>}</div><div className="ff-fin-plan-actions">{['goal','debt_i_owe','debt_owed_to_me'].includes(event.type)?<button className="ff-fin-confirm" onClick={()=>executeProgress(event)}>Внести сумму</button>:event.nextDate&&<button className="ff-fin-confirm" onClick={()=>executeEvent(event)}>Исполнено</button>}<button className="ff-fin-icon" onClick={()=>openEvent(event)} aria-label="Редактировать"><Pencil size={14}/></button><button className="ff-fin-icon" onClick={()=>setData(v=>({...v,events:v.events.map(e=>e.id===event.id?{...e,status:'archived'}:e)}))} aria-label="Архивировать"><X size={14}/></button></div></div>)}{!activeEvents.some(e=>e.type===type)&&<p className="ff-fin-empty">Пока нет записей.</p>}</article>)}
  </div>}
  {modal&&<div className="ff-fin-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setModal(null)}}><form className="ff-fin-modal" onSubmit={modal==='operation'?saveOperation:modal==='event'?saveEvent:saveSettings}>
   <div className="ff-fin-modal-head"><h2>{modal==='operation'?(editingOperation?'Редактировать операцию':'Новая операция'):modal==='event'?(editingEvent?'Редактировать план':'Новое событие'):'Настройка прогноза'}</h2><button type="button" onClick={()=>setModal(null)}><X size={18}/></button></div>
   {modal==='operation'&&<><div className="ff-fin-type-switch two"><button type="button" className={opDraft.direction==='expense'?'active':''} onClick={()=>setOpDraft(v=>({...v,direction:'expense'}))}><ArrowUpRight size={15}/> Расход</button><button type="button" className={opDraft.direction==='income'?'active':''} onClick={()=>setOpDraft(v=>({...v,direction:'income'}))}><ArrowDownLeft size={15}/> Доход</button></div><label>Сумма, ₽<input autoFocus required inputMode="decimal" value={opDraft.amount} onChange={e=>setOpDraft(v=>({...v,amount:e.target.value}))} placeholder="0"/></label><label>Категория<select value={opDraft.category} onChange={e=>setOpDraft(v=>({...v,category:e.target.value as FinanceOperation['category']}))}>{categories.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></label><label>Название<input required value={opDraft.title} onChange={e=>setOpDraft(v=>({...v,title:e.target.value}))} placeholder="Например, Продукты"/></label><label>Дата<input type="date" value={opDraft.date} onChange={e=>setOpDraft(v=>({...v,date:e.target.value}))}/></label><label>Комментарий<textarea value={opDraft.comment} onChange={e=>setOpDraft(v=>({...v,comment:e.target.value}))} placeholder="Необязательно"/></label></>}
   {modal==='event'&&<><label>Тип события<select value={eventDraft.type} onChange={e=>setEventDraft(v=>({...v,type:e.target.value as FinanceEvent['type']}))}><option value="regular">Регулярное событие</option><option value="one_time">Разовое событие</option><option value="goal">Накопить сумму</option><option value="debt_i_owe">Я должен</option><option value="debt_owed_to_me">Мне должны</option></select></label><label>Название<input required autoFocus value={eventDraft.title} onChange={e=>setEventDraft(v=>({...v,title:e.target.value}))}/></label><label>Сумма, ₽<input required inputMode="decimal" value={eventDraft.amount} onChange={e=>setEventDraft(v=>({...v,amount:e.target.value}))}/></label>{['regular','one_time'].includes(eventDraft.type)&&<><div className="ff-fin-type-switch two"><button type="button" className={eventDraft.direction==='expense'?'active':''} onClick={()=>setEventDraft(v=>({...v,direction:'expense'}))}>Расход</button><button type="button" className={eventDraft.direction==='income'?'active':''} onClick={()=>setEventDraft(v=>({...v,direction:'income'}))}>Доход</button></div><label>Дата<input required type="date" value={eventDraft.nextDate} onChange={e=>setEventDraft(v=>({...v,nextDate:e.target.value}))}/></label><label>Категория<select value={eventDraft.category} onChange={e=>setEventDraft(v=>({...v,category:e.target.value as FinanceOperation['category']}))}>{categories.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></label>{eventDraft.direction==='expense'&&<label className="ff-fin-check"><input type="checkbox" checked={eventDraft.isMandatory} onChange={e=>setEventDraft(v=>({...v,isMandatory:e.target.checked}))}/> Обязательное событие, учитывать в прогнозе</label>}{eventDraft.type==='regular'&&<label>Повтор<select value={eventDraft.recurrence} onChange={e=>setEventDraft(v=>({...v,recurrence:e.target.value as FinanceEvent['recurrence']}))}><option value="weekly">Еженедельно</option><option value="monthly">Ежемесячно</option><option value="yearly">Ежегодно</option></select></label>}</>}{['goal','debt_i_owe','debt_owed_to_me'].includes(eventDraft.type)&&<><label>Уже внесено / погашено / получено, ₽<input inputMode="decimal" value={eventDraft.currentAmount} onChange={e=>setEventDraft(v=>({...v,currentAmount:e.target.value}))}/></label><label>Срок (необязательно)<input type="date" value={eventDraft.nextDate} onChange={e=>setEventDraft(v=>({...v,nextDate:e.target.value}))}/></label></>}</>}
   {modal==='settings'&&<><label>Сколько денег сейчас, ₽<input required inputMode="decimal" value={settingsDraft.moneyNow} onChange={e=>setSettingsDraft(v=>({...v,moneyNow:e.target.value}))}/></label><label>Как учитывать операции<select value={settingsDraft.moneyNowMode} onChange={e=>setSettingsDraft(v=>({...v,moneyNowMode:e.target.value as 'manual'|'auto'}))}><option value="manual">Ручная сверка (операции не меняют сумму)</option><option value="auto">Автоматически по операциям после даты сверки</option></select></label><label>Дата, на которую сверена сумма<input type="date" value={settingsDraft.moneyNowDate} onChange={e=>setSettingsDraft(v=>({...v,moneyNowDate:e.target.value}))}/></label><div className="ff-fin-form-grid"><label>Ближайший доход — дата<input type="date" value={settingsDraft.manualNextIncomeDate} onChange={e=>setSettingsDraft(v=>({...v,manualNextIncomeDate:e.target.value}))}/></label><label>Сумма дохода, ₽<input inputMode="decimal" value={settingsDraft.manualNextIncomeAmount} onChange={e=>setSettingsDraft(v=>({...v,manualNextIncomeAmount:e.target.value}))}/></label></div><label>Окно среднего расхода, дней<input type="number" min="3" max="90" value={settingsDraft.avgDailyWindowDays} onChange={e=>setSettingsDraft(v=>({...v,avgDailyWindowDays:e.target.value}))}/></label><p className="ff-fin-muted">Если добавлен регулярный или разовый доход в «Планах», он имеет приоритет над ручной датой. При ручном режиме обновляй сумму после сверки наличных и карт.</p></>}
   <div className="ff-fin-modal-actions"><button type="button" className="ff-secondary" onClick={()=>setModal(null)}>Отмена</button><button className="ff-primary" type="submit"><Check size={15}/> Сохранить</button></div>
  </form></div>}
  {notice&&<div className="ff-fin-notice">{notice}</div>}
 </section>
}
function OperationRow({operation,onEdit,onDelete}:{operation:FinanceOperation;onEdit:()=>void;onDelete:()=>void}){
 return <div className="ff-fin-transaction-row"><span className={'ff-fin-transaction-icon '+operation.direction}>{operation.direction==='income'?<ArrowDownLeft size={17}/>:<ArrowUpRight size={17}/>}</span><div className="ff-fin-transaction-copy"><b>{operation.title}</b><small>{dateLabel(operation.date)} · {labelCategory(operation.category)}</small>{operation.comment&&<small>{operation.comment}</small>}</div><strong className={operation.direction==='income'?'positive':'negative'}>{operation.direction==='income'?'+':'−'}{money(operation.amount)}</strong><button className="ff-fin-icon" onClick={onEdit} aria-label="Редактировать"><Pencil size={14}/></button><button className="ff-fin-icon" onClick={onDelete} aria-label="Удалить"><Trash2 size={14}/></button></div>
}
