from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
from app import create_app

app = create_app()  

@app.route('/')
def index():
    return render_template('index.html')

if __name__ == '__main__':
    CORS(app)
    
    app.run(debug=True)
