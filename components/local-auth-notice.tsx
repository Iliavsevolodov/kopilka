import Link from 'next/link';
export function LocalAuthNotice(){return <main className="onboarding"><section className="card"><h1>Начните без регистрации</h1><p className="muted">Сейчас Копилка работает на этом устройстве. Вход, восстановление пароля и синхронизация появятся после подключения сервера.</p><Link className="btn-primary" href="/dashboard">Открыть Копилку</Link></section></main>;}
