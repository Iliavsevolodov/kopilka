import type{Metadata,Viewport}from"next";import "@/app/globals.css";import{ServiceWorkerRegister}from"@/components/service-worker-register";
export const metadata:Metadata={title:{default:"KOPILKA",template:"%s · KOPILKA"},description:"Персональная финансовая операционная система",applicationName:"KOPILKA",appleWebApp:{capable:true,statusBarStyle:"default",title:"KOPILKA"}};
export const viewport:Viewport={themeColor:[{media:"(prefers-color-scheme: light)",color:"#f5f7f6"},{media:"(prefers-color-scheme: dark)",color:"#0d1210"}],viewportFit:"cover"};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="ru"><body><ServiceWorkerRegister/>{children}</body></html>;}
