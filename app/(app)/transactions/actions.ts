"use server";
import{revalidatePath}from"next/cache";
import{redirect}from"next/navigation";
import{createClient}from"@/lib/supabase/server";
import{transactionFormSchema}from"@/lib/validation/transactions";
const asBool=(v:FormDataEntryValue|null)=>v==="on"||v==="true";
export async function createTransactionAction(fd:FormData){
 const p=transactionFormSchema.safeParse({type:fd.get("type"),amount:fd.get("amount"),accountId:fd.get("accountId"),destinationAccountId:fd.get("destinationAccountId")||undefined,categoryId:fd.get("categoryId")||undefined,description:fd.get("description")||undefined,notes:fd.get("notes")||undefined,isImpulsive:asBool(fd.get("isImpulsive")),isMandatory:asBool(fd.get("isMandatory"))});
 if(!p.success)redirect("/transactions?error=Проверьте данные операции#new");
 const s=await createClient();const{data:claims}=await s.auth.getClaims();const userId=claims?.claims?.sub;if(!userId)redirect("/login");
 const{data:account,error:accountError}=await s.from("accounts").select("currency").eq("id",p.data.accountId).eq("user_id",userId).single();if(accountError||!account)redirect("/transactions?error=Счёт не найден#new");
 if(p.data.type!=="transfer"&&p.data.categoryId){const{data:category}=await s.from("categories").select("kind").eq("id",p.data.categoryId).eq("user_id",userId).single();if(!category||category.kind!==p.data.type)redirect("/transactions?error=Категория не подходит типу операции#new");}
 const{error}=await s.rpc("create_financial_transaction",{p_type:p.data.type,p_amount_minor:p.data.amount,p_account_id:p.data.accountId,p_destination_account_id:p.data.type==="transfer"?p.data.destinationAccountId:null,p_category_id:p.data.type==="transfer"?null:p.data.categoryId,p_currency:account.currency,p_description:p.data.description||null,p_notes:p.data.notes||null,p_is_impulsive:p.data.isImpulsive,p_is_mandatory:p.data.isMandatory});
 if(error)redirect("/transactions?error=Операция не сохранена#new");
 revalidatePath("/dashboard");revalidatePath("/transactions");revalidatePath("/profile");redirect("/transactions?message=Операция сохранена");
}
