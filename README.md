# Hábitos — PWA de tracking de hábitos

React + Vite + Framer Motion + Supabase + Web Push (Vercel Functions).

## 1. Supabase (uma vez)
1. **SQL Editor** → cole e rode `supabase/schema.sql`.
2. **Authentication → URL Configuration**: em *Site URL* coloque a URL da Vercel (ex.: `https://seu-app.vercel.app`).
3. (Opcional) **Authentication → Providers → Email**: desative *Confirm email* se não quiser confirmação por email.

## 2. Vercel
1. Suba a pasta para um repositório no GitHub e importe na Vercel (framework: Vite).
2. Em **Settings → Environment Variables**, adicione todas as variáveis do `.env.local`
   (`VITE_*`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VAPID_*`, `CRON_SECRET`).
3. Faça o deploy.

## 3. Lembretes automáticos
1. Supabase → **Database → Extensions**: ative `pg_cron` e `pg_net`.
2. Abra `supabase/cron.sql`, troque `SEU-APP` pela sua URL da Vercel e `SEU_CRON_SECRET`
   pelo valor de `CRON_SECRET` do `.env.local`, e rode no SQL Editor.

A cada 5 min o Supabase chama `/api/reminders`, que envia:
- o lembrete de cada hábito no horário configurado (só se ainda não foi feito);
- o resumo diário com os hábitos pendentes.

A notificação do hábito tem o botão **✓ Feito**, que marca direto no app.

## Desenvolvimento
```bash
npm install
npm run dev        # app em http://localhost:5173
npm run typecheck
npm run build
```
As notificações push de teste (`/api/push-test`) só funcionam no deploy (ou com `vercel dev`).

## iPhone
Push no iOS exige **iOS 16.4+** e o app **adicionado à Tela de Início** (Safari → Compartilhar → Adicionar à Tela de Início).
