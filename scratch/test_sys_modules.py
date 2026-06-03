import sys

# Simulation of app.py
class MockApp:
    def __init__(self):
        self.routes = {}
    def route(self, path):
        def decorator(func):
            self.routes[path] = func
            return func
        return decorator

app = MockApp()

# Now map the running module to sys.modules['app']
sys.modules['app'] = sys.modules['__main__']

# Now import the route simulation
import scratch_route

print("Registered routes:", app.routes)
