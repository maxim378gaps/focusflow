export type FinanceDirection = 'income' | 'expense'
export type FinanceCategory = 'mandatory' | 'desired' | 'emergency' | 'main_income' | 'additional_income' | 'one_time_income' | 'refund' | 'other_income'
export type Recurrence = 'none' | 'weekly' | 'monthly' | 'yearly'
export type FinanceEvent = {
  id:string; type:'regular'|'one_time'|'goal'|'debt_i_owe'|'debt_owed_to_me'; title:string
  amount:number; currentAmount:number; direction?:FinanceDirection; category?:FinanceCategory
  isMandatory:boolean; nextDate:string|null; recurrence:Recurrence; status:'active'|'done'|'archived'
  createdAt:string; updatedAt:string
}
export type FinanceOperation = {
  id:string; eventId:string|null; amount:number; direction:FinanceDirection; category:FinanceCategory
  title:string; comment:string; date:string; createdAt:string; updatedAt:string
}
export type FinanceSettings = {
  currency:'RUB'; moneyNow:number; moneyNowDate:string; moneyNowUpdatedAt:string; moneyNowMode:'auto'
  manualNextIncomeDate:string; manualNextIncomeAmount:number; avgDailyWindowDays:number; timezone:string
}
export type FinanceData = {version:3;settings:FinanceSettings;events:FinanceEvent[];operations:FinanceOperation[]}
export type Forecast = {
  currentBalance:number; nextIncomeDate:string|null; nextIncomeAmount:number; mandatoryEvents:number
  available:number; daysLeft:number; dailyLimit:number; averageDailySpend:number; forecastLeft:number
  status:'green'|'yellow'|'orange'|'red'|'gray'; desiredSpendWindow:number
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
export function operationDelta(operations:FinanceOperation[],settings:FinanceSettings){
 return operations.filter(o=>o.createdAt>settings.moneyNowUpdatedAt).reduce((sum,o)=>sum+(o.direction==='income'?o.amount:-o.amount),0)
}
export function currentBalance(operations:FinanceOperation[],settings:FinanceSettings){
 return settings.moneyNow+operationDelta(operations,settings)
}
export function occurrences(event:FinanceEvent,from:string,to:string){
 if(!event.nextDate||event.status!=='active'||!['regular','one_time'].includes(event.type))return [] as string[]
 const result:string[]=[];let date=event.nextDate
 while(date<=to&&result.length<500){if(date>=from)result.push(date);if(event.type==='one_time'||event.recurrence==='none')break;const next=shiftDate(date,event.recurrence);if(next<=date)break;date=next}
 return result
}
export function calculateForecast(data:FinanceData,today=localDate()):Forecast{
 const {settings,events,operations}=data
 const balance=currentBalance(operations,settings)
 const incomeEvents=events.filter(e=>e.status==='active'&&['regular','one_time'].includes(e.type)&&e.direction==='income')
 const candidates=incomeEvents.flatMap(e=>occurrences(e,today,'9999-12-31').map(date=>({date,amount:e.amount}))).sort((a,b)=>a.date.localeCompare(b.date))
 const next=candidates[0]??(settings.manualNextIncomeDate>=today&&settings.manualNextIncomeDate?{date:settings.manualNextIncomeDate,amount:settings.manualNextIncomeAmount}:null)
 if(!next)return {currentBalance:balance,nextIncomeDate:null,nextIncomeAmount:0,mandatoryEvents:0,available:balance,daysLeft:0,dailyLimit:0,averageDailySpend:0,forecastLeft:0,status:'gray',desiredSpendWindow:0}
 const mandatoryEvents=events.filter(e=>e.status==='active'&&e.isMandatory&&['regular','one_time'].includes(e.type)&&e.direction==='expense')
  .reduce((sum,e)=>sum+occurrences(e,today,next.date).filter(d=>d<=next.date).length*e.amount,0)
 const available=balance+next.amount-mandatoryEvents
 const daysLeft=Math.max(1,dayDiff(today,next.date))
 const dailyLimit=Math.max(0,Math.floor(available/daysLeft))
 const windowStart=addDays(today,-(settings.avgDailyWindowDays-1))
 const recent=operations.filter(o=>o.direction==='expense'&&o.category!=='mandatory'&&o.date>=windowStart&&o.date<=today)
 const spentByDay=new Map<string,number>()
 for(const op of recent)spentByDay.set(op.date,(spentByDay.get(op.date)||0)+op.amount)
 const averageDailySpend=[...spentByDay.values()].reduce((s,n)=>s+n,0)/settings.avgDailyWindowDays
 const forecastLeft=available-averageDailySpend*daysLeft
 const desiredSpendWindow=recent.filter(o=>o.category==='desired').reduce((s,o)=>s+o.amount,0)
 const operationDays=new Set(operations.filter(o=>o.date>=windowStart&&o.date<=today).map(o=>o.date)).size
 let status:Forecast['status']='gray'
 if(operationDays>=3){
  const ratio=next.amount>0?forecastLeft/next.amount:(forecastLeft>=0?1:-1)
  if(forecastLeft>=0&&ratio>0.15)status='green'
  else if(forecastLeft>=0)status='yellow'
  else if(desiredSpendWindow>=Math.abs(forecastLeft))status='orange'
  else status='red'
 }
 return {currentBalance:balance,nextIncomeDate:next.date,nextIncomeAmount:next.amount,mandatoryEvents,available,daysLeft,dailyLimit,averageDailySpend,forecastLeft,status,desiredSpendWindow}
}
export function eventProgress(event:FinanceEvent){return Math.max(0,Math.min(100,event.amount>0?event.currentAmount/event.amount*100:0))}
