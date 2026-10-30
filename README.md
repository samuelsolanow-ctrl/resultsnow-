# ResultsNOW

Resultados de regatas de vela real (Finn, ILCA, Star, Snipe, Optimist e outras), com pontuação baixa pelo RRS Apêndice A.

- Página pública: eventos em andamento e eventos passados, com capa e top 3 de cada evento.
- Súmula por classe: Rank, Bandeira (país, estado ou os dois), Nº de vela, Velejador (timoneiro + proeiro nas classes de dupla), Clube, ID CBVela, R1…Rn, Total e Líquido. O botão "Súmula em PDF" imprime em A4 deitado.
- Painel do organizador: cria o evento, envia a capa, cadastra classes e descartes, inscreve barcos (um a um ou colando da planilha) e lança cada regata à mão.
- Pontuação: DNC/DNS/OCS/DNF/RET/DSQ/BFD/UFD/NSC = inscritos + 1; DNE não descartável; RDG/DPI/SCP/ZFP com pontos informados; desempate A8.1 e A8.2.

## Colocar no ar

1. **Supabase** (plano grátis): crie um projeto novo → SQL Editor → cole e rode `supabase/schema.sql`.
2. Em Project Settings → API, copie a **Project URL** e a chave **anon public**.
3. **GitHub**: suba esta pasta para um repositório novo (ex.: `resultsnow`).
4. **Vercel**: Add New → Project → importe o repositório. Em Environment Variables, adicione:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. Deploy. Abra `/admin`, crie sua conta e confirme pelo e-mail.

Dica: em Supabase → Authentication → URL Configuration, coloque o endereço da Vercel em **Site URL** para o link de confirmação voltar para o app.

## Lançar uma regata

Evento → aba **Regatas** → escolha a classe → "Lançar regata N".

- Digite os números na ordem de chegada (`10 20 30 51`) e toque em Lançar, ou toque nos barcos da lista.
- Quem não chegou fica em "Sem chegada" com DNC; troque o código se for OCS, DNF etc.
- Salvar publica na hora. Para desclassificar alguém que chegou, tire da chegada e marque DSQ: quem vinha atrás sobe uma posição.

## Rodar no computador

```bash
cp .env.example .env.local   # preencha as duas chaves
npm install
npm run dev
```
