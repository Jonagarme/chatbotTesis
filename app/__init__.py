from flask import Flask

def create_app():
    app = Flask(__name__)

    # Inicializar SQLAlchemy y Flask-Migrate
    #db.init_app(app)
    #migrate.init_app(app, db)

    # Registrar rutas dentro del contexto de la aplicación para evitar el ciclo de importación
    with app.app_context():
        from .routes import init_routes
        init_routes(app)

    return app