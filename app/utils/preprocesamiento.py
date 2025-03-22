import unicodedata
import re

def normalize_text(texto):
    texto = unicodedata.normalize('NFKD', texto).encode('ascii', 'ignore').decode('ascii')
    texto = re.sub(r'[^a-zA-Z0-9\s]', '', texto)
    return texto.lower().strip()
