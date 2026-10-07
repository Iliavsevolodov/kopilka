"use server";
import{redirect}from"next/navigation";
import{z}from"zod";
import{createClient}from"@/lib/supabase/server";
import{DEFAULT_CATEGORIES}from"@/lib/domain/categories";
import{parseMajorToMinor}from"@/lib/finance/money";

const schema=z.object({
 displayName:z.string().trim().min(1).max(80),
 currency:z.enum(["RUB","USD","EUR"]),
 initialBalance:z.string().transform((v,ctx)=>{try{return parseMajorToMinor(v||"0")}catch{ctx.addIssue({code:"custom",message:"Некорректный баланс"});return z.NEVER}}),
 monthlyIncome:z.string().transform((v,ctx)=>{try{return parseMajorToMinor(v||"0")}catch{ctx.addIssue({code:"custom",message:"Некорректный доход"});return z.NEVER}}),
 emergencyFundMonths:z.coerce.number().min(1).max(24)
});

export async function completeOnboardingAction(fd:FormData){
 const p=schema.safeParse({displayName:fd.get("displayName"),currency:fd.get("currency"),initialBalance:fd.get("initialBalance"),monthlyIncome:fd.get("monthlyIncome"),emergencyFundMonths:fd.get("emergencyFundMonths")});
 if(!p.success)redirect("/onboarding?error=Проверьте введённые данные");
 const s=await createClient();const{data:claims}=await s.auth.getClaims();const userId=claims?.claims?.sub;if(!userId)redirect("/login");
 const{error:profileError}=await s.from("profiles").upsert({id:userId,display_name:p.data.displayName,currency:p.data.currency,timezone:"Europe/Moscow",locale:"ru-RU",monthly_income_target_minor:p.data.monthlyIncome,emergency_fund_months:p.data.emergencyFundMonths,onboarding_completed:false,updated_at:new Date().toISOString()});
 if(profileError)redirect("/onboarding?error=Не удалось сохранить профиль");
 const{count}=await s.from("accounts").select("id",{count:"exact",head:true}).eq("user_id",userId);
 if(!count){const{error}=await s.from("accounts").insert({user_id:userId,name:"Основная карта",type:"card",currency:p.data.currency,current_balance_minor:p.data.initialBalance,include_in_total:true,icon:"💳",color:"#14A36F"});if(error)redirect("/onboarding?error=Не удалось создать первый счёт");}
 const{error:categoryError}=await s.from("categories").upsert(DEFAULT_CATEGORIES.map(c=>({user_id:userId,kind:c.kind,name:c.name,icon:c.icon})),{onConflict:"user_id,kind,name"});
 if(categoryError)redirect("/onboarding?error=Не удалось создать категории");
 const{error:doneError}=await s.from("profiles").update({onboarding_completed:true,updated_at:new Date().toISOString()}).eq("id",userId);
 if(doneError)redirect("/onboarding?error=Не удалось завершить настройку");
 redirect("/dashboard");
}
