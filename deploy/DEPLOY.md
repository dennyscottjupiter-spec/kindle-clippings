---
title: Deploy — Kindle Clippings Reader
status: current
updated: 2026-08-21
---

## O que isso faz

- O nginx serve o site estático na porta 8099 do mini-PC.
- Nada é enviado para fora da rede local — sem upload, sem servidor externo.
- O arquivo de clippings é lido no navegador; ele nunca chega ao servidor.

## Pré-requisitos

- Docker + Docker Compose plugin instalados no mini-PC.
- A pasta do app copiada para o mini-PC (veja Passo 1).

## Passo 1 — copiar os arquivos

`index.html`, `styles.css` e a pasta `js/` precisam ficar direto dentro de `/opt/kindle-clippings/site/` (sem subpasta extra).

Exemplo com `scp` (substitua os placeholders):

```bash
scp -r index.html styles.css js <user>@<mini-pc-ip>:/opt/kindle-clippings/site/
```

## Passo 2 — bloco único para colar

Cole tudo de uma vez no terminal do mini-PC:

```bash
mkdir -p /opt/kindle-clippings/site
cd /opt/kindle-clippings
cat > docker-compose.yml <<'EOF'
services:
  kindle-clippings:
    image: nginx:alpine
    container_name: kindle-clippings
    restart: unless-stopped
    ports:
      - "8099:80"  # port 8099 is the LAN port
    volumes:
      - ./site:/usr/share/nginx/html:ro  # read-only mount on purpose, static site only
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://localhost/ >/dev/null || exit 1"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 5s
EOF
docker compose up -d
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8099/
docker inspect -f '{{.State.Running}}' kindle-clippings
```

Cole de volta apenas as duas últimas linhas da saída (o código HTTP e `true`/`false`).

## Passo 3 — abrir no LAN

Acesse `http://<mini-pc-ip>:8099` a partir de qualquer dispositivo na mesma rede local.

## Alternativa: stack no Portainer

1. Abra Portainer em `<mini-PC-IP>:9000`.
2. Vá em **Stacks → Add stack**.
3. Nomeie a stack `kindle-clippings` e cole o conteúdo do `docker-compose.yml` do Passo 2.
4. Clique em **Deploy the stack**.

## Atualizar o app

Re-copie os arquivos atualizados para `/opt/kindle-clippings/site/` (mesmo comando `scp` do Passo 1) e rode:

```bash
docker compose restart kindle-clippings
```

Não precisa rebuild — é um bind mount, o nginx lê os arquivos direto do disco.

## Problemas comuns

| Sintoma | Causa / o que fazer |
|---|---|
| HTTP `000` | Container não está de pé ou porta bloqueada; rode `docker compose ps`. |
| HTTP `403` | Arquivos ficaram uma pasta funda demais; `index.html` precisa estar direto dentro de `site/`. |
| Página carrega vazia | Navegador guardou versão antiga em cache; force reload (Ctrl+Shift+R). |

## Privacidade

O nginx serve apenas arquivos estáticos. `My Clippings.txt` nunca é enviado para o servidor — o parsing acontece inteiramente no navegador.
