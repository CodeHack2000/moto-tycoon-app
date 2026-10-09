"""Gera os dados da app do Banqueiro a partir das pastas do projeto MOTO TYCOON.

O que faz:
  1. Lê ../card-motas/motas.json e escreve data/motas.js (catálogo das 44 motas).
  2. Cria miniaturas leves (webp) das imagens em ../card-motas/processed_images → img/motas/NN.webp.
  3. Copia o manual de regras ../regras/index_regras.html → regras.html.

Corre sempre que alterares as motas ou o manual:
    pip install pillow
    python tools/gerar-dados.py

Depois aumenta o CACHE_VERSION em sw.js para os telemóveis receberem a atualização.
"""
import json
import shutil
from pathlib import Path

from PIL import Image

APP = Path(__file__).resolve().parent.parent
PROJETO = APP.parent
MOTAS_JSON = PROJETO / 'card-motas' / 'motas.json'
IMAGENS = PROJETO / 'card-motas' / 'processed_images'
REGRAS = PROJETO / 'regras' / 'index_regras.html'

THUMB_SIZE = (240, 144)  # 2x do tamanho mostrado na app (120x72)


def gerar_catalogo():
    motas = json.loads(MOTAS_JSON.read_text(encoding='utf-8'))
    pasta_img = APP / 'img' / 'motas'
    pasta_img.mkdir(parents=True, exist_ok=True)

    catalogo = []
    for m in motas:
        thumb = pasta_img / f"{m['id']:02d}.webp"
        origem = IMAGENS / (Path(m['imagem']).stem + '.png')
        with Image.open(origem) as im:
            im.thumbnail(THUMB_SIZE, Image.LANCZOS)
            im.save(thumb, 'WEBP', quality=80, method=6)

        catalogo.append({
            'id': m['id'],
            'nome': m['nome'],
            'raridade': m['raridade'],
            'classica': m['classica'],
            'aquisicao': m['aquisicao'],
            'venda': m['venda'],
            'apps': m['apps'],
            'imagem': f"img/motas/{m['id']:02d}.webp",
        })

    linhas = ',\n'.join('  ' + json.dumps(m, ensure_ascii=False) for m in catalogo)
    (APP / 'data').mkdir(exist_ok=True)
    (APP / 'data' / 'motas.js').write_text(
        '/* Gerado por tools/gerar-dados.py a partir de card-motas/motas.json. Não editar à mão. */\n'
        f'const MOTAS = [\n{linhas},\n];\n',
        encoding='utf-8',
    )
    print(f'{len(catalogo)} motas → data/motas.js e img/motas/')


def copiar_regras():
    shutil.copyfile(REGRAS, APP / 'regras.html')
    print('Manual de regras → regras.html')


if __name__ == '__main__':
    gerar_catalogo()
    copiar_regras()
