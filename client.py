import websocket

def on_message(ws, message):
    if message == "START":
        print("Laptop starting collection")
    elif message == "STOP":
        print("Laptop stopping collection")

ws = websocket.WebSocketApp("ws://127.0.0.1:8080", on_message=on_message)
ws.run_forever()