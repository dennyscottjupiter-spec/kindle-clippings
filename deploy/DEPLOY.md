---
title: Deploy — Kindle Clippings Reader
status: current
updated: 2026-08-21
---

## O que isso faz

- O nginx serve o site estático na porta **8099** do mini-PC.
- Os arquivos do site vêm direto do GitHub (branch `main`), baixados por um container auxiliar
  que roda uma vez e sai — não é preciso copiar nada por `scp`.
- O arquivo `My Clippings.txt` é lido **no navegador**; ele nunca chega ao servidor.

## Onde rodar — as três camadas do mini-PC

O mini-PC roda Proxmox, e é fácil colar o comando na camada errada:

| Camada | O que é | Tem `docker`? |
|---|---|---|
| 1. Host Proxmox | O hipervisor, o shell que aparece ao clicar no **nó** na UI do Proxmox | **Não** |
| 2. LXC/VM | A máquina Linux virtual que o Proxmox sobe; tem IP próprio | **Sim** — Docker está aqui |
| 3. Containers | Portainer, nginx, o app | — |

O deploy acontece na **camada 2**. Para confirmar que você está nela:

```bash
hostname; docker ps --format '{{.Names}}' | wc -l
```

Se imprimir um número (em vez de `command not found`), é o lugar certo.

## Opção A — Portainer (recomendado, sem terminal)

1. Abra o Portainer em `http://<ip-do-lxc>:9000`.
2. **Stacks → + Add stack**.
3. Nome: `kindle-clippings`.
4. No **Web editor**, cole o conteúdo de `deploy/docker-compose.yml` deste repositório.
5. **Deploy the stack** (leva ~20s, ele baixa duas imagens).
6. Abra `http://<ip-do-lxc>:8099`.

## Opção B — terminal do LXC

Cole tudo de uma vez no console da camada 2:

```bash
mkdir -p /opt/kindle-clippings
cd /opt/kindle-clippings
curl -fsSL https://raw.githubusercontent.com/dennyscottjupiter-spec/kindle-clippings/main/deploy/docker-compose.yml -o docker-compose.yml
docker compose up -d --wait
curl -s -o /dev/null -w 'http:%{http_code}\n' http://localhost:8099/
docker compose exec -T web sh -c 'echo "index:$(test -f /usr/share/nginx/html/index.html && echo ok || echo MISSING) css:$(ls /usr/share/nginx/html/css/*.css | wc -l) js:$(ls /usr/share/nginx/html/js/*.js | wc -l)"'
```

Saída esperada nas duas últimas linhas: `http:200` e `index:ok css:7 js:24`.

## Como o stack funciona

- O serviço **`fetch`** (Alpine) baixa o tarball da branch `main` no **volume Docker** `site`
  e repete isso a cada 5 minutos, para sempre. Ele também escreve a config do nginx
  (`add_header Cache-Control "no-store"`) no volume `conf`.
- O serviço **`web`** (nginx) só inicia depois que o primeiro download aterrissou, graças ao
  healthcheck do `fetch` (`test -f /site/index.html`) + `condition: service_healthy`.
- Os dois compartilham os volumes; o nginx monta ambos como **read-only** — ele nunca precisa
  escrever, e assim não pode alterar os arquivos.
- O `no-store` é o que impede o navegador (celular, Nest Hub, qualquer um) de servir JS/CSS
  antigos do cache: sem cabeçalho de cache o Chrome inventa um por conta própria.

## Atualizar o app

Depois de dar `git push`, **não há nada a fazer** — o `fetch` rebaixa a branch `main` em até
5 minutos e o navegador não guarda cache. Para forçar na hora:

- **Portainer:** Stacks → `kindle-clippings` → Containers → `kindle-clippings-fetch` → **Restart**.
- **Terminal:** `cd /opt/kindle-clippings; docker compose restart fetch`

⚠️ Ao migrar da versão antiga do stack (a que rodava o `fetch` uma vez só), o volume `site`
guarda a versão velha até o novo `fetch` rodar; se quiser começar limpo:
`docker compose down; docker volume rm kindle-clippings_site; docker compose up -d --wait`.

## Problemas comuns

| Sintoma | Causa / o que fazer |
|---|---|
| `docker: command not found` | Você está no shell do host Proxmox (camada 1), não no LXC. Veja a tabela acima. |
| HTTP `000` | Container não está de pé ou porta bloqueada; rode `docker compose ps`. |
| HTTP `403` ou página em branco | O `fetch` falhou (rede/GitHub fora). Veja `docker compose logs fetch`. |
| Página carrega versão antiga | Volume `site` velho: `docker compose restart fetch` e confira `docker compose logs fetch`. |
| Capas dos livros não aparecem | Recurso opt-in, desligado por padrão — ative no próprio app. |

## Privacidade

O nginx serve apenas arquivos estáticos. `My Clippings.txt` nunca é enviado para o servidor —
todo o parsing acontece no navegador do dispositivo que abrir a página.
