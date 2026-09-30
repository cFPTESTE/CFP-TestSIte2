# Site do Centro de Física do Porto

Site estático feito com [Eleventy](https://www.11ty.dev/) e publicado automaticamente no GitHub Pages.
O conteúdo está todo em ficheiros de texto simples (YAML) na pasta `content/`, por isso não é preciso
mexer em HTML para atualizar pessoas, áreas ou projetos.

## Estrutura

```
content/
  seminars.yml      seminários
  site.yml          nome, texto "about", morada, email do centro
  areas.yml         áreas de investigação (texto, tópicos, cor, ordem)
  projects.yml      projetos
  people/*.yml      um ficheiro por pessoa
src/                modelos das páginas (HTML/Nunjucks) e CSS
  news/*.md         notícias (uma por ficheiro)
  assets/people/    fotografias
tools/import_form.py  importa respostas novas do Google Form
.github/workflows/deploy.yml  publica o site a cada alteração
```

## Publicar no GitHub (uma vez)

1. Criar um repositório no GitHub (por exemplo `cfp-site`, de preferência numa organização do centro) e enviar esta pasta.
2. No repositório: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Cada `push` para `main` compila e publica o site. O endereço fica `https://<utilizador>.github.io/<repositório>/`.
4. Domínio próprio (opcional, por exemplo `cfp.fc.up.pt`): em **Settings → Pages → Custom domain**; o registo DNS tem de ser criado pelos serviços informáticos da FCUP.

## Tarefas comuns

**Editar um perfil** – abrir `content/people/<nome>.yml` (dá para editar diretamente no site do GitHub, no ícone do lápis) e gravar. O site atualiza-se em 1–2 minutos.

**Logótipos** – colocar os ficheiros oficiais em `src/assets/logos/` com estes nomes (SVG de preferência, ou PNG com fundo transparente):
- `cfp.svg` – logótipo do CFP, aparece no topo de todas as páginas e como ícone do separador;
- `cfp-white.svg` (opcional) – versão clara, usada no topo quando o tema é o escuro;
- `fct.svg` – logótipo da FCT, aparece no rodapé na secção "Funding", sobre fundo branco.
O texto ao lado do logótipo da FCT e a referência do financiamento estão em `content/site.yml` (`funding:`). Enquanto não houver ficheiro, o topo mostra só o nome do centro e o rodapé mostra o nome da FCT por extenso.

**Fotografias** – há duas maneiras:
- pôr o link da imagem no perfil (`photo: https://...`); ao publicar, o GitHub descarrega-a para `src/assets/people/<nome-do-ficheiro>.jpg` (script `tools/fetch_photos.py`) e o site passa a usar a cópia local;
- ou colocar diretamente a imagem (quadrada, ~400×400 px) em `src/assets/people/` com o mesmo nome do ficheiro do perfil, por exemplo `vasco-goncalves.jpg`. Se a foto não carregar, aparecem as iniciais.

Também é possível escrever o caminho explicitamente no perfil:
```yaml
photo: /assets/people/vasco-goncalves.jpg
```

**Adicionar uma pessoa** – copiar um ficheiro existente em `content/people/`, mudar o nome do ficheiro e o conteúdo. Campos:

| Campo | Obrigatório | Notas |
|---|---|---|
| `name` | sim | nome a mostrar |
| `category` | sim | `faculty`, `researcher`, `phd` ou `msc` |
| `areas` | sim | ids de `content/areas.yml`, ex. `[quantum-materials]` |
| `keywords`, `affiliation`, `email`, `office`, `orcid`, `links`, `photo`, `bio`, `publications` | não | |
| `pending: true` | não | mostra "Profile coming soon" e não cria página individual |

**Remover uma pessoa** (saída do centro) – apagar o ficheiro dela em `content/people/`.

**Importar respostas novas do formulário** – descarregar as respostas do Google Form em `.xlsx` e correr:
```bash
pip install openpyxl pyyaml
python3 tools/import_form.py "respostas.xlsx"
```
Só cria perfis novos ou substitui os que ainda estão `pending: true`; perfis já editados à mão não são tocados.
Se o nome no formulário for diferente do nome do ficheiro provisório (ex. "José Guilherme Matos" vs `jose-matos.yml`), apagar o provisório.
Depois, rever o ficheiro criado: traduzir a bio se vier em português e acrescentar `title`/`journal` aos artigos.

**Adicionar um seminário** – acrescentar uma entrada em `content/seminars.yml` (há um exemplo comentado no próprio ficheiro). O site separa sozinho os próximos seminários dos passados; é recompilado todas as noites para isso.

**Publicar uma notícia** – criar um ficheiro em `src/news/`, por exemplo `2026-10-premio.md`:
```markdown
---
title: Título da notícia
date: 2026-10-05
summary: Uma frase que aparece no cartão da notícia.
area: quantum-materials   # opcional; dá a cor da área
---
Texto da notícia em Markdown. **Negrito**, [links](https://...), listas com "-".
```

**Lista completa de publicações** – é gerada sozinha a cada compilação (todas as noites) a partir do [OpenAlex](https://openalex.org), que liga os artigos aos ORCID. Entra um artigo quando o membro do CFP está identificado pelo ORCID e a afiliação impressa no artigo corresponde a um dos padrões em `content/site.yml` (`publications.affiliation_patterns`): Centro de Física do Porto, CF-UM-UP, etc. Artigos só com "Departamento de Física e Astronomia, FCUP" não entram; para os incluir, acrescentar um padrão como `"faculdade de ciencias.{0,40}universidade do porto"`. Quem não tem ORCID no perfil (campo `orcid:`) não aparece nesta lista. O relatório de quantos artigos entraram por pessoa aparece no registo da compilação (separador Actions do GitHub).

**Vídeos do YouTube** – os vídeos mais recentes do canal aparecem sozinhos na página inicial e em News & Seminars (o site lê o canal cada vez que é compilado, todas as noites). O canal está definido em `content/site.yml`. Para ligar um seminário à gravação, acrescentar `video: https://www.youtube.com/watch?v=...` à entrada em `content/seminars.yml`.

**Alterar textos das áreas ou a página inicial** – `content/areas.yml` e `content/site.yml`.

## Trabalhar no computador (opcional)

```bash
npm install
npm run serve     # abre http://localhost:8080 e atualiza ao gravar
npm run build     # gera a pasta _site/
```
