def init_routes(app):
    from app.routes import chat_routes
    from app.routes import chat_voz
    
    app.register_blueprint(chat_routes.chat)
    app.register_blueprint(chat_voz.chat_voz)