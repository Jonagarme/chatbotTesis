import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.tree import DecisionTreeClassifier
from sklearn.pipeline import Pipeline
import joblib

# Entrenamiento del modelo con datos del CSV
def entrenar_modelo_tipo_cita(ruta_csv, ruta_modelo):
    df = pd.read_csv(ruta_csv)
    X = df["texto"]
    y = df["tipo_cita"]
    
    pipeline = Pipeline([
        ('tfidf', TfidfVectorizer()),
        ('clf', DecisionTreeClassifier())
    ])
    
    pipeline.fit(X, y)
    joblib.dump(pipeline, ruta_modelo)
    print("✅ Modelo de tipo de cita entrenado:", ruta_modelo)

# modelo para modalidad
def entrenar_modelo_modalidad(ruta_csv, ruta_modelo):
    df = pd.read_csv(ruta_csv)
    X = df["texto"]
    y = df["modalidad"]
    pipeline = Pipeline([
        ('tfidf', TfidfVectorizer()),
        ('clf', DecisionTreeClassifier())
    ])
    pipeline.fit(X, y)
    joblib.dump(pipeline, ruta_modelo)
    print("✅ Modelo de modalidad entrenado:", ruta_modelo)

def predecir_modalidad(texto, ruta_modelo):
    modelo = joblib.load(ruta_modelo)
    return modelo.predict([texto])[0]


def predecir_tipo_cita(texto, ruta_modelo):
    modelo = joblib.load(ruta_modelo)
    return modelo.predict([texto])[0]
