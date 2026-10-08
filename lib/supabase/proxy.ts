import {createServerClient} from "@supabase/ssr";
import {NextResponse,type NextRequest} from "next/server";
import {getSupabasePublicEnv,isSupabaseConfigured} from "@/lib/env";
const PUBLIC_PATHS=["/login","/forgot-password","/reset-password","/auth","/offline"];
export async function updateSession(request:NextRequest){
 if(!isSupabaseConfigured())return NextResponse.next({request});
 let response=NextResponse.next({request});const{url,publishableKey}=getSupabasePublicEnv();
 const supabase=createServerClient(url,publishableKey,{cookies:{getAll(){return request.cookies.getAll();},setAll(cookiesToSet,headers){cookiesToSet.forEach(({name,value})=>request.cookies.set(name,value));response=NextResponse.next({request});cookiesToSet.forEach(({name,value,options})=>response.cookies.set(name,value,options));Object.entries(headers).forEach(([key,value])=>response.headers.set(key,value));}}});
 const{data}=await supabase.auth.getClaims();const claims=data?.claims;const isPublic=PUBLIC_PATHS.some(path=>request.nextUrl.pathname.startsWith(path));
 if(!claims&&!isPublic){const urlToLogin=request.nextUrl.clone();urlToLogin.pathname="/login";urlToLogin.searchParams.set("next",request.nextUrl.pathname);return NextResponse.redirect(urlToLogin);}
 if(claims&&request.nextUrl.pathname==="/login"){const u=request.nextUrl.clone();u.pathname="/dashboard";u.search="";return NextResponse.redirect(u);}
 return response;
}
