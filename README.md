# Site do Centro de Física do Porto

Site estático feito com [Eleventy](https://www.11ty.dev/) e publicado automaticamente no GitHub Pages.
O conteúdo está todo em ficheiros de texto simples (YAML) na pasta `content/`, por isso não é preciso
mexer em HTML para atualizar pessoas, áreas ou projetos.

## Estrutura

```
content/
  site.yml          nome, texto "about", morada, email do centro
  areas.yml         áreas de investigação (texto, tópicos, cor, ordem)
  projects.yml      projetos
  people/*.yml      um ficheiro por pessoa
src/                modelos das páginas (HTML/Nunjucks) e CSS
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

**Adicionar fotografia** – colocar a imagem (quadrada, ~400×400 px, `.jpg`) em `src/assets/people/` e no perfil escrever:
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

**Alterar textos das áreas ou a página inicial** – `content/areas.yml` e `content/site.yml`.

## Trabalhar no computador (opcional)

```bash
npm install
npm run serve     # abre http://localhost:8080 e atualiza ao gravar
npm run build     # gera a pasta _site/
```
