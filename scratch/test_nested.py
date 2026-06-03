from flask import Flask, url_for

app = Flask(__name__)

def register_routes(app):
    @app.route('/')
    def index():
        return "Hello World!"

    @app.route('/test')
    def test_route():
        return "Test!"

register_routes(app)

with app.test_request_context():
    print("URL for index:", url_for('index'))
    print("URL for test_route:", url_for('test_route'))
