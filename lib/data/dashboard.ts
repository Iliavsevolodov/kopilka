import {addDays,endOfMonth,startOfMonth} from "date-fns";
import {createClient} from "@/lib/supabase/server";
import {calculateCashFlow,calculateEmergencyFundMonths,calculateSafeToSpend,calculateSavingsRate,calculateTotalBalance} from "@/lib/finance/engine";
export async function getDashboardData(userId:string){
 const supabase=await createClient();const now=new Date();const monthStart=startOfMonth(now).toISOString();const monthEnd=endOfMonth(now).toISOString();const upcomingEnd=addDays(now,14).toISOString();
 const [profileResult,accountsResult,monthTxResult,recentResult,categoriesResult,recurringResult,goalsResult]=await Promise.all([
  supabase.from("profiles").select("display_name,currency,timezone,emergency_fund_months").eq("id",userId).single(),
  supabase.from("accounts").select("id,name,type,current_balance_minor,include_in_total").eq("user_id",userId).eq("is_archived",false).order("created_at"),
  supabase.from("transactions").select("type,amount_minor,is_mandatory").eq("user_id",userId).gte("transaction_date",monthStart).lte("transaction_date",monthEnd).limit(2000),
  supabase.from("transactions").select("id,type,amount_minor,description,transaction_date,account_id,destination_account_id,category_id").eq("user_id",userId).order("transaction_date",{ascending:false}).limit(8),
  supabase.from("categories").select("id,name,icon,kind").eq("user_id",userId),
  supabase.from("recurring_transaction_templates").select("id,name,amount_minor,type,next_occurrence").eq("user_id",userId).eq("is_active",true).gte("next_occurrence",now.toISOString()).lte("next_occurrence",upcomingEnd).order("next_occurrence").limit(20),
  supabase.from("financial_goals").select("current_amount_minor").eq("user_id",userId).eq("is_archived",false)
 ]);
 for(const r of [profileResult,accountsResult,monthTxResult,recentResult,categoriesResult,recurringResult,goalsResult])if(r.error)throw r.error;
 const profile=profileResult.data;const accounts=accountsResult.data??[];const monthTx=monthTxResult.data??[];const upcoming=recurringResult.data??[];
 const totalBalanceMinor=calculateTotalBalance(accounts.map(a=>({id:a.id,balanceMinor:Number(a.current_balance_minor),includeInTotal:a.include_in_total})));
 const cashFlow=calculateCashFlow(monthTx.map(t=>({type:t.type,amountMinor:Number(t.amount_minor)})));
 const mandatory=monthTx.filter(t=>t.type==="expense"&&t.is_mandatory).reduce((s,t)=>s+Number(t.amount_minor),0);
 const obligations=upcoming.filter(i=>i.type==="expense").reduce((s,i)=>s+Number(i.amount_minor),0);
 const reserved=(goalsResult.data??[]).reduce((s,g)=>s+Number(g.current_amount_minor),0);
 const reserve=mandatory*Number(profile.emergency_fund_months);
 return {profile,accounts:accounts.map(a=>({...a,current_balance_minor:Number(a.current_balance_minor)})),recentTransactions:(recentResult.data??[]).map(t=>({...t,amount_minor:Number(t.amount_minor)})),categories:categoriesResult.data??[],upcoming:upcoming.map(i=>({...i,amount_minor:Number(i.amount_minor)})),metrics:{totalBalanceMinor,incomeMinor:cashFlow.incomeMinor,expensesMinor:cashFlow.expensesMinor,netMinor:cashFlow.netMinor,savingsRate:calculateSavingsRate(cashFlow.incomeMinor,cashFlow.expensesMinor),safeToSpendMinor:calculateSafeToSpend({liquidBalanceMinor:totalBalanceMinor,obligationsUntilNextIncomeMinor:obligations,reservedGoalMoneyMinor:reserved,minimumEmergencyReserveMinor:reserve}),emergencyFundMonths:calculateEmergencyFundMonths(totalBalanceMinor,mandatory)}};
}
