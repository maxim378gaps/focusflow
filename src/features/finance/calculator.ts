export type FinanceDirection = 'income' | 'expense'
export type FinanceCategory = 'mandatory' | 'desired' | 'emergency' | 'main_income' | 'additional_income' | 'one_time_income' | 'refund' | 'other_income'
export type Recurrence = 'none' | 'weekly' | 'monthly' | 'yearly'
export type FinancePlanKind = 'salary'|'savings'|'recurring'|'credit'|'debt'|'side_income'|'custom'
export type FinanceEvent = {
  id:string; type:'regular'|'one_time'|'goal'|'debt_i_owe'|'debt_owed_to_me'; planKind?:FinancePlanKind; title:string
  amount:number; currentAmount:number; direction?:FinanceDirection; category?:FinanceCategory
  isMandatory:boolean; nextDate:string|null; recurrence:Recurrence; status:'active'|'done'|'archived'
  createdAt:string; updatedAt:string
}
export type FinanceOperation = {
  id:string; eventId:string|null; amount:number; direction:FinanceDirection; category:FinanceCategory
  title:string; comment:string; date:string; createdAt:string; updatedAt:string; taskId?:string
}
export type FinanceSettings = {
  currency:'RUB'; moneyNow:number; moneyNowDate:string; moneyNowUpdatedAt:string; moneyNowMode:'auto'
  manualNextIncomeDate:string; manualNextIncomeAmount:number; avgDailyWindowDays:number; timezone:string
  trackingStartedAt:string
}
export type FinanceData = {version:4;settings:FinanceSettings;events:FinanceEvent[];operations:FinanceOperation[]}
export type Forecast = {
  currentBalance:number; nextIncomeDate:string|null; nextIncomeAmount:number; mandatoryEvents:number
  available:number; daysLeft:number; dailyLimit:number; averageDailySpend:number; forecastLeft:number
  status:'green'|'yellow'|'orange'|'red'|'gray'; desiredSpendWindow:number
  mode:'locked'|'preliminary'|'full'; daysUsing:number; futureExpenses:number
}
export const DAY=86400000
export const toMinor=(value:string)=>Math.round(Number(value.replace(',','.'))*100)
export const money=(minor:number)=>new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB',maximumFractionDigits:2}).format(minor/100)
export const localDate=(date=new Date())=>[date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-')
export const addDays=(value:string,n:number)=>{const d=new Date(value+'T12:00:00');d.setDate(d.getDate()+n);return localDate(d)}
export const dayDiff=(from:string,to:string)=>Math.round((Date.parse(to+'T12:00:00')-Date.parse(from+'T12:00:00'))/DAY)
export function shiftDate(value:string,recurrence:Recurrence){
 const d=new Date(value+'T12:00:00')
 if(recurrence==='weekly')d.setDate(d.getDate()+7)
 if(recurrence==='monthly'){const day=d.getDate();d.setDate(1);d.setMonth(d.getMonth()+1);const last=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();d.setDate(Math.min(day,last))}
 if(recurrence==='yearly'){const month=d.getMonth(),day=d.getDate();d.setDate(1);d.setFullYear(d.getFullYear()+1);d.setMonth(month);d.setDate(Math.min(day,new Date(d.getFullYear(),month+1,0).getDate()))}
 return localDate(d)
}
export function operationDelta(operations:FinanceOperation[],settings:FinanceSettings,today=localDate()){
 return operations.filter(o=>o.createdAt>settings.moneyNowUpdatedAt&&o.date<=today).reduce((sum,o)=>sum+(o.direction==='income'?o.amount:-o.amount),0)
}
export function currentBalance(operations:FinanceOperation[],settings:FinanceSettings,today=localDate()){
 return settings.moneyNow+operationDelta(operations,settings,today)
}
export function occurrences(event:FinanceEvent,from:string,to:string){
 if(!event.nextDate||event.status!=='active'||!['regular','one_time'].includes(event.type))return [] as string[]
 const result:string[]=[];let date=event.nextDate
 while(date<=to&&result.length<500){if(date>=from)result.push(date);if(event.type==='one_time'||event.recurrence==='none')break;const next=shiftDate(date,event.recurrence);if(next<=date)break;date=next}
 return result
}
function emptyForecast(balance:number,mode:Forecast['mode'],daysUsing:number):Forecast{
 return {currentBalance:balance,nextIncomeDate:null,nextIncomeAmount:0,mandatoryEvents:0,available:balance,daysLeft:0,dailyLimit:0,averageDailySpend:0,forecastLeft:balance,status:'gray',desiredSpendWindow:0,mode,daysUsing,futureExpenses:0}
}
export function calculateForecast(data:FinanceData,today=localDate()):Forecast{
 const {settings,events,operations}=data
 const balance=currentBalance(operations,settings,today)
 const started=settings.trackingStartedAt||settings.moneyNowDate||today
 const daysUsing=Math.max(1,dayDiff(started,today)+1)
 const mode:Forecast['mode']=daysUsing<7?'locked':daysUsing<30?'preliminary':'full'

 // Future income operations are primary facts. Scheduled income events are a fallback;
 // matching date + amount entries are treated as one income, never added twice.
 const incomeOperations=operations.filter(o=>o.direction==='income')
 const futureIncomeOps=incomeOperations.filter(o=>o.date>today)
 const eventIncome=events.filter(e=>e.status==='active'&&['regular','one_time'].includes(e.type)&&e.direction==='income')
  .flatMap(e=>occurrences(e,today,'9999-12-31').map(date=>({date,amount:e.amount,title:e.title,eventId:e.id,source:'event' as const})))
 const incomeCandidates:{date:string;amount:number;title:string;eventId?:string;source:'operation'|'event'|'settings'}[]=futureIncomeOps.map(o=>({date:o.date,amount:o.amount,title:o.title,eventId:o.eventId||undefined,source:'operation'}))
 for(const item of eventIncome){
  const alreadyReceivedToday=incomeOperations.some(op=>op.date===item.date&&op.amount===item.amount)
  const duplicate=alreadyReceivedToday||incomeCandidates.some(op=>op.date===item.date&&op.amount===item.amount)
  if(!duplicate)incomeCandidates.push(item)
 }
 const fallback=settings.manualNextIncomeDate>=today&&settings.manualNextIncomeDate&&settings.manualNextIncomeAmount>0
  ?{date:settings.manualNextIncomeDate,amount:settings.manualNextIncomeAmount,title:'Ожидаемый доход',source:'settings' as const}:null
 if(fallback&&!incomeCandidates.some(x=>x.date===fallback.date&&x.amount===fallback.amount))incomeCandidates.push(fallback)
 incomeCandidates.sort((a,b)=>a.date.localeCompare(b.date))
 const next=incomeCandidates[0]
 if(mode==='locked')return {...emptyForecast(balance,mode,daysUsing),nextIncomeDate:next?.date??null,nextIncomeAmount:next?.amount??0}
 if(!next)return emptyForecast(balance,mode,daysUsing)

 const daysLeft=Math.max(1,dayDiff(today,next.date))
 // Only dated future operations affect the day-to-day cash forecast.
 // Plan allocations (rent, debt repayment, savings goals) are tracked in Plans,
 // not silently deducted a second time from the daily spending allowance.
 const futureExpenses=operations.filter(o=>o.direction==='expense'&&o.date>today&&o.date<=next.date)
  .reduce((sum,o)=>sum+o.amount,0)
 const spendableUntilIncome=Math.max(0,balance-futureExpenses)
 const dailyLimit=Math.floor(spendableUntilIncome/daysLeft)
 const forecastLeft=balance+next.amount-futureExpenses
 const desiredSpendWindow=operations.filter(o=>o.direction==='expense'&&o.category==='desired'&&o.date<=today&&o.date>=addDays(today,-29)).reduce((s,o)=>s+o.amount,0)
 let status:Forecast['status']='gray'
 const ratio=next.amount>0?forecastLeft/next.amount:(forecastLeft>=0?1:-1)
 if(forecastLeft>=0&&ratio>0.15)status='green'
 else if(forecastLeft>=0)status='yellow'
 else if(desiredSpendWindow>=Math.abs(forecastLeft))status='orange'
 else status='red'
 return {currentBalance:balance,nextIncomeDate:next.date,nextIncomeAmount:next.amount,mandatoryEvents:0,available:spendableUntilIncome,daysLeft,dailyLimit,averageDailySpend:0,forecastLeft,status,desiredSpendWindow,mode,daysUsing,futureExpenses}
}
export function eventProgress(event:FinanceEvent){return Math.max(0,Math.min(100,event.amount>0?event.currentAmount/event.amount*100:0))}
