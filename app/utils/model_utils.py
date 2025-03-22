import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.tree import DecisionTreeClassifier
from sklearn.pipeline import Pipeline
import joblib

# Entrenamiento del modelo con datos del CSV
def entrenar_modelo(ruta_csv, ruta_modelo):
    df = pd.read_csv(ruta_csv)
    X = df["texto"]
    y = df["opcion"]

    pipeline = Pipeline([
        ('tfidf', TfidfVectorizer()),
        ('clf', DecisionTreeClassifier())
    ])

    pipeline.fit(X, y)
    joblib.dump(pipeline, ruta_modelo)
    print("✅ Modelo entrenado y guardado:", ruta_modelo)

# Cargar el modelo y predecir la categoría a partir del texto
def predecir_categoria(texto, ruta_modelo):
    modelo = joblib.load(ruta_modelo)
    prediccion = modelo.predict([texto])
    return prediccion[0]
