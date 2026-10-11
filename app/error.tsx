'use client';
export default function ErrorPage({reset}:{reset:()=>void}){return <main className="onboarding"><section className="card"><h1>Не удалось открыть страницу</h1><p className="muted">Ваши локальные данные сохранены. Попробуйте загрузить страницу ещё раз.</p><button className="btn-primary" onClick={reset}>Повторить загрузку</button></section></main>;}
