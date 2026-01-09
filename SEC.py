import asyncio
import websockets
import socket

# Lista para guardar todos los clientes conectados (Interfaz y Sensores)
CLIENTES = set()

def obtener_ip_local():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('8.8.8.8', 1))
        ip = s.getsockname()[0]
    except Exception:
        ip = '127.0.0.1'
    finally:
        s.close()
    return ip

async def Recibir_datos(websocket):
    # Registrar nuevo cliente
    CLIENTES.add(websocket)
    print(f"Nueva conexión. Total conectados: {len(CLIENTES)}")
    
    try:
        async for message in websocket:
            print(f"Dato recibido del sensor: {message}")
            
            # RETRANSMISIÓN: Enviar el dato a todos los demás clientes (tu interfaz React)
            if CLIENTES:
                # Creamos una copia para evitar errores si alguien se desconecta en el proceso
                tareas = [cliente.send(message) for cliente in CLIENTES if cliente != websocket]
                if tareas:
                    await asyncio.gather(*tareas)
                    
    except websockets.exceptions.ConnectionClosed:
        print("Cliente desconectado")
    finally:
        # Eliminar cliente de la lista al desconectarse
        CLIENTES.remove(websocket)

async def main():
    mi_ip = obtener_ip_local()
    puerto = 8080
    async with websockets.serve(Recibir_datos, "0.0.0.0", puerto):
        print(f"--- SERVIDOR ACTIVO EN ws://{mi_ip}:{puerto} ---")
        await asyncio.Future()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nServidor detenido.")